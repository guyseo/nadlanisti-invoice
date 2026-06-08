import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMonthlyDrafts, currentBillingMonth } from "@/lib/draft-generator";

// "YYYY-MM-DD" where day is always "01"
const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function safeCompare(a: string, b: string): boolean {
  // Pad to equal length to avoid length-based timing leak
  const longer = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(longer, 0);
  const bufB = Buffer.alloc(longer, 0);
  Buffer.from(a).copy(bufA);
  Buffer.from(b).copy(bufB);
  return timingSafeEqual(bufA, bufB) && a.length === b.length;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization") ?? "";

  if (!secret || !safeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  let billingMonth: string;
  if (body.billing_month) {
    if (!BILLING_MONTH_RE.test(body.billing_month)) {
      return NextResponse.json({ error: "billing_month חייב להיות בפורמט YYYY-MM-01" }, { status: 400 });
    }
    billingMonth = body.billing_month;
  } else {
    billingMonth = currentBillingMonth();
  }

  const supabase = createAdminClient();
  const result = await generateMonthlyDrafts(supabase, billingMonth);

  return NextResponse.json({ ok: true, billingMonth, ...result });
}
