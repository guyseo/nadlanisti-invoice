"use client";

import { useState } from "react";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, FileSpreadsheet, Zap, ZapOff, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ClientForm from "./client-form";
import CsvImportModal from "./csv-import-modal";
import ManualSendModal from "./manual-send-modal";
import { toggleClientActiveAction, toggleAutomationAction, deleteClientAction } from "./actions";
import { BILLING_TYPE_LABELS, DOC_TYPE_LABELS } from "@/lib/types";
import type { ClientRow, LineTemplateRow } from "@/types/db";

type ClientWithLines = ClientRow & { lines: LineTemplateRow[] };

interface Props {
  clients: ClientWithLines[];
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "6px",
  cursor: "pointer",
  color: "rgba(255,255,255,0.45)",
  transition: "all 0.15s",
};

export default function ClientList({ clients }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithLines | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ClientWithLines | null>(null);
  const [manualSendTarget, setManualSendTarget] = useState<ClientWithLines | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const visible = showInactive ? clients : clients.filter((c) => c.active);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(client: ClientWithLines) {
    setEditing(client);
    setFormOpen(true);
  }

  async function handleToggleActive(client: ClientWithLines) {
    await toggleClientActiveAction(client.id, !client.active);
  }

  async function handleToggleAutomation(client: ClientWithLines) {
    await toggleAutomationAction(client.id, !client.automation_active);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteClientAction(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>לקוחות</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "6px" }}>
            {clients.filter((c) => c.active).length} פעילים · {clients.filter((c) => !c.active).length} בארכיון
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowInactive((v) => !v)}
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "rgba(255,255,255,0.6)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {showInactive ? "הסתר ארכיון" : "הצג ארכיון"}
          </button>
          <button
            onClick={() => setCsvOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: "8px",
              color: "#a5b4fc",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FileSpreadsheet size={14} />
            יבא CSV
          </button>
          <button
            onClick={openCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(99,102,241,0.3)",
            }}
          >
            <Plus size={14} />
            לקוח חדש
          </button>
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div style={{
          border: "1px dashed rgba(255,255,255,0.1)",
          borderRadius: "12px",
          padding: "60px",
          textAlign: "center",
        }}>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>אין לקוחות — הוסף את הראשון</p>
        </div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["שם", "אימייל", "סוג חיוב", "סכום", "מסמך", "שורות", "מצב", "אוטומציה", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 7 ? "center" : "right", padding: "10px 14px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((client) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    opacity: client.active ? 1 : 0.45,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "white" }}>{client.name}</td>
                  <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>{client.email}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px",
                      background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)"
                    }}>
                      {BILLING_TYPE_LABELS[client.billing_type]}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>
                    {client.billing_type === "fixed" && client.monthly_fee
                      ? `₪${client.monthly_fee.toLocaleString()}`
                      : client.billing_type === "media_commission"
                      ? `${((client.commission_rate ?? 0.09) * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                    {DOC_TYPE_LABELS[client.doc_type]}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>
                    {client.lines.length}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {client.active ? (
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", background: "rgba(34,197,94,0.1)", color: "#86efac", border: "1px solid rgba(34,197,94,0.2)" }}>
                        פעיל
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        ארכיון
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => handleToggleAutomation(client)}
                      title={client.automation_active ? "כבה אוטומציה" : "הפעל אוטומציה"}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "3px 9px", borderRadius: "5px", cursor: "pointer",
                        fontSize: "11px", fontWeight: 600, border: "1px solid",
                        background: client.automation_active
                          ? "rgba(99,102,241,0.1)" : "rgba(239,68,68,0.08)",
                        borderColor: client.automation_active
                          ? "rgba(99,102,241,0.25)" : "rgba(239,68,68,0.2)",
                        color: client.automation_active ? "#a5b4fc" : "rgba(239,68,68,0.7)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "0.75";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                    >
                      {client.automation_active
                        ? <><Zap size={10} /> פעיל</>
                        : <><ZapOff size={10} /> כבוי</>}
                    </button>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                      <button
                        style={btnBase}
                        onClick={() => openEdit(client)}
                        title="ערוך"
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; e.currentTarget.style.color = "#a5b4fc"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        style={{ ...btnBase, border: "1px solid rgba(99,102,241,0.2)" }}
                        onClick={() => setManualSendTarget(client)}
                        title="שלח ידנית"
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; e.currentTarget.style.color = "#a5b4fc"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                      >
                        <Send size={12} />
                      </button>
                      <button
                        style={btnBase}
                        onClick={() => handleToggleActive(client)}
                        title={client.active ? "העבר לארכיון" : "שחזר"}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                      >
                        {client.active ? <Archive size={12} /> : <ArchiveRestore size={12} />}
                      </button>
                      <button
                        style={{ ...btnBase, border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.5)" }}
                        onClick={() => setDeleteTarget(client)}
                        title="מחק"
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#fca5a5"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(239,68,68,0.5)"; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        client={editing}
      />

      {/* CSV Import */}
      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} />

      {/* Manual Send */}
      {manualSendTarget && (
        <ManualSendModal client={manualSendTarget} onClose={() => setManualSendTarget(null)} />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "white", fontWeight: 800 }}>מחיקת לקוח</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
              האם למחוק את <strong style={{ color: "white" }}>{deleteTarget?.name}</strong>? לא ניתן לשחזר לקוח עם חשבוניות קיימות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white" }}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ background: "rgba(239,68,68,0.8)", border: "none", borderRadius: "8px", color: "white", fontWeight: 700 }}
              onClick={handleDelete}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
