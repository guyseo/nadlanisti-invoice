"use client";

import { useState } from "react";
import { Check, SkipForward, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { approveDraftAction, skipDraftAction, generateDraftsAction } from "./actions";
import type { EmailPreviewData } from "./actions";
import EmailPreviewModal from "./email-preview-modal";
import { DOC_TYPE_LABELS } from "@/lib/types";
import type { DraftRow, ClientRow } from "@/types/db";
import type { LineItem } from "@/lib/types";

type DraftWithClient = DraftRow & { client: ClientRow };

interface Props {
  drafts: DraftWithClient[];
}

export default function QueueList({ drafts }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<EmailPreviewData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMsg(null);
    const result = await generateDraftsAction();
    setGenerating(false);
    if (result.success && result.data) {
      const { created, skipped } = result.data;
      setGenerateMsg(
        created === 0 && skipped > 0
          ? `כל הטיוטות לחודש זה כבר קיימות (${skipped} לקוחות)`
          : `נוצרו ${created} טיוטות חדשות${skipped > 0 ? ` · ${skipped} כבר קיימות` : ""}`
      );
      router.refresh();
    }
  }

  async function handleApprove(draftId: string) {
    setLoading(draftId + "_approve");
    const result = await approveDraftAction(draftId);
    setLoading(null);
    // If "separate" mode: open email preview. Combined mode: no data returned, done.
    if (result.success && result.data) {
      setEmailPreview(result.data);
    }
  }

  async function handleSkip(draftId: string) {
    setLoading(draftId + "_skip");
    await skipDraftAction(draftId);
    setLoading(null);
  }

  const billingMonthLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>תור אישור</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "6px" }}>
            {drafts.length} טיוטות ממתינות לאישור
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px",
              background: generating ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "8px", color: "#a5b4fc",
              fontSize: "12px", fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={13} style={{ animation: generating ? "spin 1s linear infinite" : "none" }} />
            {generating ? "יוצר טיוטות..." : "יצור טיוטות לחודש הזה"}
          </button>
          {generateMsg && (
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{generateMsg}</p>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {drafts.length === 0 ? (
        <div style={{ border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px", padding: "60px", textAlign: "center" }}>
          <p style={{ fontSize: "22px", fontWeight: 900, color: "white", marginBottom: "8px" }}>הכל נקי ✓</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "20px" }}>אין טיוטות ממתינות לאישור</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "10px 20px",
              background: generating ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: "8px", color: "white",
              fontSize: "13px", fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
              boxShadow: generating ? "none" : "0 0 20px rgba(99,102,241,0.3)",
            }}
          >
            <RefreshCw size={14} style={{ animation: generating ? "spin 1s linear infinite" : "none" }} />
            {generating ? "יוצר טיוטות..." : "יצור טיוטות לחודש הזה"}
          </button>
          {generateMsg && (
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "12px" }}>{generateMsg}</p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {drafts.map((draft) => {
            const lines = (draft.line_items ?? []) as unknown as LineItem[];
            const isExpanded = expanded === draft.id;
            const isLoading = loading?.startsWith(draft.id);

            return (
              <div
                key={draft.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px" }}>
                  {/* Client + month */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: "white", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {draft.client.name}
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                      {billingMonthLabel(draft.billing_month)}
                    </p>
                  </div>

                  {/* Doc type badge */}
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px",
                    background: "rgba(99,102,241,0.1)", color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.2)", flexShrink: 0,
                    display: "none",
                  }}
                    className="sm:inline"
                  >
                    {DOC_TYPE_LABELS[draft.doc_type]}
                  </span>

                  {/* Total */}
                  <div style={{ textAlign: "left", flexShrink: 0 }}>
                    <p style={{ fontWeight: 900, fontFamily: "monospace", fontSize: "18px", color: "white" }}>
                      ₪{draft.total.toLocaleString()}
                    </p>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textAlign: "left" }}>כולל מע״מ</p>
                  </div>

                  {/* Expand */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : draft.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: "32px", height: "32px",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px", cursor: "pointer", color: "rgba(255,255,255,0.5)",
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {/* Approve */}
                  <button
                    onClick={() => handleApprove(draft.id)}
                    disabled={!!isLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 14px",
                      background: isLoading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      border: "none", borderRadius: "8px",
                      color: "white", fontSize: "12px", fontWeight: 700,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      boxShadow: isLoading ? "none" : "0 0 16px rgba(99,102,241,0.3)",
                    }}
                  >
                    <Check size={13} />
                    אשר
                  </button>

                  {/* Skip */}
                  <button
                    onClick={() => handleSkip(draft.id)}
                    disabled={!!isLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 14px",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px", color: "rgba(255,255,255,0.6)",
                      fontSize: "12px", fontWeight: 600,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <SkipForward size={13} />
                    דלג
                  </button>
                </div>

                {/* Expanded line items */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)", padding: "14px 16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: "12px" }}>
                      שורות חיוב
                    </p>
                    {lines.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>אין שורות</p>
                    ) : (
                      <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "right", paddingBottom: "8px", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>תיאור</th>
                            <th style={{ textAlign: "center", paddingBottom: "8px", width: "60px", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>כמות</th>
                            <th style={{ textAlign: "left", paddingBottom: "8px", width: "100px", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>סכום</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line, j) => (
                            <tr key={j} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                              <td style={{ padding: "8px 0", color: "rgba(255,255,255,0.7)" }}>{line.description}</td>
                              <td style={{ textAlign: "center", padding: "8px 0", fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>{line.quantity ?? 1}</td>
                              <td style={{ textAlign: "left", padding: "8px 0", fontFamily: "monospace", color: "white" }}>
                                ₪{(line.amount * (line.quantity ?? 1)).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                            <td colSpan={2} style={{ paddingTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>לפני מע״מ</td>
                            <td style={{ paddingTop: "8px", textAlign: "left", fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>₪{draft.subtotal.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>מע״מ 18%</td>
                            <td style={{ textAlign: "left", fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>₪{draft.vat.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ paddingTop: "6px", fontWeight: 900, fontSize: "15px", color: "white" }}>סה״כ</td>
                            <td style={{ paddingTop: "6px", textAlign: "left", fontFamily: "monospace", fontWeight: 900, fontSize: "15px", color: "#a5b4fc" }}>₪{draft.total.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Email preview modal */}
      {emailPreview && (
        <EmailPreviewModal
          data={emailPreview}
          onClose={() => setEmailPreview(null)}
          onSent={() => setEmailPreview(null)}
        />
      )}
    </>
  );
}
