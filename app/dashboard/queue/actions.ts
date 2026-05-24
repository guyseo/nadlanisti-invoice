"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createEZCountDoc } from "@/lib/ezcount";
import { sendEmail } from "@/lib/gmail";
import { calcTotals } from "@/lib/calc";
import { buildInvoiceEmail } from "@/lib/email-templates";
import type { ActionResult, LineItem, EmailPreviewData } from "@/lib/types";

export type { EmailPreviewData };

/* ── Step 1: approve → EZCount only, return email preview ── */
export async function approveDraftAction(draftId: string): Promise<ActionResult<EmailPreviewData>> {
  const supabase = await createClient();

  const { data: draft, error: draftErr } = await supabase
    .from("invoice_drafts")
    .select("*, client:clients(*)")
    .eq("id", draftId)
    .eq("status", "pending_review")
    .single();

  if (draftErr || !draft) return { success: false, error: "טיוטה לא נמצאה" };

  const { data: settings, error: settingsErr } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (settingsErr || !settings) return { success: false, error: "הגדרות לא נמצאו" };

  const lines = (draft.line_items ?? []) as unknown as LineItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (draft as any).client;

  // Call EZCount
  let docNumber = "";
  let docUrl = "";
  try {
    const result = await createEZCountDoc({
      apiKey:               settings.ezcount_api_key,
      apiEmail:             settings.ezcount_api_email,
      clientName:           client.name,
      ezCountCustomerName:  client.ezcount_customer_name,
      clientEmail:          client.email,
      ezCountClientId:      client.ezcount_client_id,
      docType:              draft.doc_type,
      lines,
      vatRate:              settings.vat_rate,
    });
    docNumber = result.docNumber;
    docUrl    = result.docUrl;
  } catch (e) {
    await supabase.from("invoice_drafts").update({ status: "failed" }).eq("id", draftId);
    revalidatePath("/dashboard/queue");
    return { success: false, error: e instanceof Error ? e.message : "EZCount נכשל" };
  }

  const emailMode = client.email_delivery_mode ?? "separate";
  const { subtotal, vat, total } = calcTotals(lines, settings.vat_rate);

  // Archive to invoices_sent now (invoice exists regardless of email)
  await supabase.from("invoices_sent").insert({
    client_id:     client.id,
    draft_id:      draftId,
    doc_number:    docNumber,
    doc_url:       docUrl,
    doc_type:      draft.doc_type,
    billing_month: draft.billing_month,
    subtotal,
    vat,
    total,
    sent_at:       new Date().toISOString(),
  });

  if (emailMode === "combined") {
    // Email goes with monthly report — no preview needed
    await supabase.from("invoice_drafts").update({
      status:             "invoiced_pending_combined",
      approved_at:        new Date().toISOString(),
      ezcount_doc_number: docNumber,
      ezcount_doc_url:    docUrl,
    }).eq("id", draftId);

    revalidatePath("/dashboard/queue");
    revalidatePath("/dashboard");
    return { success: true };
  }

  // separate mode: save as "approved", return email preview for user to edit & send
  await supabase.from("invoice_drafts").update({
    status:             "approved",
    approved_at:        new Date().toISOString(),
    ezcount_doc_number: docNumber,
    ezcount_doc_url:    docUrl,
  }).eq("id", draftId);

  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard");

  const invoiceTo: string = client.invoice_email || client.email;
  const { subject, body } = buildInvoiceEmail({
    subject_template: client.invoice_email_subject || settings.invoice_email_subject,
    body_template:    client.invoice_email_body    || settings.invoice_email_body,
    clientName:       client.name,
    docNumber,
    docUrl,
    subtotal,
    vat,
    total,
    billingMonth: new Date(draft.billing_month + "-01").toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
  });

  return {
    success: true,
    data: { draftId, clientEmail: invoiceTo, clientName: client.name, subject, body },
  };
}

/* ── Step 2: user confirms → send email ── */
export async function sendDraftEmailAction(
  draftId: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("invoice_drafts")
    .select("*, client:clients(*)")
    .eq("id", draftId)
    .single();

  if (!draft) return { success: false, error: "טיוטה לא נמצאה" };

  const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (draft as any).client;

  if (!settings?.gmail_refresh_token) {
    await supabase.from("invoice_drafts").update({ status: "invoiced_email_failed" }).eq("id", draftId);
    revalidatePath("/dashboard/queue");
    return { success: false, error: "Gmail לא מוגדר בהגדרות — החשבונית נשמרה ללא שליחת מייל" };
  }

  try {
    await sendEmail({ refreshToken: settings.gmail_refresh_token, to: client.email, subject, body });

    await supabase.from("email_log").insert({
      client_id:  client.id,
      draft_id:   draftId,
      email_type: "invoice" as const,
      to_email:   client.email,
      subject,
      status:     "sent",
    });

    await supabase.from("invoice_drafts").update({ status: "sent" }).eq("id", draftId);

    revalidatePath("/dashboard/queue");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    await supabase.from("invoice_drafts").update({ status: "invoiced_email_failed" }).eq("id", draftId);
    revalidatePath("/dashboard/queue");
    return { success: false, error: e instanceof Error ? e.message : "שליחת מייל נכשלה — החשבונית נשמרה" };
  }
}

export async function skipDraftAction(draftId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_drafts")
    .update({ status: "skipped" })
    .eq("id", draftId)
    .eq("status", "pending_review");
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/queue");
  return { success: true };
}

export async function updateDraftLinesAction(
  draftId: string,
  lineItems: LineItem[]
): Promise<ActionResult> {
  const supabase = await createClient();

  // Load vat_rate from settings
  const { data: settings } = await supabase.from("app_settings").select("vat_rate").eq("id", 1).single();
  const vatRate = settings?.vat_rate ?? 0.18;

  const { subtotal, vat, total } = calcTotals(lineItems, vatRate);

  const { error } = await supabase
    .from("invoice_drafts")
    .update({ line_items: lineItems as unknown, subtotal, vat, total })
    .eq("id", draftId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/queue");
  return { success: true };
}

