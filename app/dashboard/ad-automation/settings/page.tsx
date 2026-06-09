import { requireAuth } from "@/lib/supabase/require-auth";
import AdSettingsClient, { type AccountWithClient, type ClientOption } from "./settings-client";

export default async function AdSettingsPage() {
  const supabase = await requireAuth();

  const { data: settings } = await supabase
    .from("ad_automation_settings").select("*").eq("id", 1).single();

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("*, client:clients(name)")
    .order("created_at", { ascending: true });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("active", true)
    .order("name", { ascending: true });

  if (!settings) {
    return <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>שגיאה בטעינת הגדרות</div>;
  }

  const hasApiKey = !!settings.browseract_api_key;
  // Never serialize the secret to the client.
  const safeSettings = { ...settings, browseract_api_key: "" };

  return (
    <AdSettingsClient
      settings={safeSettings}
      hasApiKey={hasApiKey}
      accounts={(accounts ?? []) as AccountWithClient[]}
      clients={(clients ?? []) as ClientOption[]}
    />
  );
}
