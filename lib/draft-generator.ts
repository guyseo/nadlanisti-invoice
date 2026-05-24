import { calcTotals } from "./calc";
import type { LineItem } from "./types";

interface SupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export interface GenerateResult {
  created: number;
  skipped: number;
  errors: string[];
}

export async function generateMonthlyDrafts(
  supabase: SupabaseClient,
  billingMonth: string   // "YYYY-MM-01"
): Promise<GenerateResult> {
  const result: GenerateResult = { created: 0, skipped: 0, errors: [] };

  // Load VAT rate
  const { data: settings } = await supabase
    .from("app_settings")
    .select("vat_rate")
    .eq("id", 1)
    .single();
  const vatRate: number = settings?.vat_rate ?? 0.18;

  // All active, automation-on, fixed-billing clients with their line templates
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, doc_type, invoice_line_templates(*)")
    .eq("active", true)
    .eq("automation_active", true)
    .eq("billing_type", "fixed");

  if (clientsErr || !clients) {
    result.errors.push(clientsErr?.message ?? "שגיאה בטעינת לקוחות");
    return result;
  }

  for (const client of clients) {
    // Check for existing non-skipped draft this month (unique index handles this,
    // but we check first to count skipped gracefully)
    const { data: existing } = await supabase
      .from("invoice_drafts")
      .select("id")
      .eq("client_id", client.id)
      .eq("billing_month", billingMonth)
      .not("status", "in", '("skipped")')
      .maybeSingle();

    if (existing) {
      result.skipped++;
      continue;
    }

    const lines: LineItem[] = (client.invoice_line_templates ?? []).map(
      (t: { description: string; amount: number; quantity: number }) => ({
        description: t.description,
        amount:      t.amount,
        quantity:    t.quantity,
      })
    );

    const { subtotal, vat, total } = calcTotals(lines, vatRate);

    const { error: insertErr } = await supabase.from("invoice_drafts").insert({
      client_id:     client.id,
      status:        "pending_review",
      billing_month: billingMonth,
      line_items:    lines,
      subtotal,
      vat,
      total,
      doc_type:      client.doc_type,
    });

    if (insertErr) {
      // Unique-constraint violation = draft already exists (race), treat as skipped
      if (insertErr.code === "23505") {
        result.skipped++;
      } else {
        result.errors.push(`${client.id}: ${insertErr.message}`);
      }
    } else {
      result.created++;
    }
  }

  return result;
}

export function currentBillingMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
