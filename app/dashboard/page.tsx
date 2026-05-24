import { createClient } from "@/lib/supabase/server";
import { Users, FileText, ClipboardList, Mail } from "lucide-react";
import { Suspense } from "react";

async function DashboardStats() {
  const supabase = await createClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { count: activeClients },
    { count: pendingDrafts },
    { count: invoicesThisMonth },
    { count: emailsSent },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("invoice_drafts").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("invoices_sent").select("*", { count: "exact", head: true }).gte("sent_at", startOfMonth),
    supabase.from("email_log").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
  ]);

  const stats = [
    { label: "לקוחות פעילים",    value: activeClients ?? 0,     icon: Users,         highlight: false },
    { label: "ממתינות לאישור",   value: pendingDrafts ?? 0,     icon: ClipboardList, highlight: true  },
    { label: "חשבוניות החודש",   value: invoicesThisMonth ?? 0, icon: FileText,      highlight: false },
    { label: "מיילים החודש",     value: emailsSent ?? 0,        icon: Mail,          highlight: false },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
      {stats.map(({ label, value, icon: Icon, highlight }) => (
        <div
          key={label}
          style={{
            padding: "20px 24px",
            background: highlight && value > 0
              ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))"
              : "rgba(255,255,255,0.03)",
            border: highlight && value > 0
              ? "1px solid rgba(99,102,241,0.4)"
              : "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: highlight && value > 0 ? "0 0 24px rgba(99,102,241,0.15)" : "none",
          }}
        >
          <Icon style={{ width: "18px", height: "18px", opacity: 0.5, color: highlight && value > 0 ? "#a5b4fc" : "white" }} />
          <p style={{ fontSize: "40px", fontWeight: 900, lineHeight: 1, color: highlight && value > 0 ? "#a5b4fc" : "white" }}>
            {value}
          </p>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ padding: "20px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px" }}>
          <div style={{ width: "18px", height: "18px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", marginBottom: "12px" }} className="animate-pulse" />
          <div style={{ width: "60px", height: "40px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", marginBottom: "12px" }} className="animate-pulse" />
          <div style={{ width: "80px", height: "11px", background: "rgba(255,255,255,0.08)", borderRadius: "4px" }} className="animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const monthName = now.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: "800px" }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(99,102,241,0.8)", marginBottom: "8px" }}>
          {monthName}
        </p>
        <h1 style={{ fontSize: "42px", fontWeight: 900, lineHeight: 1.1, color: "white", letterSpacing: "-0.02em" }}>
          שלום, גיא.
        </h1>
      </div>

      {/* Stats */}
      <div>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: "16px" }}>
          סקירה חודשית
        </p>
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardStats />
        </Suspense>
      </div>
    </div>
  );
}
