"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, ClipboardList, FileText, BarChart3, Settings, LogOut } from "lucide-react";

const navItems = [
  { href: "/dashboard",          label: "סקירה כללית", icon: BarChart3, exact: true },
  { href: "/dashboard/clients",  label: "לקוחות",      icon: Users },
  { href: "/dashboard/queue",    label: "תור אישור",   icon: ClipboardList },
  { href: "/dashboard/invoices", label: "חשבוניות",    icon: FileText },
  { href: "/dashboard/settings", label: "הגדרות",      icon: Settings },
];

export default function DashboardSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside
      dir="rtl"
      style={{
        width: "240px",
        minWidth: "240px",
        minHeight: "100vh",
        background: "#0a0a12",
        color: "white",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(99,102,241,0.15)",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, boxShadow: "0 0 20px rgba(99,102,241,0.4)"
          }}>
            <span style={{ fontSize: "14px", fontWeight: 900, color: "white" }}>N</span>
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: "white", lineHeight: 1 }}>
              Nadlanisti
            </p>
            <p style={{ fontSize: "10px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.35)", marginTop: "3px" }}>
              נדלניסטי 360
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: "1px" }}>
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "13px",
                transition: "all 0.15s",
                background: active ? "rgba(99,102,241,0.15)" : "transparent",
                color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)",
                borderLeft: active ? "2px solid #6366f1" : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                }
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px" }}>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", padding: "0 12px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "ltr", textAlign: "right" }}>
          {userEmail}
        </p>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 12px",
            background: "transparent",
            border: "none",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.3)",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.15s",
            direction: "rtl",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.1)";
            e.currentTarget.style.color = "#fca5a5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.3)";
          }}
        >
          <LogOut size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span>התנתק</span>
        </button>
      </div>
    </aside>
  );
}
