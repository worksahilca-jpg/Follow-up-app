import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Inbox folded into Customers (A-082, founder 2026-10-04). Old links,
 * bookmarks and the phone habit still land: /inbox opens Customers, and
 * /inbox?c=<id> opens that customer beside the list.
 *
 * The old screen is parked in InboxList.tsx, not deleted: A-027's guard
 * keeps a page's code until usage is re-checked at 30 accounts.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  redirect(c ? `/leads?p=${encodeURIComponent(c)}` : "/leads");
}
