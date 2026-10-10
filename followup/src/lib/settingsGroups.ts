/**
 * Settings' side list (A-212, A-213): the follow-up plan, then four groups.
 * Every setting's page (src/app/(app)/settings/page.tsx, PAGES) sits in one
 * group, so a link to any page (/settings#billing) lights up the right one.
 * The app map (design-brain/components/app-map.md) is where new settings go.
 */
export const SETTINGS_GROUPS = ["Follow-up plan", "Where customers write", "How it writes", "Your business", "Account"] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];
const GROUP_OF_PAGE: Record<string, SettingsGroup> = {
  email: "Where customers write",
  website: "Where customers write",
  social: "Where customers write",
  replies: "How it writes",
  booking: "How it writes",
  pause: "How it writes",
  business: "Your business",
  team: "Your business",
  billing: "Your business",
  security: "Account",
  data: "Account",
  advanced: "Account",
};
/** Which group a setting's page sits in; null for one that sits outside the groups (feedback). */
export function groupOfPage(page: string): SettingsGroup | null {
  return GROUP_OF_PAGE[page] ?? null;
}
