import PilotBaselineForm from "@/components/PilotBaselineForm";
import { hoursWords, MINUTES, percent, type Answering, type Step } from "@/lib/pilotNumbers";
import type { PilotBusiness, PilotReport } from "@/lib/pilotNumbersData";

// "The pilot" (founder, 2026-10-22: "do 2", from an advisor's note): for each pilot business, the three things the
// pilot proves (were FollowUp's calls right, how much of the owner's work it took, what came of the appointments),
// FollowUp's chosen next step and whether it worked, and how the business answered customers before FollowUp
// compared with since. Numbers only, as everywhere on /admin: no customer's name or words.

const STEP_WORDS: Record<Step, string> = { first_reply: "First replies", follow_up: "Follow-ups", bring_back: "Bring-backs" };

function minutesWords(min: number): string {
  if (min < 60) return `about ${min} min`;
  const h = Math.round((min / 60) * 10) / 10;
  return `about ${h} h`;
}

function answeringWords(a: Answering): string {
  if (a.wrote === 0) return "Nobody wrote.";
  const answered = `${a.wrote} wrote · ${percent(a.answered, a.wrote)} answered`;
  return a.medianHours === null ? answered : `${answered} · first reply in ${hoursWords(a.medianHours)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line px-5 py-3 first:border-t-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="min-w-0 text-sm tabular-nums">{children}</div>
    </div>
  );
}

function BusinessPilot({ b }: { b: PilotBusiness }) {
  const { calls, replies, appointments } = b;
  const sent = replies.asWritten + replies.changed + replies.onItsOwn;
  const steps = (Object.keys(replies.steps) as Step[]).filter((s) => replies.steps[s].sent > 0);
  const since = b.connectedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="box overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <p className="min-w-0 truncate font-medium">{b.name}</p>
        <p className="text-xs text-ink-soft">
          {[b.industry, since ? `reading messages since ${since}` : "nothing connected"].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Row label="Who's a customer">
        {calls.letIn + calls.keptOut === 0 ? (
          <span className="text-ink-soft">No calls yet.</span>
        ) : (
          <>
            <p>
              Let in {calls.letIn}, owner set aside {calls.setAside} · kept out {calls.keptOut}, owner brought back{" "}
              {calls.broughtBack}
            </p>
            {calls.rightPercent !== null && <p className="text-ink-soft">{calls.rightPercent}% of calls the owner didn&apos;t correct</p>}
          </>
        )}
      </Row>
      <Row label="Called Ready">
        {calls.ready === 0 ? (
          <span className="text-ink-soft">None yet.</span>
        ) : (
          <p>
            {calls.ready} · {calls.readyBookedOrWon} booked or won
          </p>
        )}
      </Row>
      <Row label="Replies sent">
        {sent === 0 ? (
          <span className="text-ink-soft">None yet.</span>
        ) : (
          <>
            <p>
              {replies.asWritten} as written · {replies.changed} changed first · {replies.onItsOwn} sent on its own
            </p>
            <p className="text-ink-soft">{minutesWords(replies.minutesSaved)} of the owner&apos;s time saved (a guess, see below)</p>
          </>
        )}
      </Row>
      <Row label="FollowUp's next step, and did they write back">
        {steps.length === 0 ? (
          <span className="text-ink-soft">None yet.</span>
        ) : (
          <p>
            {steps
              .map((s) => `${STEP_WORDS[s]} ${replies.steps[s].wroteBack} of ${replies.steps[s].sent}`)
              .join(" · ")}
          </p>
        )}
      </Row>
      <Row label="Appointments booked">
        {appointments.booked === 0 ? (
          <span className="text-ink-soft">None yet.</span>
        ) : (
          <p>
            {appointments.booked} · {appointments.happened} happened · {appointments.didnt} didn&apos;t ·{" "}
            {appointments.notAnswered} not answered yet · {appointments.upcoming} still to come
          </p>
        )}
      </Row>
      <Row label="Answering customers">
        {b.answering === null ? (
          <span className="text-ink-soft">Connect an inbox to compare.</span>
        ) : (
          <>
            <p>Before FollowUp (90 days): {answeringWords(b.answering.before)}</p>
            <p>Since: {answeringWords(b.answering.since)}</p>
          </>
        )}
      </Row>
      <Row label="The owner said, before FollowUp">
        <PilotBaselineForm businessId={b.id} baseline={b.baseline} />
      </Row>
    </div>
  );
}

export default function PilotSection({ report }: { report: PilotReport }) {
  return (
    <section id="pilot" className="mt-10 scroll-mt-6">
      <h2 className="font-display text-xl">The pilot</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        For each business, the last {report.windowDays} days: were FollowUp&apos;s calls right, how much of the owner&apos;s
        work it took, whether its next steps worked, and what came of the appointments. Numbers only. The practice
        customer is never counted.
      </p>

      {report.businesses.length === 0 ? (
        <div className="mt-4 box p-5 text-sm text-ink-soft">
          No business in the pilot yet. This fills once someone connects an inbox or a customer writes.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {report.businesses.map((b) => (
            <BusinessPilot key={b.id} b={b} />
          ))}
        </div>
      )}

      <p className="mt-3 max-w-3xl text-xs text-ink-soft">
        Time saved is a guess until testers time themselves: {MINUTES.write} min to write a reply by hand,{" "}
        {MINUTES.check} min to check one FollowUp wrote, {MINUTES.change} min to change one. &ldquo;Before
        FollowUp&rdquo; is the inbox FollowUp read when it connected; the owner&apos;s own numbers are what they said on
        the setup call.
      </p>
    </section>
  );
}
