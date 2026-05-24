'use server';

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/require-auth";
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
