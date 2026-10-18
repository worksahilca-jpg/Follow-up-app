import AccessRequestList from "@/components/AccessRequestList";
import ActivationSection from "@/components/ActivationSection";
import TesterHealthSection from "@/components/TesterHealthSection";
import { PageHeader } from "@/components/PageHeader";
import { getPlatformAdminData } from "@/lib/admin-data";
import { getActivation } from "@/lib/activation-data";
import { getTesterHealth } from "@/lib/testerHealth";

export const dynamic = "force-dynamic";

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function channelLabel(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

// One definition of the signups table's column tracks, shared by the header
// row and the body rows. `_` (space), not a comma, between grid tracks — see
// the note on this same pattern in TeamPerformanceSection.tsx.
const SIGNUP_GRID = "grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.5fr)_auto]";

/** /admin → Testers: who can sign in, who is set up, and who is getting value. */
export default async function TestersPage() {
  const [data, activation, health] = await Promise.all([getPlatformAdminData(), getActivation(), getTesterHealth()]);

  return (
    <div>
      <PageHeader title="Testers" subtitle="Who can sign in, who is set up, and who is getting something out of FollowUp." />

      <section id="add" className="mt-10 scroll-mt-6">
        <h2 className="font-display text-xl">Beta testers</h2>
        <p className="text-sm text-ink-soft mt-1">
          The only way in. Add a Google email and that person can sign in on their next try — no settings change, no
          redeploy. Nobody can ask from the site.
        </p>
        <div className="mt-4">
          <AccessRequestList requests={data.accessRequests} />
        </div>
      </section>

      <TesterHealthSection report={health} />

      <ActivationSection activation={activation} />

      <section className="mt-10">
        <h2 className="font-display text-xl">What testers changed this week</h2>
        <p className="text-sm text-ink-soft mt-1">
          How many of FollowUp&apos;s replies each business sent this week, and how many they changed first.
          Numbers only: no message is shown here, so no one reads a customer&apos;s email.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {data.draftChanges.length === 0 ? (
            <div className="box p-5 text-sm text-ink-soft">
              Nothing yet. This fills as testers send FollowUp&apos;s replies.
            </div>
          ) : (
            <div className="box overflow-hidden">
              {data.draftChanges.map((c) => (
                <div key={c.businessName} className="flex items-center justify-between gap-4 border-t border-line-2 px-5 py-3 text-sm first:border-t-0">
                  <span className="min-w-0 truncate">{c.businessName}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {c.sent - c.edited} of {c.sent} sent unchanged
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Recent signups</h2>
        <p className="text-sm text-ink-soft mt-1">The most recently created businesses, newest first.</p>
        <div className="mt-4 box overflow-hidden overflow-x-auto">
          {/* `_` (space), not a comma, between grid tracks — see the note
              on this same pattern in TeamPerformanceSection.tsx. */}
          <div className={`grid ${SIGNUP_GRID} gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft`}>
            <span>Business</span>
            <span>Signed up</span>
            <span>Connected channels</span>
            <span className="text-right">Leads</span>
          </div>
          {data.recentSignups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-soft">No businesses have signed up yet.</p>
          ) : (
            data.recentSignups.map((b) => (
              <div
                key={b.id}
                className={`grid ${SIGNUP_GRID} gap-4 px-5 py-3 border-b border-line last:border-0 items-center`}
              >
                <span className="text-sm font-medium truncate">{b.name}</span>
                <span className="text-sm text-ink-soft whitespace-nowrap">{formatFullDate(b.createdAt)}</span>
                <span className="flex flex-wrap gap-1.5">
                  {b.connectedChannels.length === 0 ? (
                    <span className="text-sm text-ink-soft">—</span>
                  ) : (
                    b.connectedChannels.map((c) => (
                      <span
                        key={c}
                        className="text-xs rounded-full border border-line px-2 py-0.5 text-ink-soft whitespace-nowrap"
                      >
                        {channelLabel(c)}
                      </span>
                    ))
                  )}
                </span>
                <span className="text-sm text-right tabular-nums">{b.leadCount}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
