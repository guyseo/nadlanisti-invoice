"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase/require-auth";
import { createEZCountDoc } from "@/lib/ezcount";
import { buildInvoiceEmail } from "@/lib/email-templates";
import { calcTotals } from "@/lib/calc";
import type { ActionResult, LineItem, EmailPreviewData } from "@/lib/types";

const LineSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  sort_order: z.number().int().default(0),
});

const ClientSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  email: z.string().email("אימייל לא תקין"),
  phone: z.string().optional(),
  billing_type: z.enum(["fixed", "media_commission", "auto_cc"]),
  email_delivery_mode: z.enum(["combined", "separate"]).default("separate"),
  monthly_fee: z.number().positive().optional().nullable(),
  commission_rate: z.number().min(0).max(1).optional().nullable(),
  doc_type: z.union([z.literal(300), z.literal(305), z.literal(320), z.literal(400)]).default(320),
  invoice_email: z.union([z.literal(""), z.string().email("אימייל לא תקין")]).optional().nullable(),
  report_email: z.union([z.literal(""), z.string().email("אימייל לא תקין")]).optional().nullable(),
  invoice_email_subject: z.string().optional().nullable(),
  invoice_email_body: z.string().optional().nullable(),
  ezcount_customer_name: z.string().optional().nullable(),
  ezcount_client_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(LineSchema).default([]),
});

export type ClientFormValues = z.infer<typeof ClientSchema>;

export async function createClientAction(values: ClientFormValues): Promise<ActionResult<{ id: string }>> {
  const parsed = ClientSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await requireAuth();
  const { lines, ...clientData } = parsed.data;

  const { data: client, error } = await supabase
    .from("clients")
    .insert(clientData)
    .select("id")
    .single();

  if (error || !client) return { success: false, error: error?.message ?? "שגיאה ביצירת לקוח" };

  if (lines.length > 0) {
    const { error: linesError } = await supabase.from("invoice_line_templates").insert(
      lines.map((l, i) => ({ ...l, client_id: (client as { id: string }).id, sort_order: i }))
    );
    if (linesError) return { success: false, error: linesError.message };
  }

  revalidatePath("/dashboard/clients");
  return { success: true, data: { id: client.id } };
}

export async function updateClientAction(id: string, values: ClientFormValues): Promise<ActionResult> {
  const parsed = ClientSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await requireAuth();
  const { lines, ...clientData } = parsed.data;

  const { error } = await supabase.from("clients").update(clientData).eq("id", id);
  if (error) return { success: false, error: error.message };

  const { error: deleteErr } = await supabase.from("invoice_line_templates").delete().eq("client_id", id);
  if (deleteErr) return { success: false, error: deleteErr.message };

  if (lines.length > 0) {
    const { error: insertErr } = await supabase.from("invoice_line_templates").insert(
      lines.map((l, i) => ({ ...l, client_id: id, sort_order: i }))
    );
    if (insertErr) return { success: false, error: insertErr.message };
  }

  revalidatePath("/dashboard/clients");
  return { success: true };
}

export async function toggleClientActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("clients").update({ active }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/clients");
  return { success: true };
}

export async function toggleAutomationAction(id: string, automation_active: boolean): Promise<ActionResult> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("clients").update({ automation_active }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/clients");
  return { success: true };
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { success: false, error: "לא ניתן למחוק לקוח עם חשבוניות קיימות" };
  revalidatePath("/dashboard/clients");
  return { success: true };
}

export async function createManualInvoiceAction(
  clientId: string,
  values: { billing_month: string; doc_type: 300 | 305 | 320 | 400; lines: LineItem[] }
): Promise<ActionResult<EmailPreviewData>> {
  const supabase = await requireAuth();

  const { data: client, error: clientErr } = await supabase
    .from("clients").select("*").eq("id", clientId).single();
  if (clientErr || !client) return { success: false, error: "לקוח לא נמצא" };

  const { data: settings, error: settingsErr } = await supabase
    .from("app_settings").select("*").eq("id", 1).single();
  if (settingsErr || !settings) return { success: false, error: "הגדרות לא נמצאו" };

  const { subtotal, vat, total } = calcTotals(values.lines, settings.vat_rate);

  // Create invoice in EZCount
  let docNumber = "";
  let docUrl = "";
  try {
    const result = await createEZCountDoc({
      apiKey:             settings.ezcount_api_key,
      apiEmail:           settings.ezcount_api_email,
      clientName:         client.name,
      ezCountCustomerName: client.ezcount_customer_name,
      clientEmail:        client.email,
      ezCountClientId:    client.ezcount_client_id,
      docType:            values.doc_type,
      lines:              values.lines,
      vatRate:            settings.vat_rate,
    });
    docNumber = result.docNumber;
    docUrl    = result.docUrl;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "EZCount נכשל" };
  }

  // Save draft record (status: approved — email handled separately)
  const { data: draft } = await supabase.from("invoice_drafts").insert({
    client_id:          clientId,
    status:             "approved",
    billing_month:      values.billing_month,
    line_items:         values.lines as unknown,
    subtotal, vat, total,
    doc_type:           values.doc_type,
    ezcount_doc_number: docNumber,
    ezcount_doc_url:    docUrl,
    approved_at:        new Date().toISOString(),
  }).select("id").single();

  const draftId = draft?.id ?? "";

  // Archive
  await supabase.from("invoices_sent").insert({
    client_id:     clientId,
    draft_id:      draftId,
    doc_number:    docNumber,
    doc_url:       docUrl,
    doc_type:      values.doc_type,
    billing_month: values.billing_month,
    subtotal, vat, total,
    sent_at:       new Date().toISOString(),
  });

  const billingMonthLabel = new Date(values.billing_month + "-02")
    .toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  const { subject, body } = buildInvoiceEmail({
    subject_template: client.invoice_email_subject || settings.invoice_email_subject,
    body_template:    client.invoice_email_body    || settings.invoice_email_body,
    clientName: client.name,
    docNumber, docUrl, subtotal, vat, total,
    billingMonth: billingMonthLabel,
  });

  const invoiceTo: string = client.invoice_email || client.email;

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");

  return {
    success: true,
    data: { draftId, clientEmail: invoiceTo, clientName: client.name, subject, body },
  };
}

export async function importClientsAction(
  rows: ClientFormValues[]
): Promise<ActionResult<{ imported: number; failed: number }>> {
  const supabase = await requireAuth();
  let imported = 0;
  let failed = 0;

  for (const values of rows) {
    const parsed = ClientSchema.safeParse(values);
    if (!parsed.success) { failed++; continue; }

    const { lines, ...clientData } = parsed.data;
    const { data: client, error } = await supabase
      .from("clients")
      .insert(clientData)
      .select("id")
      .single();

    if (error || !client) { failed++; continue; }

    if (lines.length > 0) {
      await supabase.from("invoice_line_templates").insert(
        lines.map((l, i) => ({ ...l, client_id: (client as { id: string }).id, sort_order: i }))
      );
    }
    imported++;
  }

  revalidatePath("/dashboard/clients");
  return { success: true, data: { imported, failed } };
}
