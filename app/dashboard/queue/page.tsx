import { createClient } from "@/lib/supabase/server";
import QueueList from "./queue-list";

export default async function QueuePage() {
  const supabase = await createClient();

  const { data: drafts } = await supabase
    .from("invoice_drafts")
    .select("*, client:clients(*)")
    .eq("status", "pending_review")
    .order("billing_month", { ascending: false })
    .order("created_at", { ascending: true });

  return <QueueList drafts={drafts ?? []} />;
}
