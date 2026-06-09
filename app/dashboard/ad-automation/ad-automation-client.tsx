"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Megaphone, Settings, Play, FileText, Send, X, AlertCircle,
  Clock, ExternalLink,
} from "lucide-react";
import {
  runScrapeNowAction, sendAdInvoiceAction, skipAdInvoiceAction, getAdPdfUrlAction,
} from "./actions";
import { PLATFORM_LABELS } from "@/lib/ad-email";
import type { ScrapeResult } from "@/lib/ad-invoice-scraper";

export interface AdDraftRow {
  id: string;
  client_id: string;
  platform: "facebook" | "google";
  billing_month: string;
  account_label: string | null;
  pdf_path: string | null;
  pdf_filename: string | null;
  recipient_email: string | null;
  status: "pending_review" | "sent" | "failed" | "skipped";
  error_message: string | null;
  client: { name: string } | null;
}

interface Props {
  drafts: AdDraftRow[];
  configured: boolean;
  lastRunAt: string | null;
  scrapeDay: number;
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "12px",
  padding: "16px 20px",
  marginBottom: "10px",
};

function monthLabel(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function platformBadge(platform: "facebook" | "google") {
  const isF = platform === "facebook";
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px",
      color: isF ? "#93c5fd" : "#fca5a5",
      background: isF ? "rgba(59,130,246,0.12)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${isF ? "rgba(59,130,246,0.3)" : "rgba(239,68,68,0.25)"}`,
    }}>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export default function AdAutomationClient({ drafts, configured, lastRunAt, scrapeDay }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<ScrapeResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleRunNow() {
    setRunning(true); setError(""); setRunMsg(null);
    const res = await runScrapeNowAction();
    setRunning(false);
    if (res.success && res.data) { setRunMsg(res.data); router.refresh(); }
    else setError(res.error ?? "שגיאה בהרצה");
  }

  async function handleSend(id: string) {
    setBusyId(id); setError("");
    const res = await sendAdInvoiceAction(id);
    setBusyId(null);
    if (res.success) router.refresh();
    else setError(res.error ?? "שליחה נכשלה");
  }

  async function handleSkip(id: string) {
    setBusyId(id); setError("");
    const res = await skipAdInvoiceAction(id);
    setBusyId(null);
    if (res.success) router.refresh();
    else setError(res.error ?? "דילוג נכשל");
  }

  async function handlePreview(path: string) {
    const res = await getAdPdfUrlAction(path);
    if (res.success && res.data) window.open(res.data.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? "שגיאה בפתיחת PDF");
  }

  const pending = drafts.filter(d => d.status === "pending_review");
  const failed  = drafts.filter(d => d.status === "failed");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Megaphone size={22} style={{ color: "#a5b4fc" }} />
            <h1 style={{ fontSize: "28px", fontWeight: 900, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>
              אוטומציית חשבוניות מדיה
            </h1>
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "8px" }}>
            משיכה אוטומטית של חשבוניות מפייסבוק וגוגל ושליחתן ללקוח · רץ ב-{scrapeDay} לחודש
          </p>
        </div>
        <Link href="/dashboard/ad-automation/settings" style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600,
          textDecoration: "none",
        }}>
          <Settings size={13} /> הגדרות
        </Link>
      </div>

      {/* Not configured banner */}
      {!configured && (
        <div style={{ ...card, borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertCircle size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", color: "#fde68a" }}>
            החיבור ל-BrowserAct לא הוגדר עדיין. עבור ל
            <Link href="/dashboard/ad-automation/settings" style={{ color: "#fbbf24", textDecoration: "underline", margin: "0 4px" }}>הגדרות</Link>
            כדי להזין API key ו-workflow IDs.
          </span>
        </div>
      )}

      {/* Run now + status */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "20px 0", flexWrap: "wrap" }}>
        <button
          onClick={handleRunNow}
          disabled={running || !configured}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "11px 22px",
            background: running || !configured ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", borderRadius: "8px", color: "white", fontSize: "13px", fontWeight: 700,
            cursor: running || !configured ? "not-allowed" : "pointer",
            boxShadow: running || !configured ? "none" : "0 0 20px rgba(99,102,241,0.3)",
          }}
        >
          <Play size={14} /> {running ? "מושך חשבוניות..." : "הרץ עכשיו"}
        </button>
        {lastRunAt && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
            <Clock size={12} /> ריצה אחרונה: {new Date(lastRunAt).toLocaleString("he-IL")}
          </span>
        )}
      </div>

      {/* Run result summary */}
      {runMsg && (
        <div style={{ ...card, borderColor: "rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.06)" }}>
          <p style={{ fontSize: "13px", color: "#c7d2fe", fontWeight: 600 }}>
            ✓ נמשכו {runMsg.created} · דולגו {runMsg.skipped} · נכשלו {runMsg.failed}
          </p>
          {runMsg.errors.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingInlineStart: "18px", fontSize: "11px", color: "#fca5a5" }}>
              {runMsg.errors.map((e, i) => <li key={i}>{e.account}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div style={{ ...card, borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={15} style={{ color: "#fca5a5" }} />
          <span style={{ fontSize: "13px", color: "#fca5a5" }}>{error}</span>
        </div>
      )}

      {/* Pending review */}
      <h2 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", margin: "28px 0 12px" }}>
        ממתינות לאישור ({pending.length})
      </h2>

      {pending.length === 0 ? (
        <div style={{ ...card, color: "rgba(255,255,255,0.3)", fontSize: "13px", textAlign: "center", padding: "32px" }}>
          אין חשבוניות שממתינות לאישור
        </div>
      ) : pending.map(d => (
        <div key={d.id} style={{ ...card, display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>{d.client?.name ?? "—"}</span>
              {platformBadge(d.platform)}
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{monthLabel(d.billing_month)}</span>
            </div>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", direction: "ltr", textAlign: "right" }}>
              {d.recipient_email ?? "⚠ אין כתובת מייל"} · {d.account_label}
            </p>
          </div>

          {d.pdf_path && (
            <button onClick={() => handlePreview(d.pdf_path!)} title="צפה ב-PDF" style={iconBtn}>
              <FileText size={15} /> <ExternalLink size={11} />
            </button>
          )}
          <button
            onClick={() => handleSend(d.id)}
            disabled={busyId === d.id || !d.recipient_email}
            style={{ ...primaryBtn, opacity: busyId === d.id || !d.recipient_email ? 0.5 : 1 }}
          >
            <Send size={13} /> {busyId === d.id ? "שולח..." : "אשר ושלח"}
          </button>
          <button onClick={() => handleSkip(d.id)} disabled={busyId === d.id} title="דלג" style={iconBtn}>
            <X size={15} />
          </button>
        </div>
      ))}

      {/* Failed */}
      {failed.length > 0 && (
        <>
          <h2 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(239,68,68,0.5)", margin: "28px 0 12px" }}>
            נכשלו ({failed.length})
          </h2>
          {failed.map(d => (
            <div key={d.id} style={{ ...card, borderColor: "rgba(239,68,68,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>{d.client?.name ?? "—"}</span>
                {platformBadge(d.platform)}
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{monthLabel(d.billing_month)}</span>
              </div>
              <p style={{ fontSize: "11px", color: "#fca5a5" }}>{d.error_message ?? "שגיאה לא ידועה"}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "3px", padding: "8px 10px",
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px", color: "rgba(255,255,255,0.55)", fontSize: "12px", cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
  background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)",
  borderRadius: "8px", color: "#a5b4fc", fontSize: "12px", fontWeight: 700, cursor: "pointer",
};
