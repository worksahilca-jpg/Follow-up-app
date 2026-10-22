import Link from "next/link";
import { redirect } from "next/navigation";
import ScrollTitle from "@/components/app/ScrollTitle";
import { MissedList } from "@/components/MissedByCrm";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { loadMissedByCrm } from "@/lib/missedByCrmData";
import { MISSED_WINDOW_DAYS, placeLabel, shortDate, type MissedLead } from "@/lib/missedByCrm";
import { isPlaceholderLeadName } from "@/lib/leadName";

export const dynamic = "force-dynamic";

/** A placeholder ("Instagram DM") is never shown as a name: the email or phone they gave is. */
function shownName(l: MissedLead): string {
  if (!isPlaceholderLeadName(l.name)) return l.name.trim();
  return l.email ?? l.phone ?? "A customer";
}

/**
 * "Not in {CRM}" (A-315), behind See who on Results: each customer the CRM never got, their first words, where and
 * when, and one Add each. Without a CRM checked end to end there is nothing to compare with, so Results it is.
 */
export default async function MissedByCrmPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const [view, isAdmin] = await Promise.all([loadMissedByCrm(ctx.businessId), requireAdmin(ctx)]);
  if (!view) redirect("/analytics");
  const missing = view.state.kind === "missing" ? view.state.missing : [];
  const people = missing.map((l) => ({
    id: l.id,
    name: shownName(l),
    said: l.firstWords,
    where: `${placeLabel(l.channel, l.emailProvider, l.source)} · ${shortDate(l.wroteAt ?? l.createdAt, view.timeZone)}`,
  }));

  return (
    <div className="max-w-[640px] pb-10">
      <Link href="/analytics" className="-my-3 inline-flex min-h-11 items-center text-[13px] text-ink-faint hover:text-ink">
        ← Results
      </Link>
      <ScrollTitle title={`Not in ${view.crmLabel}`} />
      <h1 className="title-serif ios-title1 mt-3">Not in {view.crmLabel}</h1>
      {people.length > 0 && (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {people.length === 1 ? "1 customer" : `${people.length} customers`} wrote to you in the last {MISSED_WINDOW_DAYS} days that{" "}
          {view.crmLabel} doesn&apos;t have. Add them, and their messages go with them as a note.
        </p>
      )}
      <MissedList crmLabel={view.crmLabel} people={people} paused={view.paused} canAdd={isAdmin} />
    </div>
  );
}

export const metadata = { title: "Not in your CRM" };
