"use client";

import { useState } from "react";
import { X, Send, Mail } from "lucide-react";
import { sendDraftEmailAction } from "./actions";
import type { EmailPreviewData } from "./actions";

interface Props {
  data: EmailPreviewData;
  onClose: () => void;
  onSent: () => void;
}

const inp: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "10px 13px",
  fontSize: "13px",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)";
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.boxShadow = "none";
}

export default function EmailPreviewModal({ data, onClose, onSent }: Props) {
  const [subject, setSubject] = useState(data.subject);
  const [body, setBody] = useState(data.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await sendDraftEmailAction(data.draftId, subject, body);
    setSending(false);
    if (result.success) {
      setDone(true);
      setTimeout(() => { onSent(); }, 1400);
    } else {
      setError(result.error ?? "שגיאה בשליחה");
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: "640px", maxHeight: "92vh",
        background: "#0d0d18",
        border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: "14px",
        boxShadow: "0 0 60px rgba(99,102,241,0.12), 0 24px 48px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "8px",
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mail size={15} style={{ color: "#a5b4fc" }} />
            </div>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 800, color: "white", margin: 0 }}>
                שליחת חשבונית
              </h2>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>
                אל: {data.clientEmail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px", padding: "6px", cursor: sending ? "not-allowed" : "pointer",
              color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
              opacity: sending ? 0.5 : 1,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>

          {done ? (
            /* Success state */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "32px 0" }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "50%",
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px",
              }}>
                ✓
              </div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>המייל נשלח בהצלחה</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>ל-{data.clientEmail}</p>
            </div>
          ) : (
            <>
              {/* נושא */}
              <div>
                <label style={{
                  display: "block", fontSize: "10px", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.4)", marginBottom: "6px",
                }}>
                  נושא
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ ...inp, direction: "rtl" }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                  disabled={sending}
                />
              </div>

              {/* גוף המייל */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label style={{
                  display: "block", fontSize: "10px", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.4)", marginBottom: "6px",
                }}>
                  תוכן המייל
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  style={{
                    ...inp,
                    resize: "vertical",
                    lineHeight: "1.65",
                    direction: "rtl",
                    minHeight: "200px",
                  }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                  disabled={sending}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "8px", padding: "10px 14px",
                  fontSize: "12px", color: "#fca5a5",
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              disabled={sending}
              style={{
                padding: "9px 18px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px", color: "rgba(255,255,255,0.5)",
                fontSize: "12px", fontWeight: 600, cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              שמור ללא שליחה
            </button>

            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "10px 22px",
                background: sending ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: "8px",
                color: "white", fontSize: "13px", fontWeight: 700,
                cursor: sending ? "not-allowed" : "pointer",
                boxShadow: sending ? "none" : "0 0 20px rgba(99,102,241,0.3)",
              }}
            >
              <Send size={13} style={{ transform: "scaleX(-1)" }} />
              {sending ? "שולח..." : `שלח אל ${data.clientName}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
