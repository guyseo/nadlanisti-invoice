import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <div dir="ltr" style={{ display: "flex", minHeight: "100vh", background: "#080810" }}>
      <main dir="rtl" style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <div style={{ padding: "40px 48px", maxWidth: "960px" }}>
          {children}
        </div>
      </main>
      <DashboardSidebar userEmail={user.email ?? ""} />
    </div>
  );
}
