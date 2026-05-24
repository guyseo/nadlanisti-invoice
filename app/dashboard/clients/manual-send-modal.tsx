"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Trash2 } from "lucide-react";
import { createManualInvoiceAction } from "./actions";
import EmailPreviewModal from "@/app/dashboard/queue/email-preview-modal";
import type { ClientRow, LineTemplateRow } from "@/types/db";
import type { EmailPreviewData } from "@/lib/types";

type ClientWithLines = ClientRow & { lines: LineTemplateRow[] };

interface Props {
  client: ClientWithLines;
  vatRate: number;
  onClose: () => void;
}

const LineSchema = z.object({
  description: z.string().min(1, "חובה"),
  amount:      z.coerce.number().positive("חובה מספר חיובי"),
  quantity:    z.coerce.number().int().positive().default(1),
});

const Schema = z.object({
  billing_month: z.string().min(7, "בחר חודש"),
  doc_type:      z.union([z.literal(300), z.literal(305), z.literal(320), z.literal(400)]),
  lines:         z.array(LineSchema).min(1, "נדרשת לפחות שורה אחת"),
});

type FormValues = z.infer<typeof Schema>;

const inp: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
  padding: "9px 12px", fontSize: "13px", color: "white",
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: "10px", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)", marginBottom: "6px",
};

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(99,102,241,0.1)";
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.boxShadow   = "none";
}

// today → "YYYY-MM"
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ManualSendModal({ client, vatRate, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<EmailPreviewData | null>(null);

  const form = useForm<FormValues>({
    // @ts-expect-error zod v4 + hookform resolver type mismatch
    resolver: zodResolver(Schema),
    defaultValues: {
      billing_month: currentMonth(),
      doc_type:      client.doc_type,
      lines: client.lines.map((l) => ({
        description: l.description,
        amount:      l.amount,
        quantity:    l.quantity,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const lines   = form.watch("lines") ?? [];
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0) * (Number(l.quantity) || 1), 0);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    const result = await createManualInvoiceAction(client.id, {
      billing_month: values.billing_month + "-01",
      doc_type:      values.doc_type,
      lines:         values.lines.map((l) => ({ description: l.description, amount: l.amount, quantity: l.quantity })),
    });
    setSubmitting(false);
    if (result.success && result.data) {
      setEmailPreview(result.data);
    } else {
      setError(result.error ?? "שגיאה");
    }
  }

  // After email sent — close everything
  if (emailPreview) {
    return (
      <EmailPreviewModal
        data={emailPreview}
        onClose={() => setEmailPreview(null)}
        onSent={onClose}
      />
    );
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: "600px", maxHeight: "90vh",
        background: "#0d0d18",
        border: "1px solid rgba(99,102,241,0.25)", borderRadius: "14px",
        boxShadow: "0 0 60px rgba(99,102,241,0.12), 0 24px 48px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "white", margin: 0 }}>
              שליחה ידנית
            </h2>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
              {client.name}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px", padding: "6px", cursor: "pointer",
            color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={form.handleSubmit((v) => onSubmit(v as unknown as FormValues))}
          style={{ overflowY: "auto", padding: "24px", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* Month + doc type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={lbl}>חודש חיוב *</label>
              <input
                {...form.register("billing_month")}
                type="month"
                dir="ltr"
                style={inp}
                onFocus={focusOn} onBlur={focusOff}
              />
              {form.formState.errors.billing_month && (
                <p style={{ fontSize: "10px", color: "#fca5a5", marginTop: "3px" }}>
                  {form.formState.errors.billing_month.message}
                </p>
              )}
            </div>
            <div>
              <label style={lbl}>סוג מסמך</label>
              <select
                {...form.register("doc_type", { valueAsNumber: true })}
                style={{ ...inp, cursor: "pointer" }}
                onFocus={focusOn} onBlur={focusOff}
              >
                <option value={320}>חשבונית מס קבלה</option>
                <option value={305}>חשבונית מס</option>
                <option value={300}>חשבונית עסקה</option>
                <option value={400}>קבלה</option>
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", margin: 0 }}>
                שורות חיוב
              </p>
              <button
                type="button"
                onClick={() => append({ description: "", amount: 0, quantity: 1 })}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "4px 10px",
                  background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: "6px", color: "#a5b4fc", fontSize: "11px", fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={11} /> הוסף שורה
              </button>
            </div>

            {form.formState.errors.lines?.root && (
              <p style={{ fontSize: "11px", color: "#fca5a5", marginBottom: "8px" }}>
                {form.formState.errors.lines.root.message}
              </p>
            )}

            {fields.length === 0 ? (
              <div style={{
                border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "8px",
                padding: "16px", textAlign: "center",
                color: "rgba(255,255,255,0.25)", fontSize: "12px",
              }}>
                אין שורות — לחץ "הוסף שורה"
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 70px 36px", gap: "8px" }}>
                  {["תיאור", "מחיר ₪", "כמות", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>{h}</span>
                  ))}
                </div>
                {fields.map((field, i) => (
                  <div key={field.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 70px 36px", gap: "8px", alignItems: "start" }}>
                    <input {...form.register(`lines.${i}.description`)} placeholder="תיאור השירות"
                      style={inp} onFocus={focusOn} onBlur={focusOff} />
                    <input {...form.register(`lines.${i}.amount`)} type="number" step="0.01" min="0" dir="ltr"
                      placeholder="0.00" style={inp} onFocus={focusOn} onBlur={focusOff} />
                    <input {...form.register(`lines.${i}.quantity`)} type="number" min="1" dir="ltr"
                      placeholder="1" style={inp} onFocus={focusOn} onBlur={focusOff} />
                    <button
                      type="button" onClick={() => remove(i)}
                      style={{
                        width: "36px", height: "36px",
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                        borderRadius: "8px", cursor: "pointer", color: "rgba(239,68,68,0.6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "#fca5a5"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(239,68,68,0.6)"; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          {fields.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px", padding: "14px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                <span>לפני מע״מ</span>
                <span style={{ fontFamily: "monospace" }}>₪{subtotal.toLocaleString("he-IL")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>
                <span>מע״מ {Math.round(vatRate * 100)}%</span>
                <span style={{ fontFamily: "monospace" }}>₪{Math.round(subtotal * vatRate).toLocaleString("he-IL")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 900, color: "white", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "8px" }}>
                <span>סה״כ לתשלום</span>
                <span style={{ fontFamily: "monospace", color: "#a5b4fc" }}>₪{(subtotal + Math.round(subtotal * vatRate)).toLocaleString("he-IL")}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#fca5a5",
            }}>
              {error}
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: "8px",
            paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: "9px 20px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px", color: "rgba(255,255,255,0.7)",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
              }}
            >
              ביטול
            </button>
            <button
              type="submit" disabled={submitting}
              style={{
                padding: "9px 24px",
                background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: "8px",
                color: "white", fontSize: "13px", fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                boxShadow: submitting ? "none" : "0 0 20px rgba(99,102,241,0.3)",
              }}
            >
              {submitting ? "יוצר חשבונית..." : "צור חשבונית ושלח"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
