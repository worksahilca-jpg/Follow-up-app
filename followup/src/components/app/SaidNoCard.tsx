import KeepFollowingButton from "@/components/app/KeepFollowingButton";
import type { NoHow } from "@/lib/declinePhrases";
import { saidNoWords } from "@/lib/saidNoWords";

/**
 * They said no (A-326, drawn and approved 2026-10-25). The box at the top of their page, where "where they stand"
 * sits (A-246): FollowUp stopped following up, in one sentence, and the one way back once their reply has gone.
 * A maybe-no says FollowUp isn't sure and stopped to be safe.
 */
export default function SaidNoCard({ leadId, leadName, how }: { leadId: string; leadName: string; how: NoHow }) {
  const words = saidNoWords(how, leadName.split(" ")[0] || leadName);
  return (
    <article aria-label={words.title} className="rounded-[14px] border border-line bg-card p-4">
      <h2 className="text-[19px] leading-snug" style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>
        {words.title}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{words.body}</p>
      <KeepFollowingButton leadId={leadId} label={words.link} />
    </article>
  );
}
