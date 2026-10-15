import { Bell, Ellipsis, Inbox, Send, Store, type LucideIcon } from "lucide-react";
import type { SettingsGroup } from "@/lib/settingsGroups";

/** Each Settings parent's icon, beside its word: the desk's tree (Sidebar, A-257) and the phone's home rows. */
export const GROUP_ICON: Record<SettingsGroup, LucideIcon> = {
  "Connected apps": Inbox,
  "Sending replies": Send,
  Alerts: Bell,
  "Your business": Store,
  Account: Ellipsis,
};
