import { getLeads } from "@/lib/leads-data";
import LeadsPageClient from "./LeadsPageClient";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsPageClient leads={leads} />;
}
