"use client";

import { useRef, useState } from "react";
import { Upload, X, Download, Check } from "lucide-react";
import { importClientsAction } from "./actions";
import { BILLING_TYPE_LABELS } from "@/lib/types";
import type { ClientFormValues } from "./actions";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  data: Partial<ClientFormValues>;
  errors: string[];
}

/* ── CSV parsing ── */

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) { result.push(current); current = ""; }
    else current += c;
  }
  result.push(current);
  return result;
}

const HEADER_MAP: Record<string, string> = {
  שם: "name", name: "name",
  אימייל: "email", email: "email", mail: "email",
  טלפון: "phone", phone: "phone", tel: "phone",
  "סוג_חיוב": "billing_type", "סוג חיוב": "billing_type", billing_type: "billing_type",
  "סכום_חודשי": "monthly_fee", "סכום חודשי": "monthly_fee", monthly_fee: "monthly_fee", סכום: "monthly_fee",
  עמלה: "commission_rate", "אחוז עמלה": "commission_rate", commission_rate: "commission_rate",
  "סוג_מסמך": "doc_type", "סוג מסמך": "doc_type", doc_type: "doc_type",
  "שליחת_מייל": "email_delivery_mode", "שליחת מייל": "email_delivery_mode", email_delivery_mode: "email_delivery_mode",
  הערות: "notes", notes: "notes",
};

const BILLING_MAP: Record<string, "fixed" | "media_commission" | "auto_cc"> = {
  fixed: "fixed", ריטיינר: "fixed", קבוע: "fixed",
  media_commission: "media_commission", עמלה: "media_commission", מדיה: "media_commission",
  auto_cc: "auto_cc", אוטומטי: "auto_cc", cc: "auto_cc",
};

function parseRow(raw: Record<string, string>): ParsedRow {
  const errors: string[] = [];
  const data: Partial<ClientFormValues> = { lines: [] };

  const name = raw.name?.trim();
  if (!name) errors.push("שם חובה");
  else data.name = name;

  const email = raw.email?.trim();
  if (!email) errors.push("אימייל חובה");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("אימייל לא תקין");
  else data.email = email;

  if (raw.phone?.trim()) data.phone = raw.phone.trim();

  const billingRaw = raw.billing_type?.trim() || "fixed";
  const billing = BILLING_MAP[billingRaw.toLowerCase()];
  if (!billing) errors.push(`סוג חיוב לא תקין: "${billingRaw}"`);
  else data.billing_type = billing;

  if (raw.monthly_fee?.trim()) {
    const fee = parseFloat(raw.monthly_fee);
    if (isNaN(fee) || fee <= 0) errors.push("סכום חודשי לא תקין");
    else data.monthly_fee = fee;
  }

  if (raw.commission_rate?.trim()) {
    let rate = parseFloat(raw.commission_rate);
    if (isNaN(rate)) errors.push("אחוז עמלה לא תקין");
    else {
      if (rate > 1) rate = rate / 100; // allow "9" → 0.09
      data.commission_rate = rate;
    }
  } else if (data.billing_type === "media_commission") {
    data.commission_rate = 0.09;
  }

  const docRaw = raw.doc_type?.trim();
  if (docRaw) {
    const docNum = parseInt(docRaw);
    if (![300, 305, 320, 400].includes(docNum)) errors.push(`סוג מסמך לא תקין: ${docRaw}`);
    else data.doc_type = docNum as 300 | 305 | 320 | 400;
  } else {
    data.doc_type = 320;
  }

  const modeRaw = raw.email_delivery_mode?.trim();
  if (modeRaw && modeRaw !== "combined" && modeRaw !== "separate") {
    errors.push(`שליחת מייל לא תקינה: ${modeRaw}`);
  } else {
    data.email_delivery_mode = (modeRaw as "combined" | "separate") || "separate";
  }

  if (raw.notes?.trim()) data.notes = raw.notes.trim();

  return { data, errors };
}

function parseCSVText(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map((h) => HEADER_MAP[h.trim()] ?? h.trim());
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { raw[h] = values[i] ?? ""; });
    return parseRow(raw);
  });
}

const TEMPLATE_CSV =
  "name,email,phone,billing_type,monthly_fee,commission_rate,doc_type,email_delivery_mode,notes\n" +
  "ישראל ישראלי,israel@example.com,050-1234567,fixed,5000,,320,separate,לקוח VIP\n" +
  "חברת מדיה,media@example.com,,media_commission,,9,320,combined,\n";

const COLUMN_TAGS = [
  { label: "name / שם", required: true },
  { label: "email / אימייל", required: true },
  { label: "phone / טלפון", required: false },
  { label: "billing_type / סוג_חיוב", required: false },
  { label: "monthly_fee / סכום_חודשי", required: false },
  { label: "commission_rate / עמלה", required: false },
  { label: "doc_type / סוג_מסמך", required: false },
  { label: "email_delivery_mode / שליחת_מייל", required: false },
  { label: "notes / הערות", required: false },
];

type Step = "idle" | "preview" | "importing" | "done";

/* ── Component ── */
export default function CsvImportModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSVText((e.target?.result as string) ?? "");
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.errors.length === 0).map((r) => r.data as ClientFormValues);
    setStep("importing");
    const res = await importClientsAction(valid);
    setResult(res.success ? (res.data ?? { imported: 0, failed: 0 }) : { imported: 0, failed: valid.length });
    setStep("done");
  }

  function handleDownloadTemplate() {
    const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    setStep("idle");
    setRows([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.filter((r) => r.errors.length > 0).length;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: "720px", maxHeight: "90vh",
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
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "white", margin: 0 }}>יבוא לקוחות מ-CSV</h2>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
              העלה קובץ CSV עם רשימת הלקוחות
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px", padding: "6px", cursor: "pointer",
              color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "24px", flex: 1 }}>

          {/* ── IDLE ── */}
          {step === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: "12px",
                  padding: "48px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s",
                }}
              >
                <Upload
                  size={32}
                  style={{ color: dragOver ? "#a5b4fc" : "rgba(255,255,255,0.2)", margin: "0 auto 12px" }}
                />
                <p style={{ fontSize: "14px", fontWeight: 600, color: dragOver ? "#a5b4fc" : "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>
                  גרור קובץ CSV לכאן או לחץ לבחירה
                </p>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", margin: 0 }}>
                  קבצי .csv בלבד · קידוד UTF-8
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", margin: 0 }}>
                    עמודות נתמכות
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      padding: "4px 10px",
                      background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: "6px", color: "#a5b4fc", fontSize: "11px", fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={11} />
                    הורד תבנית
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {COLUMN_TAGS.map(({ label, required }) => (
                    <span key={label} style={{
                      fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
                      fontFamily: "monospace",
                      background: required ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)",
                      color: required ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${required ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                      {label}{required ? " *" : ""}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "10px", marginBottom: 0 }}>
                  * billing_type: fixed | media_commission | auto_cc · doc_type: 300 | 305 | 320 | 400 · commission_rate: אחוז (9) או עשרוני (0.09)
                </p>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {step === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{
                  padding: "6px 14px", borderRadius: "8px",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                  fontSize: "12px", color: "#86efac", fontWeight: 600,
                }}>
                  ✓ {validCount} תקינות
                </div>
                {invalidCount > 0 && (
                  <div style={{
                    padding: "6px 14px", borderRadius: "8px",
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    fontSize: "12px", color: "#fca5a5", fontWeight: 600,
                  }}>
                    ✕ {invalidCount} עם שגיאות
                  </div>
                )}
                <button
                  onClick={() => {
                    setStep("idle");
                    setRows([]);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  style={{
                    marginRight: "auto",
                    padding: "6px 12px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "11px", color: "rgba(255,255,255,0.5)", cursor: "pointer",
                  }}
                >
                  החלף קובץ
                </button>
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["#", "שם", "אימייל", "סוג חיוב", "סכום / עמלה", "סטטוס"].map((h, i) => (
                        <th key={i} style={{
                          padding: "8px 12px", textAlign: "right",
                          fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.06em", color: "rgba(255,255,255,0.3)",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const ok = row.errors.length === 0;
                      const bt = row.data.billing_type;
                      return (
                        <tr key={i} style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          background: ok ? "transparent" : "rgba(239,68,68,0.04)",
                        }}>
                          <td style={{ padding: "8px 12px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: "11px" }}>
                            {i + 1}
                          </td>
                          <td style={{ padding: "8px 12px", color: ok ? "white" : "#fca5a5", fontWeight: 600 }}>
                            {row.data.name ?? <em style={{ fontStyle: "normal", color: "rgba(255,255,255,0.25)" }}>חסר</em>}
                          </td>
                          <td style={{ padding: "8px 12px", color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                            {row.data.email ?? <em style={{ fontStyle: "normal", color: "rgba(255,255,255,0.25)" }}>חסר</em>}
                          </td>
                          <td style={{ padding: "8px 12px", color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>
                            {bt ? BILLING_TYPE_LABELS[bt] : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                            {bt === "fixed" && row.data.monthly_fee
                              ? `₪${row.data.monthly_fee.toLocaleString()}`
                              : bt === "media_commission"
                              ? `${((row.data.commission_rate ?? 0.09) * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {ok ? (
                              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#86efac" }}>
                                <Check size={10} /> תקין
                              </span>
                            ) : (
                              <span
                                title={row.errors.join(" · ")}
                                style={{ fontSize: "11px", color: "#fca5a5", cursor: "help" }}
                              >
                                ⚠ {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === "importing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "48px 0" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%",
                border: "3px solid rgba(99,102,241,0.2)",
                borderTopColor: "#6366f1",
                animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>מייבא לקוחות...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && result && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "40px 0" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check size={24} style={{ color: "#86efac" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "white", margin: "0 0 6px" }}>
                  יובאו בהצלחה {result.imported} לקוחות
                </p>
                {result.failed > 0 && (
                  <p style={{ fontSize: "12px", color: "#fca5a5", margin: 0 }}>
                    {result.failed} שורות נכשלו בשמירה
                  </p>
                )}
              </div>
              <button
                onClick={handleClose}
                style={{
                  padding: "9px 28px",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none", borderRadius: "8px",
                  color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                }}
              >
                סגור
              </button>
            </div>
          )}
        </div>

        {/* Footer (preview only) */}
        {step === "preview" && validCount > 0 && (
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", justifyContent: "flex-end", gap: "8px",
            flexShrink: 0,
          }}>
            <button
              onClick={handleClose}
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
              onClick={handleImport}
              style={{
                padding: "9px 24px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: "8px",
                color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 20px rgba(99,102,241,0.3)",
              }}
            >
              יבא {validCount} לקוחות
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
