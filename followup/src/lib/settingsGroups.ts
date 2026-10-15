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

/** The sections each page shows, by page id (the page's titles and words live in settings/page.tsx). */
export const PAGE_SECTIONS: Record<string, string[]> = {
  connections: ["connections"],
  replies: ["replies-out"],
  booking: ["booking"],
  alerts: ["alerts"],
  business: ["business"],
  team: ["team"],
  billing: ["billing"],
  security: ["security"],
  data: ["data"],
  advanced: ["lead-webhook", "outbound-webhook", "phone", "lead-routing"],
};

/**
 * Old addresses still land where their setting lives now: the setup steps
 * (#integrations, #website-widget), the sign-in and alert emails, and the
 * Meta and Google sign-ins coming back (#social, #email).
 */
const ALIASES: Record<string, string> = {
  email: "connections",
  integrations: "connections",
  website: "connections",
  "website-widget": "connections",
  social: "connections",
  whatsapp: "connections",
  crm: "connections",
  write: "connections",
  automation: "replies",
  pause: "replies",
};

/** Old section id (or a page id) → the page that shows it. */
export function pageForId(id: string): string | null {
  if (PAGE_SECTIONS[id]) return id;
  if (ALIASES[id]) return ALIASES[id];
  for (const [page, sections] of Object.entries(PAGE_SECTIONS)) if (sections.includes(id)) return page;
  return null;
}

/**
 * Settings as a tree (A-257): the branches under a parent, which the desk's
 * stem shows under the parent you are in. A parent that is one page has
 * none. "When to check in" is the follow-up plans page, outside /settings.
 */
export type SettingsBranch = { label: string; href: string; page: string | null };
export const SETTINGS_BRANCHES: Partial<Record<SettingsGroup, SettingsBranch[]>> = {
  "Sending replies": [
    { label: "When to check in", href: "/workflows", page: null },
    { label: "Your free hours", href: "/settings#booking", page: "booking" },
  ],
  Account: [
    { label: "Team", href: "/settings#team", page: "team" },
    { label: "Your plan", href: "/settings#billing", page: "billing" },
    { label: "Sign-ins", href: "/settings#security", page: "security" },
    { label: "Your data", href: "/settings#data", page: "data" },
  ],
};

/** Where a parent itself opens: its one page, or its short list (Account). */
export function groupHref(g: SettingsGroup): string {
  const page = GROUP_PAGE[g];
  return `/settings#${page ? PAGE_SECTIONS[page][0] : GROUP_SLUG[g]}`;
}

/**
 * Where on the tree an address is: the parent, and the branch when it is
 * one. The desk opens on the first parent when nothing is asked for, as the
 * page does.
 */
export function settingsPlace(pathname: string, hash: string): { group: SettingsGroup; branch: string | null } {
  if (pathname.startsWith("/workflows")) return { group: "Sending replies", branch: "When to check in" };
  const id = hash.replace(/^#/, "");
  const page = pageForId(id);
  if (page) {
    const group = groupOfPage(page) ?? "Connected apps";
    const branch = SETTINGS_BRANCHES[group]?.find((b) => b.page === page)?.label ?? null;
    return { group, branch };
  }
  const bySlug = (Object.keys(GROUP_SLUG) as SettingsGroup[]).find((g) => GROUP_SLUG[g] === id);
  return { group: bySlug ?? "Connected apps", branch: null };
}

/** Fired when Settings moves between its pages with pushState (which fires no event), so the desk's stem follows. */
export const SETTINGS_MOVED = "followup:settings-moved";
