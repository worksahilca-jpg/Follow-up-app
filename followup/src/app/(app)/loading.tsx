// Every page under (app) is force-dynamic (fresh data on every request —
// see the dynamic export in each page), so navigation always waits on a
// real server round-trip with nothing shown otherwise. This is the
// Suspense fallback App Router shows automatically during that wait —
// one file covers dashboard/leads/pipeline/settings/analytics/workflows,
// since (app)/layout.tsx (the sidebar) stays mounted regardless and only
// this content area swaps. Shaped like the stat-card-row + list pattern
// most of those pages actually share, not a generic spinner.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-md bg-card" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="box h-24" />
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 box" />
        ))}
      </div>
    </div>
  );
}
