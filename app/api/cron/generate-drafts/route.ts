import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMonthlyDrafts, currentBillingMonth } from "@/lib/draft-generator";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const billingMonth: string = body.billing_month ?? currentBillingMonth();

  const supabase = createAdminClient();
  const result = await generateMonthlyDrafts(supabase, billingMonth);

  return NextResponse.json({ ok: true, billingMonth, ...result });
}
