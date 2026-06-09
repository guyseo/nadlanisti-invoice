// ════════════════════════════════════════════════════════════════════
// Ad-invoice scrape orchestration — shared by the monthly cron and the
// manual "run now" action. For each active ad account: drive BrowserAct
// to download the invoice PDF, store it, and create a pending_review
// draft. One account failing never aborts the others.
// ════════════════════════════════════════════════════════════════════

import { runAndGetPdf } from "./browseract";

const BUCKET = "ad-invoices";

// Loose client shape (matches the convention in draft-generator.ts) plus storage.
interface SupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  storage: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (bucket: string) => any;
  };
}

export interface ScrapeResult {
  month: string;
  created: number;
  failed: number;
  skipped: number;
  errors: { account: string; error: string }[];
}

/** First day of the PREVIOUS month as "YYYY-MM-01" (invoices are issued for last month). */
export function previousBillingMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based; subtracting 1 and letting Date normalize
  const prev = new Date(Date.UTC(y, m - 1, 1));
  const yy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

const MONTH_NAMES_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

interface AccountRow {
  id: string;
  client_id: string;
  platform: "facebook" | "google";
  account_id: string;
  account_label: string | null;
  recipient_email: string | null;
  client: { name: string; email: string; invoice_email: string | null } | null;
}

export async function scrapeAdInvoices(
  supabase: SupabaseClient,
  opts: { billingMonth?: string; clientId?: string } = {},
): Promise<ScrapeResult> {
  const month = opts.billingMonth ?? previousBillingMonth();
  const result: ScrapeResult = { month, created: 0, failed: 0, skipped: 0, errors: [] };

  // ── Settings (BrowserAct config) ──
  const { data: settings } = await supabase
    .from("ad_automation_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!settings?.browseract_api_key) {
    result.errors.push({ account: "—", error: "BrowserAct לא מוגדר (חסר API key)" });
    return result;
  }

  const workflowFor = (platform: "facebook" | "google"): string =>
    platform === "facebook" ? settings.facebook_workflow_id : settings.google_workflow_id;

  // ── Active accounts (optionally scoped to one client) ──
  let query = supabase
    .from("ad_accounts")
    .select("id, client_id, platform, account_id, account_label, recipient_email, client:clients(name, email, invoice_email)")
    .eq("active", true);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);

  const { data: accounts, error: accErr } = await query;
  if (accErr) {
    result.errors.push({ account: "—", error: accErr.message });
    return result;
  }

  const monthYM = month.slice(0, 7);               // "YYYY-MM"
  const monthIdx = parseInt(monthYM.slice(5, 7), 10) - 1;
  const monthName = MONTH_NAMES_HE[monthIdx] ?? monthYM;
  const year = monthYM.slice(0, 4);

  for (const acc of (accounts ?? []) as AccountRow[]) {
    const label = acc.account_label || `${acc.platform}:${acc.account_id}`;

    // Idempotency: skip if a non-failed draft already exists for this month.
    const { data: existing } = await supabase
      .from("ad_invoice_drafts")
      .select("id, status")
      .eq("client_id", acc.client_id)
      .eq("platform", acc.platform)
      .eq("billing_month", month)
      .maybeSingle();

    if (existing && existing.status !== "failed") {
      result.skipped++;
      continue;
    }

    const workflowId = workflowFor(acc.platform);
    if (!workflowId) {
      result.failed++;
      result.errors.push({ account: label, error: `אין workflow מוגדר ל-${acc.platform}` });
      await upsertDraft(supabase, acc, month, { status: "failed", error_message: `אין workflow מוגדר ל-${acc.platform}` });
      continue;
    }

    try {
      const { file, result: wf } = await runAndGetPdf({
        apiKey: settings.browseract_api_key,
        workflowId,
        profileId: settings.browseract_profile_id || undefined,
        inputParameters: {
          account_id: acc.account_id,
          billing_month: monthYM,
          month_name: monthName,
          year,
        },
      });

      // Store the PDF.
      const path = `${acc.client_id}/${month}/${acc.platform}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`העלאת PDF נכשלה: ${upErr.message}`);

      const recipient = acc.recipient_email || acc.client?.invoice_email || acc.client?.email || null;
      const filename = `invoice-${acc.platform}-${monthYM}.pdf`;

      await upsertDraft(supabase, acc, month, {
        status: "pending_review",
        pdf_path: path,
        pdf_filename: filename,
        recipient_email: recipient,
        browseract_task_id: wf.taskId,
        error_message: null,
      });
      result.created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה לא ידועה";
      result.failed++;
      result.errors.push({ account: label, error: msg });
      await upsertDraft(supabase, acc, month, { status: "failed", error_message: msg });
    }
  }

  await supabase
    .from("ad_automation_settings")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", 1);

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertDraft(supabase: SupabaseClient, acc: AccountRow, month: string, fields: Record<string, any>) {
  await supabase
    .from("ad_invoice_drafts")
    .upsert(
      {
        client_id: acc.client_id,
        ad_account_id: acc.id,
        platform: acc.platform,
        billing_month: month,
        account_label: acc.account_label || `${acc.platform}:${acc.account_id}`,
        ...fields,
      },
      { onConflict: "client_id,platform,billing_month" },
    );
}
