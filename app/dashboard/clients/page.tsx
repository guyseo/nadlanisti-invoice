import { createClient } from "@/lib/supabase/server";
import ClientList from "./client-list";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*, lines:invoice_line_templates(*)")
    .order("name");

  return <ClientList clients={clients ?? []} />;
}
