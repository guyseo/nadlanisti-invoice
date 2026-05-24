'use server';

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/require-auth";
import { createEZCountDoc } from "@/lib/ezcount";
import { z } from "zod";

const SettingsSchema = z.object({
  ezcount_api_key:       z.string().optional().nullable(),
  ezcount_api_email:     z.string().email("אימייל לא תקין"),
  gmail_refresh_token:   z.string().optional().nullable(),
  vat_rate:              z.number().min(0).max(1),
  report_send_day:       z.number().int().min(1).max(28),
  invoice_generate_day:  z.number().int().min(1).max(28),
  invoice_email_subject: z.string().optional().nullable(),
  invoice_email_body:    z.string().optional().nullable(),
});

export type SettingsFormValues = z.infer<typeof SettingsSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateSettingsAction(values: SettingsFormValues): Promise<ActionResult> {
  const parsed = SettingsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  const supabase = await requireAuth();

  // Never overwrite secrets with empty string — omit them if blank
  const update: Record<string, unknown> = { ...parsed.data };
  if (!update.ezcount_api_key)     delete update.ezcount_api_key;
  if (!update.gmail_refresh_token) delete update.gmail_refresh_token;

  const { error } = await supabase
    .from("app_settings")
    .update(update)
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function testGmailAction(): Promise<{ ok: boolean; error?: string; debug?: string }> {
  const supabase = await requireAuth();

  const { data: settings, error: dbErr } = await supabase
    .from("app_settings").select("gmail_refresh_token").eq("id", 1).single();

  if (dbErr) return { ok: false, error: "שגיאת DB", debug: dbErr.message };
  if (!settings?.gmail_refresh_token) return { ok: false, error: "Gmail Refresh Token לא מוגדר בהגדרות" };

  const to = process.env.GMAIL_USER_EMAIL;
  if (!to) return { ok: false, error: "GMAIL_USER_EMAIL לא מוגדר ב-Vercel Environment Variables" };

  try {
    const { sendEmail } = await import("@/lib/gmail");
    await sendEmail({
      refreshToken: settings.gmail_refresh_token,
      to,
      subject: "בדיקת חיבור Gmail — נדלניסטי 360",
      body: `שלום גיא,

זוהי הודעת בדיקה אוטומטית ממערכת ניהול החשבוניות.

אם קיבלת את ההודעה הזאת — Gmail מחובר ועובד תקין.

נשלח מ: ${to}
תאריך: ${new Date().toLocaleDateString("he-IL", { dateStyle: "full" })}

— נדלניסטי 360`,
    });
    return { ok: true, debug: `נשלח אל ${to}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function testEzcountAction(): Promise<{ ok: boolean; docNumber?: string; docUrl?: string; error?: string; debug?: string }> {
  const supabase = await requireAuth();

  const { data: settings, error: dbErr } = await supabase
    .from("app_settings").select("ezcount_api_key, ezcount_api_email, vat_rate").eq("id", 1).single();

  if (dbErr) return { ok: false, error: "שגיאת DB", debug: dbErr.message };
  if (!settings) return { ok: false, error: "הגדרות לא נמצאו ב-DB" };

  const apiKey   = settings.ezcount_api_key?.trim() ?? "";
  const apiEmail = settings.ezcount_api_email?.trim() ?? "";

  if (!apiKey)   return { ok: false, error: "API Key ריק — שמור את ההגדרות שוב", debug: `email=${apiEmail || "(ריק)"}` };
  if (!apiEmail) return { ok: false, error: "אימייל EZCount ריק — שמור את ההגדרות שוב" };

  // Mask key for debug (show first 6 chars only)
  const maskedKey = apiKey.slice(0, 6) + "***";

  try {
    const result = await createEZCountDoc({
      apiKey,
      apiEmail,
      clientName:  "TEST — בדיקת חיבור",
      clientEmail: apiEmail,
      docType:     300,
      lines:       [{ description: "בדיקת חיבור — ניתן למחוק", amount: 1, quantity: 1 }],
      vatRate:     settings.vat_rate ?? 0.18,
    });
    return { ok: true, docNumber: result.docNumber, docUrl: result.docUrl, debug: `key=${maskedKey}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, debug: `key=${maskedKey} | email=${apiEmail}` };
  }
}
