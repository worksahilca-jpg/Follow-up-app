import type { ProductUsage, UsageWeek } from "@/lib/admin-usage";

// Where the founder reads website visits. Vercel Web Analytics lives in the
// Vercel dashboard, not in our database, so this page links to it rather
// than copying numbers it can't see.
const VERCEL_ANALYTICS_URL = "https://vercel.com/north-frame3/follow-up-app/analytics";

const ROWS: { key: keyof UsageWeek; label: string; note: string }[] = [
  { key: "newCustomers", label: "New customers came in", note: "Leads created, every channel" },
  { key: "repliesWritten", label: "Customers FollowUp wrote a reply for", note: "Held for an OK, or sent on its own" },
  { key: "sentByOwner", label: "Replies owners sent", note: "A person pressed Send" },
  { key: "sentAutomatically", label: "Follow-ups sent automatically", note: "Not counting the quick “got it”" },
  { key: "instantAcks", label: "Quick “got your message” replies", note: "Sent right away to new customers" },
  { key: "dismissed", label: "Drafts owners chose not to send", note: "“Don’t send”" },
  { key: "cameBack", label: "Customers who replied to FollowUp", note: "Came back after a message it sent" },
  { key: "accountsActive", label: "Accounts where someone did something", note: "A person, not the scheduler" },
];

function change(now: number, before: number): string {
  if (now === before) return "same";
  return now > before ? `↑ ${now - before}` : `↓ ${before - now}`;
}

export default function ProductUsageSection({ usage }: { usage: ProductUsage }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl">How FollowUp is being used</h2>
      <p className="text-sm text-ink-soft mt-1">
        Every business together, last 7 days next to the 7 before. Counts only, no names.
      </p>

      <div className="mt-4 box overflow-hidden overflow-x-auto">
        <div className="grid grid-cols-[minmax(0,2fr)_auto_auto_auto] gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft">
          <span>What happened</span>
          <span className="text-right w-20">This week</span>
          <span className="text-right w-20">Last week</span>
          <span className="text-right w-16">Change</span>
        </div>
        {ROWS.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[minmax(0,2fr)_auto_auto_auto] gap-4 px-5 py-3 border-b border-line last:border-0 items-center"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-xs text-ink-soft">{r.note}</span>
            </span>
            <span className="text-right w-20 font-display text-xl tabular-nums">{usage.thisWeek[r.key]}</span>
            <span className="text-right w-20 text-sm text-ink-soft tabular-nums">{usage.lastWeek[r.key]}</span>
            <span className="text-right w-16 text-xs text-ink-soft tabular-nums">
              {change(usage.thisWeek[r.key], usage.lastWeek[r.key])}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-soft mt-3">
        Right now, <span className="font-medium text-ink tabular-nums">{usage.waitingNow}</span> written replies are
        waiting for someone&apos;s OK.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="box p-5">
          <p className="text-sm font-medium">Which parts get used</p>
          <p className="text-xs text-ink-soft mt-1">Accounts that have ever done this, out of {usage.totalAccounts}.</p>
          <div className="mt-3 flex flex-col">
            {usage.features.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 py-2 border-b border-line last:border-0">
                <span className="text-sm">{f.label}</span>
                <span className="text-sm tabular-nums">
                  {f.accounts} <span className="text-ink-soft">of {usage.totalAccounts}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="box p-5 flex flex-col">
          <p className="text-sm font-medium">Website visits</p>
          <p className="text-sm text-ink-soft mt-1">
            How many people open the site, which pages they read, and how many reach sign-in. No cookies, no personal
            data, and your own visits to this admin page aren&apos;t counted.
          </p>
          <a
            href={VERCEL_ANALYTICS_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-auto pt-4 text-sm font-medium underline underline-offset-4"
          >
            Open website visits in Vercel →
          </a>
        </div>
      </div>
    </section>
  );
}
