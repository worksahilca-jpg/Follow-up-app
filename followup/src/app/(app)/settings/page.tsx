import PageCopiesProvider from "@/components/app/PageCopiesProvider";
import { settingsCopies } from "@/lib/settingsCopies";
import SettingsClient from "./SettingsClient";

/**
 * Settings opens with its answers inside the page (src/lib/pageCopies.ts):
 * the page is opened all day and answers in ~0.1 s, while the routes its
 * parts used to ask each started cold, 1.3–3.6 s apiece (Oct 27).
 */
export default async function SettingsPage() {
  return (
    <PageCopiesProvider copies={await settingsCopies()}>
      <SettingsClient />
    </PageCopiesProvider>
  );
}
