"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronRight } from "lucide-react";
import { describeBookingHours, describeTimeZone, type BookingHours } from "@/lib/bookingHours";
import type { StateKey } from "./canvasBits";

/**
 * Settings as the one-decision board draws it (A-080): one column, the
 * follow-up plan on top, then five groups of plain rows, each opening its
 * own page. The one broken thing shows first, only when there is one.
 * Built from the research, not taste:
 *
 * - Stripe (three layers): the everyday places first, and what most
 *   businesses never need behind one "Advanced" row at the end.
 * - Zapier (a rule that can't run is found one customer at a time): what
 *   stopped working rises to the top as "Needs you".
 * - Laws of UX (2026-10-03): each fact once, five groups, nothing that
 *   repeats a row.
 *
 * It asks the config endpoints whether each account is connected and
 * whether it is actually receiving (they are not the same question).
 */
type Social = {
  instagram: { connected: boolean; receiving: boolean; name: string | null };
  facebook: { connected: boolean; receiving: boolean; name: string | null };
  whatsapp: boolean;
};

type Row = { page: string; name: string; status?: string; state?: StateKey };

export default function SettingsList({
  gmail,
  outlook,
  checkInDays,
  instantAck,
  holdAll,
  paused,
  planStatus,
  onOpen,
}: {
  gmail: { connected: boolean; email?: string };
  outlook: { connected: boolean; email?: string };
  checkInDays: number[];
  instantAck: boolean;
  holdAll: boolean;
  paused: boolean;
  planStatus: string;
  onOpen: (page: string) => void;
}) {
  const [social, setSocial] = useState<Social | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [team, setTeam] = useState<number | null>(null);
  // What the business does; null once loaded means never told (setup asks since 2026-10-04).
  const [trade, setTrade] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const get = (url: string) =>
      fetch(url)
        .then((r) => r.json())
        .catch(() => ({}));
    Promise.all([get("/api/instagram/config"), get("/api/facebook/config"), get("/api/whatsapp/config")]).then(([ig, fb, wa]) =>
      setSocial({
        instagram: { connected: Boolean(ig?.connected), receiving: ig?.receiving !== false, name: ig?.instagramUsername ? `@${ig.instagramUsername}` : null },
        facebook: { connected: Boolean(fb?.connected), receiving: fb?.receiving !== false, name: fb?.pageName ?? null },
        whatsapp: Boolean(wa?.connected),
      })
    );
    get("/api/business/booking-hours").then((data: { success?: boolean; timezone?: string } & Partial<BookingHours>) => {
      if (!data?.success || !data.days || data.startMinute === undefined || data.endMinute === undefined) return;
      const city = data.timezone ? describeTimeZone(data.timezone).replace(/\s*\(.*$/, "") : "";
      setBooking(describeBookingHours({ days: data.days, startMinute: data.startMinute, endMinute: data.endMinute }) + (city ? ` · ${city}` : ""));
    });
    get("/api/onboarding").then((data: { success?: boolean; industry?: string | null }) => {
      if (data?.success) setTrade(data.industry ?? null);
    });
    get("/api/team").then((data: { members?: unknown[] }) => setTeam(Array.isArray(data?.members) ? data.members.length : null));
  }, []);

  // Which account this is (founder, 2026-10-04: "I am not able to see which id I am logged in").
  const { data: session } = useSession();
  const signedInAs = session?.user?.email ?? "";

  const inbox = gmail.connected ? `Gmail${gmail.email ? ` · ${gmail.email}` : ""}` : outlook.connected ? `Outlook${outlook.email ? ` · ${outlook.email}` : ""}` : "Not set up";

  // Instagram, Facebook and WhatsApp as one row: what is connected, or
  // the one that stopped receiving.
  const socialRow = ((): Pick<Row, "status" | "state"> => {
    if (!social) return { status: "" };
    const broken = [social.instagram, social.facebook].some((s) => s.connected && !s.receiving);
    if (broken) return { status: "Not receiving messages", state: "needs" };
    const on = [social.instagram.connected && "Instagram", social.facebook.connected && "Facebook", social.whatsapp && "WhatsApp"].filter(Boolean) as string[];
    return on.length ? { status: on.join(", "), state: "sent" } : { status: "Not set up" };
  })();

  // What stopped working, said once at the top (Zapier study). One thing:
  // the first is the one to fix.
  const needs: { page: string; title: string; text: string }[] = [];
  if (social?.facebook.connected && !social.facebook.receiving)
    needs.push({ page: "social", title: "Your Facebook Page isn’t sending messages here", text: "It’s connected, but nothing people send the Page reaches FollowUp, so replies and check-ins there are paused. Open it to fix the link." });
  if (social?.instagram.connected && !social.instagram.receiving)
    needs.push({ page: "social", title: "Instagram isn’t sending messages here", text: "It’s connected, but no DMs reach FollowUp, so replies and check-ins there are paused. Open it to fix the link." });
  if (social && !gmail.connected && !outlook.connected && !social.instagram.connected && !social.facebook.connected && !social.whatsapp)
    needs.push({ page: "email", title: "Nothing is connected to send with", text: "FollowUp can take in customers, but it has no way to reply to them yet. Connect your email and it starts." });
  if (trade === null)
    needs.push({ page: "business", title: "Tell FollowUp what you do", text: "It uses your line of work to tell real customers from everyone else, and to write replies that fit it. One tap." });
  const need = needs[0];

  const days = checkInDays.length > 1 ? `Day ${checkInDays.slice(0, -1).join(", ")}, ${checkInDays[checkInDays.length - 1]}` : `Day ${checkInDays[0] ?? 3}`;

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Where customers write",
      rows: [
        { page: "email", name: "Email", status: inbox, state: gmail.connected || outlook.connected ? "sent" : undefined },
        { page: "website", name: "Website form", status: "Add it to your site" },
        { page: "social", name: "Instagram, Facebook, WhatsApp", ...socialRow },
      ],
    },
    {
      title: "How it writes",
      rows: [
        { page: "replies", name: "Replies and check-ins", status: holdAll ? "Every reply waits for you" : "Simple replies send themselves" },
        { page: "booking", name: "Booking hours", status: booking ?? "" },
        { page: "pause", name: "Pause all sending", status: paused ? "Paused" : "Off", state: paused ? "needs" : undefined },
      ],
    },
    {
      title: "Your business",
      rows: [
        { page: "business", name: "Your business" },
        { page: "team", name: "Team", status: team === null ? "" : team <= 1 ? "Just you" : `${team} people` },
        { page: "billing", name: "Your plan", status: planStatus },
      ],
    },
    {
      title: "Account",
      rows: [
        { page: "security", name: "Sign-ins and security" },
        { page: "data", name: "Your data", status: "Download or delete" },
        { page: "advanced", name: "Advanced: CRM, Zapier, routing" },
      ],
    },
  ];

  return (
    <div className="grid max-w-[640px] gap-[26px]">
      {need && (
        <button
          type="button"
          onClick={() => onOpen(need.page)}
          className="flex w-full items-start gap-2.5 rounded-[14px] border border-line bg-card px-4 py-3.5 text-left hover:bg-card-2"
        >
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--state-needs)" }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-medium">{need.title}</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-soft">{need.text}</span>
          </span>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
        </button>
      )}

      <section className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] text-ink-faint" style={{ fontWeight: 400, letterSpacing: 0 }}>
            Your follow-up plan
          </h2>
          <Link href="/workflows" className="text-sm underline underline-offset-[3px]">
            Change
          </Link>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-line bg-card">
          {instantAck && <PlanRow when="Right away" what="A quick “got your message” reply." first />}
          <PlanRow when={days} what="A check-in, if they go quiet." first={!instantAck} />
          <PlanRow when="Always" what={holdAll ? "Every reply waits for your OK." : "Prices and dates always come to you."} />
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.title} className="grid gap-2">
          <h2 className="text-[13px] text-ink-faint" style={{ fontWeight: 400, letterSpacing: 0 }}>
            {g.title}
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-line bg-card">
            {g.rows.map((r, i) => (
              <button
                key={r.name}
                type="button"
                onClick={() => onOpen(r.page)}
                className={"flex min-h-[50px] w-full items-center gap-3 px-4 text-left hover:bg-card-2 " + (i ? "border-t border-line-2" : "")}
              >
                <span className="shrink-0 text-[15px]">{r.name}</span>
                <span className="inline-flex min-w-0 flex-1 items-center justify-end gap-2 text-[14px] text-ink-faint">
                  {r.state && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `var(--state-${r.state})` }} aria-hidden />}
                  {r.status && <span className="truncate">{r.status}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* In full, under the last group: a row status would cut it short on a phone. */}
      {signedInAs && (
        <p className="-mt-3 break-all px-1 text-[13.5px] text-ink-faint">
          Signed in as <span className="text-ink-soft">{signedInAs}</span>
        </p>
      )}
    </div>
  );
}

function PlanRow({ when, what, first = false }: { when: string; what: string; first?: boolean }) {
  return (
    <div className={"grid grid-cols-[110px_minmax(0,1fr)] gap-4 px-4 py-3 text-[15px] " + (first ? "" : "border-t border-line-2")}>
      <span className="text-sm text-ink-faint">{when}</span>
      <span className="leading-snug">{what}</span>
    </div>
  );
}
