import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeAdInvoices, previousBillingMonth } from "@/lib/ad-invoice-scraper";

// Scraping a browser workflow per account can take a while — allow up to 5 min.
export const maxDuration = 300;

const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function safeCompare(a: string, b: string): boolean {
  const longer = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(longer, 0);
  const bufB = Buffer.alloc(longer, 0);
  Buffer.from(a).copy(bufA);
  Buffer.from(b).copy(bufB);
  return timingSafeEqual(bufA, bufB) && a.length === b.length;
}

interface RunOptions { billingMonth?: string; force?: boolean }

async function run(opts: RunOptions) {
  const billingMonth = opts.billingMonth ?? previousBillingMonth();
  const supabase = createAdminClient();

  // The cron fires daily; only act on the configured day (unless forced).
  // This lets the user change the run day from the UI without redeploying.
  if (!opts.force) {
    const { data: settings } = await supabase
      .from("ad_automation_settings").select("scrape_day").eq("id", 1).single();
    const scrapeDay = settings?.scrape_day ?? 6;
    const today = new Date().getUTCDate();
    if (today !== scrapeDay) {
      return NextResponse.json({ ok: true, skipped: true, reason: `today=${today} ≠ scrape_day=${scrapeDay}` });
    }
  }

  const result = await scrapeAdInvoices(supabase as never, { billingMonth });
  return NextResponse.json({ ok: true, ...result });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  return !!secret && safeCompare(auth, `Bearer ${secret}`);
}

// Vercel native cron (GET, auto-sends Authorization: Bearer CRON_SECRET).
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run({});
}

// External scheduler / manual trigger (POST with optional billing_month, force).
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.billing_month && !BILLING_MONTH_RE.test(body.billing_month)) {
    return NextResponse.json({ error: "billing_month חייב להיות בפורמט YYYY-MM-01" }, { status: 400 });
  }
  return run({ billingMonth: body.billing_month, force: !!body.force });
}
