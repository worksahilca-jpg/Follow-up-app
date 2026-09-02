import { getLeads } from "@/lib/leads-data";
import PipelinePageClient from "./PipelinePageClient";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const leads = await getLeads();
  return <PipelinePageClient leads={leads} />;
}
