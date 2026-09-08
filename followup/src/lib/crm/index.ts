import type { CrmClient } from "./types";
import { followUpBossClient } from "./followupboss";
import { hubspotClient } from "./hubspot";

export type CrmProvider = "followupboss" | "hubspot";

export const CRM_PROVIDERS: Record<CrmProvider, { label: string; client: CrmClient }> = {
  followupboss: { label: "Follow Up Boss", client: followUpBossClient },
  hubspot: { label: "HubSpot", client: hubspotClient },
};

export function isCrmProvider(value: string): value is CrmProvider {
  return value === "followupboss" || value === "hubspot";
}

export type { CrmClient, CrmPerson } from "./types";
