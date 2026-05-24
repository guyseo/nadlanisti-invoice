"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X, ChevronDown, Check, RotateCcw } from "lucide-react";
import {
  INVOICE_PLACEHOLDERS,
  DEFAULT_INVOICE_SUBJECT,
  DEFAULT_INVOICE_BODY,
  PREVIEW_VARS,
  renderTemplate,
} from "@/lib/email-templates";
import { createClientAction, updateClientAction, type ClientFormValues } from "./actions";
import type { ClientRow, LineTemplateRow } from "@/types/db";

const emailOrEmpty = z.union([z.literal(""), z.string().email("אימייל לא תקין")]).optional().nullable();

const LineSchema = z.object({
  description: z.string().min(1, "חובה"),
  amount: z.coerce.number().positive("חובה מספר חיובי"),
  quantity: z.coerce.number().int().positive().default(1),
  sort_order: z.number().int().default(0),
});

const FormSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  email: z.string().email("אימייל לא תקין"),
  phone: z.string().optional(),
  billing_type: z.enum(["fixed", "media_commission", "auto_cc"]),
  email_delivery_mode: z.enum(["combined", "separate"]),
  monthly_fee: z.coerce.number().positive().optional().nullable(),
  commission_rate: z.coerce.number().min(0).max(1).optional().nullable(),
  doc_type: z.union([z.literal(300), z.literal(305), z.literal(320), z.literal(400)]),
  invoice_email: emailOrEmpty,
  report_email: emailOrEmpty,
  invoice_email_subject: z.string().optional().nullable(),
  invoice_email_body: z.string().optional().nullable(),
  ezcount_customer_name: z.string().optional().nullable(),
  ezcount_client_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(LineSchema).default([]),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  client?: ClientRow & { lines: LineTemplateRow[] };
}

/* ── shared input style ── */
const inp: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "9px 12px",
  fontSize: "13px",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  marginBottom: "6px",
};

/* ── Custom Select ── */
interface SelectOption { value: string; label: string }
interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}

function CustomSelect({ value, onChange, options }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: open ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "8px",
          padding: "9px 12px",
          fontSize: "13px",
          color: "white",
          cursor: "pointer",
          textAlign: "right",
          fontFamily: "inherit",
          boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.1)" : "none",
        }}
      >
        <span>{selected?.label ?? "בחר..."}</span>
        <ChevronDown
          size={13}
          style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0,
          zIndex: 100,
          background: "#131320",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)",
        }}>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px",
                  background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                  border: "none",
                  color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.75)",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "right",
                  fontFamily: "inherit",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span>{opt.label}</span>
                {isActive && <Check size={12} style={{ flexShrink: 0, color: "#a5b4fc" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main form ── */
export default function ClientForm({ open, onClose, client }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!client;

  const form = useForm<FormValues>({
    // @ts-expect-error zod v4 + hookform resolver type mismatch
    resolver: zodResolver(FormSchema),
    defaultValues: client
      ? {
          name: client.name,
          email: client.email,
          phone: client.phone ?? "",
          billing_type: client.billing_type,
          email_delivery_mode: client.email_delivery_mode,
          monthly_fee: client.monthly_fee ?? undefined,
          commission_rate: client.commission_rate ?? 0.09,
          doc_type: client.doc_type,
          invoice_email: client.invoice_email ?? "",
          report_email: client.report_email ?? "",
          invoice_email_subject: client.invoice_email_subject ?? "",
          invoice_email_body: client.invoice_email_body ?? "",
          ezcount_customer_name: client.ezcount_customer_name ?? "",
          ezcount_client_id: client.ezcount_client_id ?? "",
          notes: client.notes ?? "",
          lines: client.lines.map((l) => ({
            description: l.description,
            amount: l.amount,
            quantity: l.quantity,
            sort_order: l.sort_order,
          })),
        }
      : {
          billing_type: "fixed",
          email_delivery_mode: "separate",
          doc_type: 320,
          commission_rate: 0.09,
          lines: [],
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const billingType = form.watch("billing_type");

  useEffect(() => {
    if (open && !client) form.reset({
      billing_type: "fixed",
      email_delivery_mode: "separate",
      doc_type: 320,
      commission_rate: 0.09,
      lines: [],
    });
  }, [open, client, form]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function onSubmit(values: FormValues): Promise<void> {
    setLoading(true);
    setError(null);
    const payload = values as ClientFormValues;
    const result = isEdit
      ? await updateClientAction(client.id, payload)
      : await createClientAction(payload);
    setLoading(false);
    if (result.success) {
      onClose();
      form.reset();
    } else {
      setError(result.error ?? "שגיאה לא ידועה");
    }
  }

  if (!open) return null;

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
        width: "100%", maxWidth: "640px",
        maxHeight: "90vh", overflowY: "auto",
        background: "#0d0d18",
        border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: "14px",
        boxShadow: "0 0 60px rgba(99,102,241,0.12), 0 24px 48px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "white", margin: 0 }}>
              {isEdit ? "עריכת לקוח" : "לקוח חדש"}
            </h2>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
              {isEdit ? "עדכן פרטי לקוח קיים" : "הוסף לקוח חדש למערכת"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px", padding: "6px", cursor: "pointer",
              color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={form.handleSubmit((d) => onSubmit(d as unknown as FormValues))}
          style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* פרטים בסיסיים */}
          <Section title="פרטים בסיסיים">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="שם לקוח *" error={form.formState.errors.name?.message}>
                <input {...form.register("name")} style={inp} placeholder="שם מלא"
                  onFocus={focusOn} onBlur={focusOff} />
              </Field>
              <Field label="אימייל *" error={form.formState.errors.email?.message}>
                <input {...form.register("email")} type="email" dir="ltr" style={inp} placeholder="client@email.com"
                  onFocus={focusOn} onBlur={focusOff} />
              </Field>
              <Field label="טלפון">
                <input {...form.register("phone")} dir="ltr" style={inp} placeholder="05X-XXXXXXX"
                  onFocus={focusOn} onBlur={focusOff} />
              </Field>
              <div />
              <Field
                label="שם לקוח ב-EZCount ✱"
                error={form.formState.errors.ezcount_customer_name?.message}
              >
                <input {...form.register("ezcount_customer_name")} style={inp}
                  placeholder="השם בדיוק כפי שמופיע ב-EZCount"
                  onFocus={focusOn} onBlur={focusOff} />
              </Field>
              <Field label="מזהה לקוח ב-EZCount (ID)">
                <input {...form.register("ezcount_client_id")} dir="ltr" style={inp} placeholder="מספרי — אופציונלי"
                  onFocus={focusOn} onBlur={focusOff} />
              </Field>
            </div>
          </Section>

          {/* הגדרות חיוב */}
          <Section title="הגדרות חיוב">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="סוג חיוב *">
                <CustomSelect
                  value={form.watch("billing_type")}
                  onChange={(v) => form.setValue("billing_type", v as FormValues["billing_type"])}
                  options={[
                    { value: "fixed", label: "ריטיינר קבוע" },
                    { value: "media_commission", label: "עמלת מדיה (9%)" },
                    { value: "auto_cc", label: "אוטומטי (CC)" },
                  ]}
                />
              </Field>

              {billingType === "fixed" && (
                <Field label="סכום חודשי (₪)" error={form.formState.errors.monthly_fee?.message}>
                  <input {...form.register("monthly_fee")} type="number" step="0.01" min="0" dir="ltr"
                    style={inp} placeholder="5000" onFocus={focusOn} onBlur={focusOff} />
                </Field>
              )}
              {billingType === "media_commission" && (
                <Field label="% עמלה (0–1)" error={form.formState.errors.commission_rate?.message}>
                  <input {...form.register("commission_rate")} type="number" step="0.01" min="0" max="1" dir="ltr"
                    style={inp} placeholder="0.09" onFocus={focusOn} onBlur={focusOff} />
                </Field>
              )}
              {billingType === "auto_cc" && <div />}

              <Field label="סוג מסמך">
                <CustomSelect
                  value={String(form.watch("doc_type"))}
                  onChange={(v) => form.setValue("doc_type", Number(v) as 300 | 305 | 320 | 400)}
                  options={[
                    { value: "300", label: "חשבונית עסקה" },
                    { value: "305", label: "חשבונית מס" },
                    { value: "320", label: "חשבונית מס קבלה" },
                    { value: "400", label: "קבלה" },
                  ]}
                />
              </Field>
            </div>
          </Section>

          {/* הגדרות מייל */}
          <Section title="הגדרות מייל">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

              {/* חשבוניות */}
              <EmailDestRow
                label="חשבוניות"
                icon="📄"
                hint="לאן ישלחו החשבוניות עם הקישור ל-EZCount"
                mainEmail={form.watch("email")}
                separateValue={form.watch("invoice_email") ?? ""}
                onClear={() => form.setValue("invoice_email", "")}
                inputProps={form.register("invoice_email")}
                error={form.formState.errors.invoice_email?.message}
              />

              {/* דוחות */}
              <EmailDestRow
                label="דוחות חודשיים"
                icon="📊"
                hint="לאן ישלחו הדוחות החודשיים"
                mainEmail={form.watch("email")}
                separateValue={form.watch("report_email") ?? ""}
                onClear={() => form.setValue("report_email", "")}
                inputProps={form.register("report_email")}
                error={form.formState.errors.report_email?.message}
              />

              {/* אופן שליחה */}
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "10px", padding: "14px 16px",
              }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: "10px" }}>
                  🗓 מתי נשלח הכל?
                </p>
                <CustomSelect
                  value={form.watch("email_delivery_mode")}
                  onChange={(v) => form.setValue("email_delivery_mode", v as "combined" | "separate")}
                  options={[
                    { value: "separate", label: "חשבונית — מיד עם האישור  |  דוח — ב-1 לחודש בנפרד" },
                    { value: "combined", label: "חשבונית + דוח — ביחד ב-1 לחודש" },
                  ]}
                />
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "8px", lineHeight: 1.6 }}>
                  {form.watch("email_delivery_mode") === "separate"
                    ? "אחרי שתאשר בתור — תפתח חלון לעריכת המייל ושליחה מיידית. הדוח יישלח בנפרד ב-1 לחודש."
                    : "החשבונית תיווצר מיד עם האישור, אך תישלח ללקוח ב-1 לחודש ביחד עם הדוח החודשי."}
                </p>
              </div>
            </div>
          </Section>

          {/* שורות חיוב */}
          <Section
            title="שורות חיוב קבועות"
            action={
              <button
                type="button"
                onClick={() => append({ description: "", amount: 0, quantity: 1, sort_order: fields.length })}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "4px 10px",
                  background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: "6px", color: "#a5b4fc", fontSize: "11px", fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={11} />
                הוסף שורה
              </button>
            }
          >
            {fields.length === 0 ? (
              <div style={{
                border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "8px",
                padding: "16px", textAlign: "center",
                color: "rgba(255,255,255,0.25)", fontSize: "12px",
              }}>
                אין שורות — יצטרך למלא ידנית בכל טיוטה
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px 36px", gap: "8px" }}>
                  {["תיאור", "סכום ₪", "כמות", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>{h}</span>
                  ))}
                </div>
                {fields.map((field, i) => (
                  <div key={field.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px 36px", gap: "8px", alignItems: "start" }}>
                    <div>
                      <input {...form.register(`lines.${i}.description`)} placeholder="תיאור השירות"
                        style={inp} onFocus={focusOn} onBlur={focusOff} />
                      {form.formState.errors.lines?.[i]?.description && (
                        <p style={{ fontSize: "10px", color: "#fca5a5", marginTop: "3px" }}>
                          {form.formState.errors.lines[i]?.description?.message}
                        </p>
                      )}
                    </div>
                    <input {...form.register(`lines.${i}.amount`)} type="number" step="0.01" min="0" dir="ltr"
                      placeholder="0.00" style={inp} onFocus={focusOn} onBlur={focusOff} />
                    <input {...form.register(`lines.${i}.quantity`)} type="number" min="1" dir="ltr"
                      placeholder="1" style={inp} onFocus={focusOn} onBlur={focusOff} />
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      style={{
                        width: "36px", height: "36px",
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                        borderRadius: "8px", cursor: "pointer",
                        color: "rgba(239,68,68,0.6)",
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
          </Section>

          {/* תבנית מייל */}
          <ClientEmailTemplate form={form} />

          {/* הערות */}
          <Section title="הערות">
            <textarea
              {...form.register("notes")}
              rows={2}
              placeholder="הערות נוספות (אופציונלי)"
              style={{ ...inp, resize: "none", lineHeight: "1.5" }}
              onFocus={focusOn} onBlur={focusOff}
            />
          </Section>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "8px", padding: "10px 14px",
              fontSize: "13px", color: "#fca5a5", fontWeight: 500,
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
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={loading}
              style={{
                padding: "9px 24px",
                background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", borderRadius: "8px",
                color: "white", fontSize: "13px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 20px rgba(99,102,241,0.3)",
              }}
            >
              {loading ? "שומר..." : isEdit ? "שמור שינויים" : "צור לקוח"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)";
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.boxShadow = "none";
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", margin: 0 }}>
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── Per-client email template ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClientEmailTemplate({ form }: { form: any }) {
  const [showPreview, setShowPreview] = useState(false);
  const subject = form.watch("invoice_email_subject") as string ?? "";
  const body    = form.watch("invoice_email_body")    as string ?? "";
  const hasCustom = subject.trim().length > 0 || body.trim().length > 0;

  function activate() {
    if (!hasCustom) {
      form.setValue("invoice_email_subject", DEFAULT_INVOICE_SUBJECT);
      form.setValue("invoice_email_body",    DEFAULT_INVOICE_BODY);
    }
  }

  function reset() {
    form.setValue("invoice_email_subject", "");
    form.setValue("invoice_email_body",    "");
    setShowPreview(false);
  }

  return (
    <Section title="תבנית מייל">
      {/* Toggle: global vs custom */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "7px 16px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            background: !hasCustom ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
            borderColor: !hasCustom ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
            color: !hasCustom ? "#a5b4fc" : "rgba(255,255,255,0.35)",
          }}
        >
          {!hasCustom && "✓ "}תבנית גלובלית
        </button>
        <button
          type="button"
          onClick={activate}
          style={{
            padding: "7px 16px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            background: hasCustom ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
            borderColor: hasCustom ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
            color: hasCustom ? "#a5b4fc" : "rgba(255,255,255,0.35)",
          }}
        >
          {hasCustom && "✓ "}תבנית מותאמת אישית
        </button>
      </div>

      {!hasCustom ? (
        <div style={{
          padding: "12px 16px", borderRadius: "8px",
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
          fontSize: "12px", color: "rgba(255,255,255,0.3)",
        }}>
          המייל יישלח לפי התבנית הגלובלית שמוגדרת בהגדרות — לחץ על "תבנית מותאמת אישית" כדי לדרוס
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Placeholders */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {INVOICE_PLACEHOLDERS.map(({ key, desc }) => (
              <button
                key={key}
                type="button"
                title={desc}
                onClick={() => navigator.clipboard?.writeText(`{{${key}}}`)}
                style={{
                  padding: "2px 8px", borderRadius: "4px", cursor: "pointer",
                  background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)",
                  color: "#a5b4fc", fontSize: "10px", fontFamily: "monospace",
                }}
              >
                {`{{${key}}}`}
              </button>
            ))}
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", alignSelf: "center", marginRight: "4px" }}>
              לחץ להעתקה
            </span>
          </div>

          {/* Subject */}
          <div>
            <label style={{ ...lbl }}>נושא</label>
            <input
              {...form.register("invoice_email_subject")}
              style={inp}
              placeholder={DEFAULT_INVOICE_SUBJECT}
              onFocus={focusOn} onBlur={focusOff}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ ...lbl }}>גוף המייל</label>
            <textarea
              {...form.register("invoice_email_body")}
              rows={8}
              style={{ ...inp, resize: "vertical", lineHeight: "1.65", direction: "rtl" }}
              placeholder={DEFAULT_INVOICE_BODY}
              onFocus={focusOn} onBlur={focusOff}
            />
          </div>

          {/* Actions row */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              style={{
                padding: "6px 14px", borderRadius: "7px", fontSize: "11px", fontWeight: 600,
                cursor: "pointer",
                background: showPreview ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${showPreview ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.1)"}`,
                color: showPreview ? "#a5b4fc" : "rgba(255,255,255,0.45)",
              }}
            >
              {showPreview ? "סגור דוגמא" : "צפה בדוגמא"}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "6px 12px", borderRadius: "7px", fontSize: "11px",
                cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              <RotateCcw size={11} />
              חזור לגלובלי
            </button>
          </div>

          {/* Preview */}
          {showPreview && (
            <div style={{
              border: "1px solid rgba(99,102,241,0.2)", borderRadius: "10px", overflow: "hidden",
            }}>
              <div style={{
                padding: "8px 14px",
                background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.15)",
                fontSize: "11px", fontWeight: 700, color: "#a5b4fc",
                display: "flex", justifyContent: "space-between",
              }}>
                <span>טיוטה לדוגמא</span>
                <span style={{ fontSize: "10px", fontWeight: 400, color: "rgba(255,255,255,0.25)" }}>נתונים לדוגמא בלבד</span>
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)" }}>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px" }}>
                  נושא: <strong style={{ color: "white" }}>
                    {renderTemplate(subject || DEFAULT_INVOICE_SUBJECT, PREVIEW_VARS)}
                  </strong>
                </p>
                <pre style={{
                  fontSize: "12px", color: "rgba(255,255,255,0.65)",
                  whiteSpace: "pre-wrap", fontFamily: "inherit",
                  lineHeight: "1.65", margin: "10px 0 0", direction: "rtl",
                }}>
                  {renderTemplate(body || DEFAULT_INVOICE_BODY, PREVIEW_VARS)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

interface EmailDestRowProps {
  label: string;
  icon: string;
  hint: string;
  mainEmail: string;
  separateValue: string;
  onClear: () => void;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  error?: string;
}

function EmailDestRow({ label, icon, hint, mainEmail, separateValue, onClear, inputProps, error }: EmailDestRowProps) {
  const hasValue = separateValue.trim().length > 0;
  const [showInput, setShowInput] = useState(hasValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // when form resets externally and value goes empty, hide input
  useEffect(() => {
    if (!hasValue) setShowInput(false);
  }, [hasValue]);

  function handleSeparate() {
    setShowInput(true);
    setTimeout(() => containerRef.current?.querySelector("input")?.focus(), 30);
  }

  function handleMain() {
    setShowInput(false);
    onClear();
  }

  const active = showInput || hasValue;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "10px", padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: 0 }}>
          {icon} {label}
        </p>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{hint}</span>
      </div>

      {/* Toggle pills */}
      <div style={{ display: "flex", gap: "6px", marginBottom: active ? "10px" : "0" }}>
        <button
          type="button"
          onClick={handleMain}
          style={{
            padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            background: !active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
            borderColor: !active ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
            color: !active ? "#a5b4fc" : "rgba(255,255,255,0.35)",
          }}
        >
          {!active ? "✓ " : ""}אימייל ראשי
        </button>
        <button
          type="button"
          onClick={handleSeparate}
          style={{
            padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
            borderColor: active ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
            color: active ? "#a5b4fc" : "rgba(255,255,255,0.35)",
          }}
        >
          {active ? "✓ " : ""}כתובת אחרת
        </button>
      </div>

      {!active ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 11px", borderRadius: "7px",
          background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>✉</span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", direction: "ltr" }}>
            {mainEmail || "הזן אימייל ראשי למעלה"}
          </span>
        </div>
      ) : (
        <div ref={containerRef}>
          <input
            {...inputProps}
            type="email"
            dir="ltr"
            placeholder="other@example.com"
            style={inp}
            onFocus={focusOn}
            onBlur={focusOff}
          />
          {error && <p style={{ fontSize: "10px", color: "#fca5a5", marginTop: "4px" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
      {error && <p style={{ fontSize: "10px", color: "#fca5a5", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}
