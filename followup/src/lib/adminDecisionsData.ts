import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { getTesterHealth } from "@/lib/testerHealth";
import { getProductUsage } from "@/lib/admin-usage";
import { getNotCustomerStats } from "@/lib/notCustomerStats";
import { buildDecisions, type Decision } from "@/lib/adminDecisions";

/** The decisions on /admin, read from the same numbers its places show. Founder only. */
export async function getDecisions(): Promise<Decision[]> {
  await requirePlatformAdmin();
  const [health, usage, notCustomer] = await Promise.all([getTesterHealth(), getProductUsage(), getNotCustomerStats(30)]);
  return buildDecisions({ health, usage, notCustomer });
}
