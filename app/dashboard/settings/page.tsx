import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
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

      <SettingsForm settings={settings} />
    </div>
  );
}
