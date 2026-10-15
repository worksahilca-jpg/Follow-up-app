import { CalendarDays, Check, ChevronRight, House } from "lucide-react";
import {
  glanceFacts,
  homeOf,
  isSeller,
  readyWhy,
  roundsFor,
  shownItems,
  stillToLearn,
  viewingOf,
  type CriterionKey,
  type Qualification,
  type Template,
} from "@/lib/qualification";
import KeepFollowingButton from "@/components/app/KeepFollowingButton";

/**
 * Where this customer stands (A-246, drawn and approved 2026-10-14). One
 * card at the top of the customer's page on a phone, and at the top of the
 * side column on a computer:
 *
 *  - Ready: the only coloured state, because it is the only one that needs
 *    the owner. What they want, why they're ready, Call / Message, and the
 *    proof one tap away.
 *  - Warm and Later: one sentence, three facts, and that FollowUp is
 *    keeping in touch. Nothing for the owner to do.
 *  - Has an agent: FollowUp stopped; one quiet way to overrule it.
 *  - Still finding out: what FollowUp knows so far, and what it doesn't.
 *
 * The owner never fills anything in here. A server component: the folds
 * are native <details>, so there is no script to wait for.
 */
export default function CustomerStanding({
  leadId,
  leadName,
  template,
  qualification: q,
  open,
  callHref,
  plan,
}: {
  leadId: string;
  leadName: string;
  template: Template;
  qualification: Qualification;
  /** The deal is still open. A won, lost or closed one keeps only the record of what was learned. */
  open: boolean;
  /** tel: link when there is a number to call; null shows Message alone. */
  callHref: string | null;
  /** Their follow-up plan and its one sentence (A-245, src/components/app/CustomerPlan.tsx), or null. */
  plan: React.ReactNode;
}) {
  const first = leadName.split(" ")[0] || leadName;
  const tier = open ? q.tier : undefined;

  if (tier === "ready") {
    const seller = isSeller(q);
    const viewing = viewingOf(q);
    const booked = q.items.some((i) => (i.key === "viewing" || i.key === "visit") && i.source === "booking");
    const home = homeOf(q);
    const why = readyWhy(q);
    return (
      <Box label={`${first} is ready`}>
        <Pill ready>Ready</Pill>
        <Title>{seller ? `${first} wants to sell` : booked ? `${first} is ready` : `${first} is ready to view`}</Title>
        {seller && (home || viewing) ? (
          <Row icon={<House aria-hidden className="h-4 w-4 shrink-0 text-sage" />}>{[home, viewing && `Home visit ${lowerFirst(viewing)}`].filter(Boolean).join(" · ")}</Row>
        ) : viewing ? (
          <Row icon={<CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-sage" />}>{viewing}</Row>
        ) : null}
        {why && (
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">Why:</span> {why}
          </p>
        )}
        <div className="mt-3.5 flex gap-2">
          {callHref && (
            <a href={callHref} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent">
              Call {first}
            </a>
          )}
          <a
            href="#reply"
            className={
              "inline-flex h-11 flex-1 items-center justify-center rounded-full px-4 text-[14px] font-semibold " +
              (callHref ? "border border-line-strong text-ink hover:bg-card-2" : "bg-accent text-on-accent")
            }
          >
            {callHref ? "Message" : `Message ${first}`}
          </a>
        </div>
        <HowItKnows template={template} q={q} first={first} />
      </Box>
    );
  }

  if (tier === "warm" || tier === "later") {
    return (
      <Box label={`Where ${first} stands`}>
        <Pill>{tier === "warm" ? "Warm" : "Later"}</Pill>
        <Title>{notYetTitle(q, first, tier)}</Title>
        <Facts q={q} className="mt-2.5" />
        {plan ?? <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">Nothing for you to do.</p>}
        <HowItKnows template={template} q={q} first={first} />
      </Box>
    );
  }

  if (tier === "agent") {
    return (
      <Box label={`${first} has an agent`}>
        <Pill>Has an agent</Pill>
        <Title>{`${first} already has an agent`}</Title>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          FollowUp stopped following up with {first}. If {first} writes again, it shows up on Today.
        </p>
        <KeepFollowingButton leadId={leadId} />
      </Box>
    );
  }

  // Still finding out, or a closed deal's record. Nothing yet: nothing to show.
  const roundKeys = roundsFor(template, q).flat();
  const known = roundKeys.filter((k) => q.items.some((i) => i.key === k)).length;
  if (q.items.filter((i) => i.key !== "side").length === 0) return null;
  const missing = stillToLearn(template, q).map((c) => STILL[c.key]);
  return (
    <section aria-label={`What FollowUp knows about ${first}`} className="rounded-[14px] bg-card-2 px-3 py-2.5">
      <p className="text-[12.5px] text-ink-soft">
        {open ? "What FollowUp knows so far" : "What FollowUp learned"}
        {open && (
          <>
            {" "}
            · <b className="font-semibold text-ink">{known} of {roundKeys.length}</b>
          </>
        )}
      </p>
      <Facts q={q} className="mt-2" />
      {open && missing.length > 0 && <p className="mt-2 text-[12.5px] text-ink-faint">Still to find out: {list(missing)}.</p>}
    </section>
  );
}

/** "Priya is a few months away", "Tom is just looking for now". */
function notYetTitle(q: Qualification, first: string, tier: "warm" | "later"): string {
  const timing = q.items.find((i) => i.key === "timing");
  if (tier === "later") return /look|brows|curious/i.test(`${timing?.value ?? ""} ${timing?.quote ?? ""}`) ? `${first} is just looking for now` : `${first} is planning further ahead`;
  if (timing?.bucket === "months") return isSeller(q) ? `${first} is a few months from selling` : `${first} is a few months away`;
  if (q.items.find((i) => i.key === "financing")?.bucket === "not_yet") return `${first} isn't pre-approved yet`;
  return `${first} is a little way off`;
}

/** What is still missing, said the way a person would. */
const STILL: Record<CriterionKey, string> = {
  side: "whether they're buying or selling",
  area: "the area",
  timing: "when",
  financing: "pre-approval",
  budget: "a price range",
  kind: "what they want",
  agent: "an agent",
  viewing: "a viewing",
  home: "the address",
  why: "why they're moving",
  condition: "the home's condition",
  price: "a price",
  visit: "a home visit",
};

function list(words: string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <article aria-label={label} className="rounded-[14px] border border-line bg-card p-4">
      {children}
    </article>
  );
}

function Pill({ ready = false, children }: { ready?: boolean; children: React.ReactNode }) {
  return ready ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-sage">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-line bg-card px-2.5 py-px text-[12.5px] font-semibold text-ink">{children}</span>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2.5 text-[19px] leading-snug" style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>
      {children}
    </h2>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mt-2.5 flex items-center gap-2 rounded-[12px] bg-card-2 px-3 py-2.5 text-[14px]">
      {icon}
      {children}
    </p>
  );
}

/** Three facts at a glance: a buyer's area, when and money; a seller's home, when and why. */
function Facts({ q, className = "" }: { q: Qualification; className?: string }) {
  return (
    <dl className={`grid grid-cols-3 gap-1.5 ${className}`}>
      {glanceFacts(q).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] text-ink-faint">{label}</dt>
          <dd className={"line-clamp-2 text-[13.5px] leading-snug " + (value ? "font-semibold" : "text-ink-faint")}>{value ?? "Not yet"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "How FollowUp knows · 5 checks": each known item with the customer's own words. */
function HowItKnows({ template, q, first }: { template: Template; q: Qualification; first: string }) {
  const rows = shownItems(template, q);
  if (rows.length === 0) return null;
  return (
    <details className="group mt-3 border-t border-line pt-2.5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13.5px] font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
        Why FollowUp thinks this
        <span className="flex items-center gap-1.5 text-[12.5px] font-normal text-ink-faint">
          {rows.length} {rows.length === 1 ? "check" : "checks"}
          <ChevronRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-open:rotate-90 motion-reduce:transition-none" />
        </span>
      </summary>
      <ul className="mt-1">
        {rows.map(({ criterion, item }) => (
          <li key={criterion.key} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 border-t border-line py-2.5 first:border-t-0">
            <span aria-hidden className="mt-px grid h-5 w-5 place-items-center rounded-full bg-sage-soft text-sage">
              <Check className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] text-ink-faint">{criterion.label}</p>
              <p className="text-[14.5px] font-semibold">{item.value}</p>
              <p className="mt-0.5 break-words text-[13px] italic text-ink-soft">
                {item.source === "booking" ? "Booked through your booking link." : `“${item.quote}”`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[12.5px] text-ink-faint">Each line is from what {first} wrote.</p>
    </details>
  );
}
