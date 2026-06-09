import { requireAuth } from "@/lib/supabase/require-auth";
import AdAutomationClient, { type AdDraftRow } from "./ad-automation-client";

export default async function AdAutomationPage() {
  const supabase = await requireAuth();

  const { data: drafts } = await supabase
    .from("ad_invoice_drafts")
    .select("*, client:clients(name)")
    .in("status", ["pending_review", "failed"])
    .order("billing_month", { ascending: false })
    .order("created_at", { ascending: true });

  const { data: settings } = await supabase
    .from("ad_automation_settings")
    .select("browseract_api_key, facebook_workflow_id, google_workflow_id, last_run_at, scrape_day")
    .eq("id", 1)
    .single();

  const configured =
    !!settings?.browseract_api_key &&
    (!!settings?.facebook_workflow_id || !!settings?.google_workflow_id);

  return (
    <AdAutomationClient
      drafts={(drafts ?? []) as AdDraftRow[]}
      configured={configured}
      lastRunAt={settings?.last_run_at ?? null}
      scrapeDay={settings?.scrape_day ?? 6}
    />
  );
}
