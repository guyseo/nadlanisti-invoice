"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Eye, EyeOff, CheckCircle2, AlertCircle, Plus, Trash2, Mail,
} from "lucide-react";
import {
  updateAdSettingsAction, saveAdAccountAction, deleteAdAccountAction,
  type AdSettingsFormValues,
} from "../actions";
import {
  DEFAULT_AD_EMAIL_SUBJECT, DEFAULT_AD_EMAIL_BODY, AD_EMAIL_PLACEHOLDERS, PLATFORM_LABELS,
} from "@/lib/ad-email";
import type { AdAutomationSettingsRow } from "@/types/db";

export interface ClientOption { id: string; name: string; }
export interface AccountWithClient {
  id: string;
  client_id: string;
  platform: "facebook" | "google";
  account_id: string;
  account_label: string | null;
  recipient_email: string | null;
  active: boolean;
  client: { name: string } | null;
}

interface Props {
  settings: AdAutomationSettingsRow;
  hasApiKey: boolean;
  accounts: AccountWithClient[];
  clients: ClientOption[];
}

const fieldStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px", padding: "11px 14px", fontSize: "14px", color: "white", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", marginBottom: "7px",
};
const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "12px", padding: "24px", marginBottom: "16px",
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
  color: "rgba(255,255,255,0.35)", marginBottom: "20px",
};

export default function AdSettingsClient({ settings, hasApiKey, accounts, clients }: Props) {
  const router = useRouter();
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<AdSettingsFormValues>({
    defaultValues: {
      browseract_api_key:    "",
      facebook_workflow_id:  settings.facebook_workflow_id ?? "",
      google_workflow_id:    settings.google_workflow_id ?? "",
      browseract_profile_id: settings.browseract_profile_id ?? "",
      scrape_day:            settings.scrape_day ?? 6,
      email_subject:         settings.email_subject ?? DEFAULT_AD_EMAIL_SUBJECT,
      email_body:            settings.email_body ?? DEFAULT_AD_EMAIL_BODY,
    },
  });

  async function onSubmit(values: AdSettingsFormValues) {
    setStatus("saving"); setErrorMsg("");
    const res = await updateAdSettingsAction(values);
    if (res.success) { setStatus("ok"); setTimeout(() => setStatus("idle"), 3000); router.refresh(); }
    else { setStatus("error"); setErrorMsg(res.error ?? "שגיאה"); }
  }

  return (
    <div style={{ maxWidth: "760px" }}>
      <Link href="/dashboard/ad-automation" style={{
        display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px",
        color: "rgba(255,255,255,0.4)", textDecoration: "none", marginBottom: "16px",
      }}>
        <ArrowRight size={14} /> חזרה לאוטומציה
      </Link>

      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 900, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>
          הגדרות אוטומציית מדיה
        </h1>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "6px" }}>
          חיבור BrowserAct, חשבונות פרסום ותבנית המייל — נפרד לחלוטין מהגדרות החשבוניות
        </p>
      </div>

      {/* ── BrowserAct connection ── */}
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>BrowserAct — חיבור</p>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>API Key</label>
              {hasApiKey && (
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#86efac", background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.25)", borderRadius: "4px", padding: "1px 7px" }}>
                  מוגדר ✓
                </span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                {...form.register("browseract_api_key")}
                type={showKey ? "text" : "password"}
                dir="ltr"
                placeholder={hasApiKey ? "השאר ריק כדי לא לשנות" : "app-..."}
                style={{ ...fieldStyle, paddingLeft: "40px" }}
              />
              <button type="button" onClick={() => setShowKey(v => !v)}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Workflow ID — פייסבוק</label>
              <input {...form.register("facebook_workflow_id")} dir="ltr" placeholder="wf-..." style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Workflow ID — גוגל</label>
              <input {...form.register("google_workflow_id")} dir="ltr" placeholder="wf-..." style={fieldStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Profile ID (session מחובר)</label>
              <input {...form.register("browseract_profile_id")} dir="ltr" placeholder="profile-..." style={fieldStyle} />
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>
                הפרופיל ש-login הסוכנות נשמר בו (פייסבוק + גוגל)
              </p>
            </div>
            <div>
              <label style={labelStyle}>יום הרצה</label>
              <input {...form.register("scrape_day", { valueAsNumber: true })} type="number" min={1} max={28} dir="ltr" style={fieldStyle} />
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>יום בחודש (1–28)</p>
            </div>
          </div>
        </div>

        {/* ── Email template ── */}
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>תבנית מייל — חשבוניות מדיה</p>
          <div style={{ marginBottom: "14px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
              משתנים זמינים — לחץ להעתקה
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {AD_EMAIL_PLACEHOLDERS.map(({ key, desc }) => (
                <button key={key} type="button" title={desc}
                  onClick={() => navigator.clipboard?.writeText(`{{${key}}}`)}
                  style={{ padding: "3px 10px", borderRadius: "5px", cursor: "pointer", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: "11px", fontFamily: "monospace" }}>
                  {`{{${key}}}`}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>נושא המייל</label>
            <input {...form.register("email_subject")} style={fieldStyle} placeholder={DEFAULT_AD_EMAIL_SUBJECT} />
          </div>
          <div>
            <label style={labelStyle}>גוף המייל</label>
            <textarea {...form.register("email_body")} rows={8}
              style={{ ...fieldStyle, resize: "vertical", lineHeight: "1.65", direction: "rtl", minHeight: "150px" }}
              placeholder={DEFAULT_AD_EMAIL_BODY} />
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>
              ה-PDF של החשבונית יצורף אוטומטית לכל מייל
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
          <button type="submit" disabled={status === "saving"}
            style={{ padding: "11px 28px", background: status === "saving" ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", color: "white", fontSize: "13px", fontWeight: 700, cursor: status === "saving" ? "not-allowed" : "pointer", letterSpacing: "0.05em" }}>
            {status === "saving" ? "שומר..." : "שמור הגדרות"}
          </button>
          {status === "ok" && <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#86efac", fontSize: "13px", fontWeight: 600 }}><CheckCircle2 size={15} /> נשמר</span>}
          {status === "error" && <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fca5a5", fontSize: "13px", fontWeight: 600 }}><AlertCircle size={15} /> {errorMsg}</span>}
        </div>
      </form>

      {/* ── Account mapping ── */}
      <AccountsManager accounts={accounts} clients={clients} />
    </div>
  );
}

function AccountsManager({ accounts, clients }: { accounts: AccountWithClient[]; clients: ClientOption[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState({
    client_id: "", platform: "facebook" as "facebook" | "google",
    account_id: "", account_label: "", recipient_email: "",
  });

  async function addAccount() {
    setBusy(true); setErr("");
    const res = await saveAdAccountAction(null, {
      client_id: draft.client_id,
      platform: draft.platform,
      account_id: draft.account_id,
      account_label: draft.account_label || null,
      recipient_email: draft.recipient_email || null,
      active: true,
    });
    setBusy(false);
    if (res.success) {
      setAdding(false);
      setDraft({ client_id: "", platform: "facebook", account_id: "", account_label: "", recipient_email: "" });
      router.refresh();
    } else setErr(res.error ?? "שגיאה");
  }

  async function toggleActive(a: AccountWithClient) {
    await saveAdAccountAction(a.id, {
      client_id: a.client_id, platform: a.platform, account_id: a.account_id,
      account_label: a.account_label, recipient_email: a.recipient_email, active: !a.active,
    });
    router.refresh();
  }

  async function remove(id: string) {
    await deleteAdAccountAction(id);
    router.refresh();
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>חשבונות פרסום ({accounts.length})</p>
        <button type="button" onClick={() => setAdding(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "8px", color: "#a5b4fc", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={13} /> הוסף חשבון
        </button>
      </div>

      {adding && (
        <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={labelStyle}>לקוח</label>
              <select value={draft.client_id} onChange={e => setDraft({ ...draft, client_id: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                <option value="" style={{ background: "#0a0a12" }}>בחר לקוח…</option>
                {clients.map(c => <option key={c.id} value={c.id} style={{ background: "#0a0a12" }}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>פלטפורמה</label>
              <select value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value as "facebook" | "google" })} style={{ ...fieldStyle, cursor: "pointer" }}>
                <option value="facebook" style={{ background: "#0a0a12" }}>פייסבוק</option>
                <option value="google" style={{ background: "#0a0a12" }}>גוגל</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>מזהה חשבון</label>
              <input value={draft.account_id} onChange={e => setDraft({ ...draft, account_id: e.target.value })} dir="ltr" placeholder="act_123 / 123-456-7890" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>תווית (אופציונלי)</label>
              <input value={draft.account_label} onChange={e => setDraft({ ...draft, account_label: e.target.value })} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>מייל יעד (אופציונלי)</label>
              <input value={draft.recipient_email} onChange={e => setDraft({ ...draft, recipient_email: e.target.value })} dir="ltr" placeholder="ברירת מחדל: מייל הלקוח" style={fieldStyle} />
            </div>
          </div>
          {err && <p style={{ fontSize: "11px", color: "#fca5a5", marginBottom: "10px" }}>{err}</p>}
          <button type="button" onClick={addAccount} disabled={busy || !draft.client_id || !draft.account_id}
            style={{ padding: "8px 18px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", borderRadius: "8px", color: "#a5b4fc", fontSize: "12px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: !draft.client_id || !draft.account_id ? 0.5 : 1 }}>
            {busy ? "מוסיף..." : "שמור חשבון"}
          </button>
        </div>
      )}

      {accounts.length === 0 ? (
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "16px" }}>
          אין חשבונות פרסום מוגדרים
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {accounts.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", opacity: a.active ? 1 : 0.45 }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "white", minWidth: "120px" }}>{a.client?.name ?? "—"}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px", color: a.platform === "facebook" ? "#93c5fd" : "#fca5a5", background: a.platform === "facebook" ? "rgba(59,130,246,0.12)" : "rgba(239,68,68,0.1)" }}>
                {PLATFORM_LABELS[a.platform]}
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", direction: "ltr", flex: 1 }}>{a.account_id}</span>
              {a.recipient_email && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "rgba(255,255,255,0.35)", direction: "ltr" }}>
                  <Mail size={11} /> {a.recipient_email}
                </span>
              )}
              <button type="button" onClick={() => toggleActive(a)}
                style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                {a.active ? "פעיל" : "כבוי"}
              </button>
              <button type="button" onClick={() => remove(a.id)} title="מחק"
                style={{ padding: "6px", background: "transparent", border: "none", color: "rgba(239,68,68,0.6)", cursor: "pointer" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
