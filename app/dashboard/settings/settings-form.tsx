"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateSettingsAction, testEzcountAction, testGmailAction, type SettingsFormValues } from "./actions";
import type { AppSettingsRow } from "@/types/db";
import { CheckCircle2, AlertCircle, Eye, EyeOff, Mail, Plug, Send } from "lucide-react";
import {
  INVOICE_PLACEHOLDERS,
  DEFAULT_INVOICE_SUBJECT,
  DEFAULT_INVOICE_BODY,
  PREVIEW_VARS,
  renderTemplate,
} from "@/lib/email-templates";

const SettingsSchema = z.object({
  ezcount_api_key:       z.string().optional().nullable(),
  ezcount_api_email:     z.string().email("אימייל לא תקין"),
  gmail_refresh_token:   z.string().optional().nullable(),
  vat_rate:              z.number().min(0).max(1),
  report_send_day:       z.number().int().min(1).max(28),
  invoice_generate_day:  z.number().int().min(1).max(28),
  invoice_email_subject: z.string().optional().nullable(),
  invoice_email_body:    z.string().optional().nullable(),
});

interface Props {
  settings: AppSettingsRow;
  hasEzcountKey: boolean;
  hasGmailToken: boolean;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "11px 14px",
  fontSize: "14px",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.45)",
  marginBottom: "7px",
};

const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "rgba(255,255,255,0.35)",
  marginBottom: "20px",
};

export default function SettingsForm({ settings, hasEzcountKey, hasGmailToken }: Props) {
  const [showKey, setShowKey]     = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ezcountTest, setEzcountTest] = useState<{ state: "idle" | "testing" | "ok" | "error"; msg?: string; docUrl?: string; debug?: string }>({ state: "idle" });
  const [gmailTest, setGmailTest]     = useState<{ state: "idle" | "testing" | "ok" | "error"; msg?: string; debug?: string }>({ state: "idle" });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      ezcount_api_key:       settings.ezcount_api_key,
      ezcount_api_email:     settings.ezcount_api_email,
      gmail_refresh_token:   settings.gmail_refresh_token ?? "",
      vat_rate:              settings.vat_rate,
      report_send_day:       settings.report_send_day,
      invoice_generate_day:  settings.invoice_generate_day,
      invoice_email_subject: settings.invoice_email_subject ?? DEFAULT_INVOICE_SUBJECT,
      invoice_email_body:    settings.invoice_email_body    ?? DEFAULT_INVOICE_BODY,
    },
  });

  async function handleTestGmail() {
    setGmailTest({ state: "testing" });
    const res = await testGmailAction();
    if (res.ok) {
      setGmailTest({ state: "ok", msg: "מייל בדיקה נשלח בהצלחה", debug: res.debug });
    } else {
      setGmailTest({ state: "error", msg: res.error, debug: res.debug });
    }
  }

  async function handleTestEzcount() {
    setEzcountTest({ state: "testing" });
    const res = await testEzcountAction();
    if (res.ok) {
      setEzcountTest({ state: "ok", msg: `מסמך נוצר בהצלחה — מספר ${res.docNumber}`, docUrl: res.docUrl, debug: res.debug });
    } else {
      setEzcountTest({ state: "error", msg: res.error, debug: res.debug });
    }
  }

  async function onSubmit(values: SettingsFormValues) {
    setStatus("saving");
    setErrorMsg("");
    const result = await updateSettingsAction(values);
    if (result.ok) {
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setErrorMsg(result.error);
    }
  }

  return (
    <form onSubmit={form.handleSubmit((d) => onSubmit(d as unknown as SettingsFormValues))}>

      {/* EZCount */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>EZCount — חיבור לחשבוניות</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>API Key</label>
              {hasEzcountKey && (
                <span style={{
                  fontSize: "10px", fontWeight: 700, color: "#86efac",
                  background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.25)",
                  borderRadius: "4px", padding: "1px 7px",
                }}>
                  מוגדר ✓
                </span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                {...form.register("ezcount_api_key")}
                type={showKey ? "text" : "password"}
                dir="ltr"
                placeholder={hasEzcountKey ? "השאר ריק כדי לא לשנות" : "הכנס API key"}
                style={{ ...fieldStyle, paddingLeft: "40px" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>אימייל EZCount</label>
            <input
              {...form.register("ezcount_api_email")}
              type="email"
              dir="ltr"
              style={fieldStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
            {form.formState.errors.ezcount_api_email && (
              <p style={{ fontSize: "11px", color: "#fca5a5", marginTop: "4px" }}>{form.formState.errors.ezcount_api_email.message}</p>
            )}
          </div>
        </div>

        {/* Test button */}
        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleTestEzcount}
            disabled={ezcountTest.state === "testing"}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px",
              background: ezcountTest.state === "testing" ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "8px", color: "#a5b4fc",
              fontSize: "12px", fontWeight: 700,
              cursor: ezcountTest.state === "testing" ? "not-allowed" : "pointer",
            }}
          >
            <Plug size={13} />
            {ezcountTest.state === "testing" ? "בודק..." : "בדוק חיבור EZCount"}
          </button>

          {ezcountTest.state === "ok" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#86efac", fontSize: "12px", fontWeight: 600 }}>
                <CheckCircle2 size={14} />
                {ezcountTest.msg}
              </div>
              {ezcountTest.docUrl && (
                <a
                  href={ezcountTest.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "11px", color: "#a5b4fc", textDecoration: "underline" }}
                >
                  פתח מסמך בדיקה ↗
                </a>
              )}
            </div>
          )}
          {ezcountTest.state === "error" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fca5a5", fontSize: "12px", fontWeight: 600 }}>
                <AlertCircle size={14} />
                {ezcountTest.msg}
              </div>
              {ezcountTest.debug && (
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace", marginRight: "20px" }}>
                  {ezcountTest.debug}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Gmail */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Gmail — שליחת מיילים</p>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Gmail Refresh Token</label>
            {hasGmailToken && (
              <span style={{
                fontSize: "10px", fontWeight: 700, color: "#86efac",
                background: "rgba(134,239,172,0.1)", border: "1px solid rgba(134,239,172,0.25)",
                borderRadius: "4px", padding: "1px 7px",
              }}>
                מוגדר ✓
              </span>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <input
              {...form.register("gmail_refresh_token")}
              type={showToken ? "text" : "password"}
              dir="ltr"
              style={{ ...fieldStyle, paddingLeft: "40px" }}
              placeholder={hasGmailToken ? "השאר ריק כדי לא לשנות" : "1//0g..."}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "6px" }}>
            Token נוצר דרך Google OAuth2 — ראה הוראות חיבור
          </p>
        </div>

        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleTestGmail}
            disabled={gmailTest.state === "testing"}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px",
              background: gmailTest.state === "testing" ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "8px", color: "#a5b4fc",
              fontSize: "12px", fontWeight: 700,
              cursor: gmailTest.state === "testing" ? "not-allowed" : "pointer",
            }}
          >
            <Send size={13} />
            {gmailTest.state === "testing" ? "שולח..." : "שלח מייל בדיקה"}
          </button>

          {gmailTest.state === "ok" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#86efac", fontSize: "12px", fontWeight: 600 }}>
                <CheckCircle2 size={14} />
                {gmailTest.msg}
              </div>
              {gmailTest.debug && (
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace", marginRight: "20px" }}>
                  {gmailTest.debug}
                </p>
              )}
            </div>
          )}
          {gmailTest.state === "error" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fca5a5", fontSize: "12px", fontWeight: 600 }}>
                <AlertCircle size={14} />
                {gmailTest.msg}
              </div>
              {gmailTest.debug && (
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace", marginRight: "20px" }}>
                  {gmailTest.debug}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Billing */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>הגדרות חיוב</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>מע״מ (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              dir="ltr"
              style={fieldStyle}
              value={Math.round((form.watch("vat_rate") ?? 0.18) * 100)}
              onChange={(e) => form.setValue("vat_rate", parseFloat(e.target.value) / 100)}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
          </div>
          <div>
            <label style={labelStyle}>יום יצירת טיוטות</label>
            <input
              {...form.register("invoice_generate_day", { valueAsNumber: true })}
              type="number"
              min="1"
              max="28"
              dir="ltr"
              style={fieldStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>יום בחודש (1–28)</p>
          </div>
          <div>
            <label style={labelStyle}>יום שליחת דוחות</label>
            <input
              {...form.register("report_send_day", { valueAsNumber: true })}
              type="number"
              min="1"
              max="28"
              dir="ltr"
              style={fieldStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>יום בחודש (1–28)</p>
          </div>
        </div>
      </div>

      {/* תבנית מייל חשבונית */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={sectionTitleStyle}>תבנית מייל — חשבוניות</p>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px",
              background: showPreview ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${showPreview ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: "7px",
              color: showPreview ? "#a5b4fc" : "rgba(255,255,255,0.5)",
              fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Mail size={13} />
            {showPreview ? "סגור דוגמא" : "צפה בדוגמא"}
          </button>
        </div>

        {/* Placeholders */}
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            משתנים זמינים — לחץ להעתקה
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {INVOICE_PLACEHOLDERS.map(({ key, desc }) => (
              <button
                key={key}
                type="button"
                title={desc}
                onClick={() => navigator.clipboard?.writeText(`{{${key}}}`)}
                style={{
                  padding: "3px 10px", borderRadius: "5px", cursor: "pointer",
                  background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                  color: "#a5b4fc", fontSize: "11px", fontFamily: "monospace",
                }}
              >
                {`{{${key}}}`}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>
            לחץ על משתנה להעתקה, ואז הדבק בטקסט
          </p>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>נושא המייל</label>
          <input
            {...form.register("invoice_email_subject")}
            style={fieldStyle}
            placeholder={DEFAULT_INVOICE_SUBJECT}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          />
        </div>

        {/* Body */}
        <div>
          <label style={labelStyle}>גוף המייל</label>
          <textarea
            {...form.register("invoice_email_body")}
            rows={10}
            style={{ ...fieldStyle, resize: "vertical", lineHeight: "1.65", direction: "rtl", minHeight: "180px" }}
            placeholder={DEFAULT_INVOICE_BODY}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          />
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>
            הטקסט הזה יופיע בחלון עריכת המייל לפני כל שליחה — ניתן לערוך שם גם ברמת שליחה בודדת
          </p>
        </div>

        {/* Live preview */}
        {showPreview && (
          <div style={{
            marginTop: "20px",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 16px",
              background: "rgba(99,102,241,0.08)",
              borderBottom: "1px solid rgba(99,102,241,0.15)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <Mail size={13} style={{ color: "#a5b4fc" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#a5b4fc" }}>טיוטה לדוגמא</span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginRight: "auto" }}>
                נתונים לדוגמא בלבד — לא יישלח
              </span>
            </div>

            <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.2)" }}>
              {/* To */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "6px", alignItems: "baseline" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", width: "40px", flexShrink: 0, textAlign: "left" }}>אל:</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", direction: "ltr" }}>israel@example.com</span>
              </div>
              {/* Subject */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "baseline" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", width: "40px", flexShrink: 0, textAlign: "left" }}>נושא:</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>
                  {renderTemplate(form.watch("invoice_email_subject") || DEFAULT_INVOICE_SUBJECT, PREVIEW_VARS)}
                </span>
              </div>
              {/* Body */}
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "8px", padding: "14px 16px",
              }}>
                <pre style={{
                  fontSize: "13px", color: "rgba(255,255,255,0.75)",
                  whiteSpace: "pre-wrap", fontFamily: "inherit",
                  lineHeight: "1.7", margin: 0, direction: "rtl",
                }}>
                  {renderTemplate(form.watch("invoice_email_body") || DEFAULT_INVOICE_BODY, PREVIEW_VARS)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          type="submit"
          disabled={status === "saving"}
          style={{
            padding: "11px 28px",
            background: status === "saving" ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "13px",
            fontWeight: 700,
            cursor: status === "saving" ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
            boxShadow: status === "saving" ? "none" : "0 0 20px rgba(99,102,241,0.3)",
          }}
        >
          {status === "saving" ? "שומר..." : "שמור הגדרות"}
        </button>

        {status === "ok" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#86efac", fontSize: "13px", fontWeight: 600 }}>
            <CheckCircle2 size={15} />
            נשמר בהצלחה
          </div>
        )}
        {status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fca5a5", fontSize: "13px", fontWeight: 600 }}>
            <AlertCircle size={15} />
            {errorMsg}
          </div>
        )}
      </div>
    </form>
  );
}
