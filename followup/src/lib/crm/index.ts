import type { CrmClient } from "./types";
import { followUpBossClient } from "./followupboss";
import { hubspotClient } from "./hubspot";
import { goHighLevelClient } from "./gohighlevel";

export type CrmProvider = "followupboss" | "hubspot" | "gohighlevel";

export const CRM_PROVIDERS: Record<CrmProvider, { label: string; client: CrmClient }> = {
  followupboss: { label: "Follow Up Boss", client: followUpBossClient },
  hubspot: { label: "HubSpot", client: hubspotClient },
  gohighlevel: { label: "GoHighLevel", client: goHighLevelClient },
};

export function isCrmProvider(value: string): value is CrmProvider {
  return value === "followupboss" || value === "hubspot" || value === "gohighlevel";
}

export type { CrmClient, CrmPerson } from "./types";
