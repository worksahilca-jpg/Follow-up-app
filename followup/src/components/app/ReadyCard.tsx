import { CalendarDays, Check, ChevronRight } from "lucide-react";
import { readyWhy, viewingOf, type Qualification, type Template } from "@/lib/qualification";

/**
 * "Nadia is ready." The qualification checklist on the customer's page
 * (design brain prototypes/2026-10-09-qualification-card, approved with
 * "build it" on 2026-10-09).
 *
 * Ready: the result, why, and what to do — Call / Message — with the proof
 * behind one tap. Not ready yet: nothing asks for attention; what FollowUp
 * has learned so far sits folded in the side column for anyone curious.
 * The owner never fills anything in here.
 *
 * A server component: the fold is a native <details>, so there is no
 * script to wait for and it opens with the keyboard as well as a tap.
 */
export default function ReadyCard({
  leadName,
  template,
  qualification,
  ready,
  callHref,
}: {
  leadName: string;
  template: Template;
  qualification: Qualification;
  ready: boolean;
  /** tel: link when there is a number to call; null shows Message alone. */
  callHref: string | null;
}) {
  const first = leadName.split(" ")[0] || leadName;
  const known = new Map(qualification.items.map((i) => [i.key, i]));

  if (!ready) {
    if (known.size === 0) return null;
    return (
      <details className="group overflow-hidden rounded-[14px] border border-line bg-card">
        <summary className="flex min-h-[50px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] hover:bg-card-2 [&::-webkit-details-marker]:hidden">
          <span>What FollowUp knows so far</span>
          <span className="flex items-center gap-2 text-[13px] text-ink-faint">
            {known.size} of {template.criteria.length}
            <ChevronRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-open:rotate-90 motion-reduce:transition-none" />
          </span>
        </summary>
        <div className="border-t border-line-2 px-4 pb-3">
          <Proof template={template} qualification={qualification} />
          <p className="mt-1 text-[12.5px] text-ink-faint">
            Still to find out:{" "}
            {template.criteria
              .filter((c) => !known.has(c.key))
              .map((c) => c.label.toLowerCase())
              .join(", ")}
            . FollowUp asks about one thing at a time, after answering {first}.
          </p>
        </div>
      </details>
    );
  }

  const viewing = viewingOf(qualification);
  const booked = known.get("viewing")?.source === "booking";
  const why = readyWhy(qualification);
  return (
    <article aria-label={`${first} is ready`} className="rounded-[14px] border border-line bg-card p-4">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-sage">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        Ready
      </span>
      <h2 className="mt-2.5 text-[19px] leading-snug" style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>
        {booked ? `${first} is ready` : `${first} is ready to view`}
      </h2>
      {viewing && (
        <p className="mt-2.5 flex items-center gap-2 rounded-[12px] bg-card-2 px-3 py-2.5 text-[14px]">
          <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-sage" />
          {viewing}
        </p>
      )}
      {why && (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">Why:</span> {why}
        </p>
      )}
      <div className="mt-3.5 flex gap-2">
        {callHref && (
          <a href={callHref} className="inline-flex h-[42px] flex-1 items-center justify-center rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent">
            Call {first}
          </a>
        )}
        <a
          href="#reply"
          className={
            "inline-flex h-[42px] flex-1 items-center justify-center rounded-full px-4 text-[14px] font-semibold " +
            (callHref ? "border border-line-strong text-ink hover:bg-card-2" : "bg-accent text-on-accent")
          }
        >
          {callHref ? "Message" : `Message ${first}`}
        </a>
      </div>
      <details className="group mt-3 border-t border-line pt-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
          How FollowUp knows
          <ChevronRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-open:rotate-90 motion-reduce:transition-none" />
        </summary>
        <Proof template={template} qualification={qualification} />
        <p className="mt-1 text-[12.5px] text-ink-faint">Each line is from what {first} wrote.</p>
      </details>
    </article>
  );
}

/** Each known item: what it is, the summary, and the customer's own words. */
function Proof({ template, qualification }: { template: Template; qualification: Qualification }) {
  const known = new Map(qualification.items.map((i) => [i.key, i]));
  return (
    <ul className="mt-2">
      {template.criteria.map((c) => {
        const item = known.get(c.key);
        if (!item) return null;
        return (
          <li key={c.key} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 border-t border-line py-2.5 first:border-t-0">
            <span aria-hidden className="mt-px grid h-5 w-5 place-items-center rounded-full bg-sage-soft text-sage">
              <Check className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] text-ink-faint">{c.label}</p>
              <p className="text-[14.5px] font-semibold">{item.value}</p>
              <p className="mt-0.5 break-words text-[13px] italic text-ink-soft">
                {item.source === "booking" ? "Booked through your booking link." : `“${item.quote}”`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
