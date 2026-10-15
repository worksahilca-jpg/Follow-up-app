/**
 * Settings in five places (A-220, the phone redesign): four rows (where
 * customers write, how replies go out, alerts, your business), then More.
 * Since A-253 the first four each open one page; only More opens a list.
 * The same five on the phone's list and the desk's side list (A-222: same
 * words, each its own layout). Every setting's page (src/app/(app)/settings/
 * page.tsx, PAGES) sits in one group, so a link to any page (/settings#billing)
 * lights up the right one. The app map (design-brain/components/app-map.md) is
 * where new settings go.
 */
export const SETTINGS_GROUPS = ["Connected apps", "Sending replies", "Alerts", "Your business", "Account"] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];
const GROUP_OF_PAGE: Record<string, SettingsGroup> = {
  // One page each since A-253: every place customers write is a row with Connect or Connected, and how replies go
  // out is two choices and three rows.
  connections: "Connected apps",
  replies: "Sending replies",
  booking: "Sending replies",
  alerts: "Alerts",
  business: "Your business",
  team: "Account",
  billing: "Account",
  security: "Account",
  data: "Account",
  // Not listed in More (A-253: owners never see it); a direct link still opens it.
  advanced: "Account",
};
/** A group that is one page opens that page straight away; the rest open a short list first. */
export const GROUP_PAGE: Partial<Record<SettingsGroup, string>> = {
  "Connected apps": "connections",
  "Sending replies": "replies",
  Alerts: "alerts",
  "Your business": "business",
};
/** A page opened from another page (not from a group's list): its "←" goes back there. */
export const PARENT_PAGE: Record<string, string> = { booking: "replies" };
/** Each group's address, so the phone's Back button steps from a page to its group to Settings. */
export const GROUP_SLUG: Record<SettingsGroup, string> = {
  "Connected apps": "write",
  "Sending replies": "replies-out",
  Alerts: "alerts",
  "Your business": "business",
  Account: "more",
};
/** Which group a setting's page sits in. */
export function groupOfPage(page: string): SettingsGroup | null {
  return GROUP_OF_PAGE[page] ?? null;
}
/** The group a #hash names, for the groups that open a list. */
export function groupOfSlug(slug: string): SettingsGroup | null {
  const g = (Object.keys(GROUP_SLUG) as SettingsGroup[]).find((k) => GROUP_SLUG[k] === slug);
  return g && !GROUP_PAGE[g] ? g : null;
}
