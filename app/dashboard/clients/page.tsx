import { createClient } from "@/lib/supabase/server";
import ClientList from "./client-list";

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("*, lines:invoice_line_templates(*)").order("name"),
    supabase.from("app_settings").select("vat_rate").eq("id", 1).single(),
  ]);

  return <ClientList clients={clients ?? []} vatRate={settings?.vat_rate ?? 0.18} />;
}
