import { requireAuth } from "@/lib/supabase/require-auth";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const supabase = await requireAuth();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!settings) {
    return (
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
        שגיאה בטעינת הגדרות
      </div>
    );
  }

  const hasEzcountKey = !!settings.ezcount_api_key;
  const hasGmailToken = !!settings.gmail_refresh_token;

  // Strip secrets — never serialize API keys / tokens to the client bundle
  const safeSettings = {
    ...settings,
    ezcount_api_key:     "",
    gmail_refresh_token: "",
  };

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 900, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>
          הגדרות
        </h1>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "6px" }}>
          חיבורים חיצוניים ופרמטרי מערכת
        </p>
      </div>

      <SettingsForm
        settings={safeSettings}
        hasEzcountKey={hasEzcountKey}
        hasGmailToken={hasGmailToken}
      />
    </div>
  );
}
