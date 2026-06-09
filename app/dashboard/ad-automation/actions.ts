"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase/require-auth";
import { sendEmail } from "@/lib/gmail";
import { scrapeAdInvoices, previousBillingMonth, type ScrapeResult } from "@/lib/ad-invoice-scraper";
import {
  DEFAULT_AD_EMAIL_SUBJECT,
  DEFAULT_AD_EMAIL_BODY,
  PLATFORM_LABELS,
  renderAdTemplate,
} from "@/lib/ad-email";
import type { ActionResult } from "@/lib/types";

const BUCKET = "ad-invoices";

// ── BrowserAct settings ──
const SettingsSchema = z.object({
  browseract_api_key:    z.string().optional().nullable(),
  facebook_workflow_id:  z.string().optional().nullable(),
  google_workflow_id:    z.string().optional().nullable(),
  browseract_profile_id: z.string().optional().nullable(),
  scrape_day:            z.number().int().min(1).max(28),
  email_subject:         z.string().optional().nullable(),
  email_body:            z.string().optional().nullable(),
});
export type AdSettingsFormValues = z.infer<typeof SettingsSchema>;

export async function updateAdSettingsAction(values: AdSettingsFormValues): Promise<ActionResult> {
  const parsed = SettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await requireAuth();
  const v = parsed.data;

  // Don't overwrite the secret with an empty value (blank = "keep current").
  const update: Record<string, unknown> = {
    facebook_workflow_id:  v.facebook_workflow_id ?? "",
    google_workflow_id:    v.google_workflow_id ?? "",
    browseract_profile_id: v.browseract_profile_id ?? "",
    scrape_day:            v.scrape_day,
    email_subject:         v.email_subject ?? null,
    email_body:            v.email_body ?? null,
    updated_at:            new Date().toISOString(),
  };
  if (v.browseract_api_key && v.browseract_api_key.trim()) {
    update.browseract_api_key = v.browseract_api_key.trim();
  }

  const { error } = await supabase.from("ad_automation_settings").update(update).eq("id", 1);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/ad-automation/settings");
  return { success: true };
}

// ── Account mapping (client → ad account) ──
const AccountSchema = z.object({
  client_id:       z.string().uuid("בחר לקוח"),
  platform:        z.enum(["facebook", "google"]),
  account_id:      z.string().min(1, "מזהה חשבון חובה"),
  account_label:   z.string().optional().nullable(),
  recipient_email: z.string().email("אימייל לא תקין").optional().or(z.literal("")).nullable(),
  active:          z.boolean().default(true),
});
export type AdAccountFormValues = z.infer<typeof AccountSchema>;

export async function saveAdAccountAction(
  id: string | null,
  values: AdAccountFormValues,
): Promise<ActionResult> {
  const parsed = AccountSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const supabase = await requireAuth();
  const data = {
    ...parsed.data,
    recipient_email: parsed.data.recipient_email || null,
    account_label:   parsed.data.account_label || null,
    updated_at:      new Date().toISOString(),
  };

  const res = id
    ? await supabase.from("ad_accounts").update(data).eq("id", id)
    : await supabase.from("ad_accounts").insert(data);

  if (res.error) return { success: false, error: res.error.message };
  revalidatePath("/dashboard/ad-automation/settings");
  return { success: true };
}

export async function deleteAdAccountAction(id: string): Promise<ActionResult> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("ad_accounts").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/ad-automation/settings");
  return { success: true };
}

// ── Run the scrape now (manual trigger) ──
export async function runScrapeNowAction(billingMonth?: string): Promise<ActionResult<ScrapeResult>> {
  const supabase = await requireAuth();
  const month = billingMonth || previousBillingMonth();
  const result = await scrapeAdInvoices(supabase as never, { billingMonth: month });
  revalidatePath("/dashboard/ad-automation");
  return { success: true, data: result };
}

// ── Signed URL to preview a stored PDF ──
export async function getAdPdfUrlAction(path: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await requireAuth();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) return { success: false, error: error?.message ?? "שגיאה ביצירת קישור" };
  return { success: true, data: { url: data.signedUrl } };
}

// ── Approve & send a scraped invoice to the client ──
export async function sendAdInvoiceAction(draftId: string): Promise<ActionResult> {
  const supabase = await requireAuth();

  const { data: draft, error: draftErr } = await supabase
    .from("ad_invoice_drafts")
    .select("*, client:clients(name, email, invoice_email)")
    .eq("id", draftId)
    .single();
  if (draftErr || !draft) return { success: false, error: "טיוטה לא נמצאה" };
  if (!draft.pdf_path) return { success: false, error: "אין קובץ PDF מצורף לטיוטה" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (draft as any).client;
  const recipient: string | null =
    draft.recipient_email || client?.invoice_email || client?.email || null;
  if (!recipient) return { success: false, error: "אין כתובת מייל ליעד" };

  // Gmail token lives in the shared app_settings.
  const { data: appSettings } = await supabase
    .from("app_settings").select("gmail_refresh_token").eq("id", 1).single();
  if (!appSettings?.gmail_refresh_token) {
    return { success: false, error: "Gmail לא מוגדר בהגדרות הראשיות" };
  }

  const { data: adSettings } = await supabase
    .from("ad_automation_settings").select("email_subject, email_body").eq("id", 1).single();

  // Download the stored PDF.
  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(draft.pdf_path);
  if (dlErr || !file) return { success: false, error: `שגיאה בהורדת PDF: ${dlErr?.message ?? ""}` };
  const buffer = Buffer.from(await file.arrayBuffer());

  const monthLabel = new Date(draft.billing_month + "T00:00:00Z")
    .toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const vars = {
    client_name: client?.name ?? "",
    platform: PLATFORM_LABELS[draft.platform] ?? draft.platform,
    month: monthLabel,
  };
  const subject = renderAdTemplate(adSettings?.email_subject || DEFAULT_AD_EMAIL_SUBJECT, vars);
  const body = renderAdTemplate(adSettings?.email_body || DEFAULT_AD_EMAIL_BODY, vars);

  try {
    await sendEmail({
      refreshToken: appSettings.gmail_refresh_token,
      to: recipient,
      subject,
      body,
      attachments: [{ filename: draft.pdf_filename || "invoice.pdf", content: buffer, mimeType: "application/pdf" }],
    });

    await supabase.from("email_log").insert({
      client_id:  draft.client_id,
      email_type: "media_invoices" as const,
      to_email:   recipient,
      subject,
      status:     "sent",
    });

    await supabase.from("ad_invoice_drafts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", draftId);

    revalidatePath("/dashboard/ad-automation");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שליחת מייל נכשלה";
    await supabase.from("email_log").insert({
      client_id:  draft.client_id,
      email_type: "media_invoices" as const,
      to_email:   recipient,
      subject,
      status:     "failed",
      error_message: msg,
    });
    return { success: false, error: msg };
  }
}

export async function skipAdInvoiceAction(draftId: string): Promise<ActionResult> {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("ad_invoice_drafts")
    .update({ status: "skipped" })
    .eq("id", draftId)
    .eq("status", "pending_review");
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/ad-automation");
  return { success: true };
}
