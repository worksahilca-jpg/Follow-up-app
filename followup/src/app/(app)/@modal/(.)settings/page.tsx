"use client";

import { usePathname, useRouter } from "next/navigation";
import AppWindow from "@/components/app/AppWindow";
import SettingsPage from "../../settings/page";

/**
 * Settings as a window over the page you were on (A-213). Reached from
 * inside the app (the sidebar, the phone's tab, the business menu), the
 * route is intercepted and shown here; a direct visit or a refresh of
 * /settings (an email link, coming back from connecting Gmail) shows the
 * full page instead, so every old /settings#… link still lands.
 *
 * Inside the window, Settings moves between its own pages without adding
 * history (useInWindow), so closing — the ×, Esc, or Back — returns to the
 * page underneath in one step.
 *
 * Going anywhere else from inside the window (a link to the follow-up
 * plan, a place in the sidebar) closes it: a slot keeps what it last
 * matched on a soft navigation, so the window checks the address itself.
 */
export default function SettingsWindow() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname !== "/settings") return null;
  return (
    <AppWindow label="Settings" onClose={() => router.back()}>
      <SettingsPage />
    </AppWindow>
  );
}
