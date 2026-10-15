import { ListSkeleton } from "@/components/app/PageSkeleton";

// Every page under (app) is force-dynamic (fresh data on every request —
// see the dynamic export in each page), so navigation always waits on a
// real server round-trip. This is the Suspense fallback App Router shows
// during that wait, while (app)/layout.tsx (the sidebar) stays mounted.
// Today, Customers, a customer and Settings have their own loading.tsx in
// their own shape (A-254); this one covers everywhere else: a title and rows.
export default function Loading() {
  return <ListSkeleton />;
}
