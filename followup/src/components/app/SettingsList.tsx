"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Bell, ChevronRight, CircleHelp, Ellipsis, Inbox, Send, Store, type LucideIcon } from "lucide-react";
import { describeBookingHours, describeTimeZone, type BookingHours } from "@/lib/bookingHours";
import { readPushState } from "@/lib/pushDevice";
import FeedbackDialog from "@/components/FeedbackDialog";
import type { StateKey } from "./canvasBits";
import { GROUP_PAGE, type SettingsGroup } from "@/lib/settingsGroups";

/**
 * Settings (A-220, the phone redesign): on a phone, four rows (where customers
 * write, how replies go out, alerts, your business), then More, then Help and
 * Sign out. A row opens its page, or a short list of pages first. On the desk
 * the side list holds the same five and this draws the open one's rows
 * (A-222: same words, each its own layout). The one broken thing shows first,
 * only when there is one.
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

type Row = { page: string; name: string; status?: string; state?: StateKey; cta?: string };

/** The word on a row's button on the desk (Wispr's "Change"): "Set up" for what isn't, "Open" for a page with nothing to change in one go. */
function ctaOf(r: Row): string {
  if (r.cta) return r.cta;
  if (r.status === "Not set up") return "Set up";
  return r.status ? "Change" : "Open";
}


export default function SettingsList({
  gmail,
  outlook,
  checkInDays,
  instantAck,
  holdAll,
  paused,
  planStatus,
  onOpen,
  onGroup,
  group,
  groupOpen,
}: {
  gmail: { connected: boolean; email?: string };
  outlook: { connected: boolean; email?: string };
  checkInDays: number[];
  instantAck: boolean;
  holdAll: boolean;
  paused: boolean;
  planStatus: string;
  onOpen: (page: string) => void;
  /** Opens a group's short list (the phone steps into it; the desk's side list shows it). */
  onGroup: (g: SettingsGroup) => void;
  /** The group whose rows show: the desk always shows one, the phone once a home row opened it. */
  group: SettingsGroup;
  /** The phone has stepped into `group`; until then it shows the five home rows. */
  groupOpen: boolean;
}) {
  const [social, setSocial] = useState<Social | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [team, setTeam] = useState<number | null>(null);
  // What the business does; null once loaded means never told (setup asks since 2026-10-04).
  const [trade, setTrade] = useState<string | null | undefined>(undefined);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string>("");
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
    get("/api/onboarding").then((data: { success?: boolean; industry?: string | null; name?: string; namePlaceholder?: boolean }) => {
      if (!data?.success) return;
      setTrade(data.industry ?? null);
      setBusinessName(data.namePlaceholder || !data.name ? "Add your business name" : data.name);
    });
    // Alerts in one line: on for this device, on for the phone set up earlier (A-216), by email, or off.
    Promise.all([get("/api/alerts"), readPushState().catch(() => "unsupported" as const)]).then(([a, push]) => {
      const device = window.matchMedia("(min-width: 64rem)").matches ? "computer" : "phone";
      const elsewhere = (a?.push?.devices ?? 0) > 0;
      setAlerts(push === "on" ? `On for this ${device}` : elsewhere ? "On for your phone" : a?.email?.enabled ? "By email" : "Off");
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
        { page: "website", name: "Website form", status: "Add it to your site", cta: "Open" },
        { page: "social", name: "Instagram, Facebook, WhatsApp", ...socialRow },
      ],
    },
    {
      title: "How replies go out",
      rows: [
        { page: "replies", name: "Replies and check-ins", status: holdAll ? "Every reply waits for you" : "Simple replies send themselves" },
        { page: "booking", name: "Booking hours", status: booking ?? "" },
        { page: "pause", name: "Pause all sending", status: paused ? "Paused" : "Off", state: paused ? "needs" : undefined },
      ],
    },
    {
      title: "More",
      rows: [
        { page: "team", name: "Team", status: team === null ? "" : team <= 1 ? "Just you" : `${team} people` },
        { page: "billing", name: "Your plan", status: planStatus },
        { page: "security", name: "Sign-ins and security" },
        { page: "data", name: "Your data", status: "Download or delete", cta: "Open" },
        { page: "advanced", name: "Advanced: CRM, Zapier, routing" },
      ],
    },
  ];

  // The phone's home rows, each with one line of what's set.
  const connected = [
    gmail.connected ? "Gmail" : outlook.connected ? "Outlook" : "",
    social?.instagram.connected ? "Instagram" : "",
    social?.facebook.connected ? "Facebook" : "",
    social?.whatsapp ? "WhatsApp" : "",
  ].filter(Boolean);
  const where: Pick<Row, "status" | "state"> =
    socialRow.state === "needs" ? socialRow : connected.length ? { status: andList(connected) } : social ? { status: "Nothing connected yet", state: "needs" } : { status: "" };
  const home: { g: SettingsGroup; icon: LucideIcon; status: string; state?: StateKey }[] = [
    { g: "Where customers write", icon: Inbox, status: where.status ?? "", state: where.state },
    { g: "How replies go out", icon: Send, status: paused ? "Paused" : holdAll ? "Every reply waits for your OK" : "FollowUp replies for you", state: paused ? "needs" : undefined },
    { g: "Alerts", icon: Bell, status: alerts },
    { g: "Your business", icon: Store, status: businessName ?? "" },
  ];
  const open = (g: SettingsGroup) => {
    const page = GROUP_PAGE[g];
    if (page) onOpen(page);
    else onGroup(g);
  };
  const shown = groups.find((x) => x.title === group);

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

      {/* The phone's Settings (A-220): four rows, More, then Help and Sign out. */}
      <div className={(groupOpen ? "hidden" : "grid") + " gap-2.5 lg:hidden"}>
        <div className={BOX}>
          {home.map((h, i) => (
            <HomeRow key={h.g} name={h.g} icon={h.icon} status={h.status} state={h.state} first={!i} onClick={() => open(h.g)} />
          ))}
        </div>
        <div className={BOX}>
          <HomeRow name="More" icon={Ellipsis} status="Team, plan, your data, advanced" first onClick={() => onGroup("More")} />
        </div>
        <div className="mt-2 grid justify-items-start px-1">
          <FeedbackDialog label="Help" icon={CircleHelp} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink" />
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="min-h-11 text-[15px] text-ink-soft">
            Sign out
          </button>
        </div>
        {signedInAs && (
          <p className="break-all px-1 text-[13.5px] text-ink-faint">
            Signed in as <span className="text-ink-soft">{signedInAs}</span>
          </p>
        )}
      </div>

      {/* One group's rows: the desk's open group, or the one the phone stepped into. */}
      <div className={(groupOpen ? "grid" : "hidden lg:grid") + " gap-[26px]"}>
        {group === "How replies go out" && (
          <section className="grid gap-2">
            {/* Desk: "Change" sits in the box. */}
            <div className="flex items-baseline justify-between lg:hidden">
              <h2 className="text-[13px] text-ink-faint" style={{ fontWeight: 400, letterSpacing: 0 }}>
                Your follow-up plan
              </h2>
              <Link href="/workflows" className="ml-auto text-sm underline underline-offset-[3px]">
                Change
              </Link>
            </div>
            <div className={BOX + " lg:flex lg:items-start"}>
              <div className="min-w-0 lg:flex-1 lg:py-1.5">
                {instantAck && <PlanRow when="Right away" what="A quick “got your message” reply." first />}
                <PlanRow when={days} what="A check-in, if they go quiet." first={!instantAck} />
                <PlanRow when="Always" what={holdAll ? "Every reply waits for your OK." : "Prices and dates always come to you."} />
              </div>
              <Link href="/workflows" className={CTA + " hidden lg:mr-4 lg:mt-4 lg:inline-flex"}>
                Change
              </Link>
            </div>
          </section>
        )}

        {shown && (
          <div className={BOX + " lg:py-1.5"}>
            {shown.rows.map((r, i) => (
              <button
                key={r.name}
                type="button"
                onClick={() => onOpen(r.page)}
                className={
                  "group flex min-h-[50px] w-full items-center gap-3 px-4 text-left hover:bg-card-2 lg:min-h-[60px] lg:hover:bg-transparent " +
                  (i ? "border-t border-line-2 lg:border-t-0" : "")
                }
              >
                {/* Phone: the name, then the status on the right and a chevron. Desk (Wispr): the
                    name over the status, and a "Change" button on the right. */}
                <span className="min-w-0 shrink-0 lg:flex-1 lg:shrink">
                  <span className="block text-[15px] lg:text-[14.5px] lg:font-medium">{r.name}</span>
                  {r.status && (
                    <span className="mt-0.5 hidden items-center gap-1.5 text-[13.5px] text-ink-faint lg:flex">
                      {r.state && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `var(--state-${r.state})` }} aria-hidden />}
                      <span className="truncate">{r.status}</span>
                    </span>
                  )}
                </span>
                <span className="inline-flex min-w-0 flex-1 items-center justify-end gap-2 text-[14px] text-ink-faint lg:hidden">
                  {r.state && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `var(--state-${r.state})` }} aria-hidden />}
                  {r.status && <span className="truncate">{r.status}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint lg:hidden" />
                <span className={CTA + " hidden lg:inline-flex"} aria-hidden>
                  {ctaOf(r)}
                </span>
              </button>
            ))}
          </div>
        )}

        {group === "More" && signedInAs && (
          <p className="-mt-3 break-all px-1 text-[13.5px] text-ink-faint">
            Signed in as <span className="text-ink-soft">{signedInAs}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** A home row (the approved drawing): the group's icon on a soft tile, its name over one line of what's set. */
function HomeRow({ name, icon: Icon, status, state, first, onClick }: { name: string; icon: LucideIcon; status: string; state?: StateKey; first: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={"flex min-h-[62px] w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-card-2 " + (first ? "" : "border-t border-line-2")}>
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-card-2 text-ink" aria-hidden>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-medium">{name}</span>
        {status && (
          <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-ink-faint">
            {state && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `var(--state-${state})` }} aria-hidden />}
            <span className="truncate">{status}</span>
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
    </button>
  );
}

/** "Gmail and Instagram", "Gmail, Instagram and WhatsApp". */
function andList(xs: string[]): string {
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** A group's box: white with a line on the phone; soft grey, no line, on the desk (Wispr). */
const BOX = "overflow-hidden rounded-[14px] border border-line bg-card lg:rounded-[12px] lg:border-0 lg:bg-card-2";
/** The desk row's button look ("Change"); the whole row is the button. */
const CTA =
  "h-8 shrink-0 items-center rounded-lg bg-paper px-3.5 text-[13px] font-medium text-ink shadow-[0_0_0_1px_var(--line)] group-hover:shadow-[0_0_0_1px_var(--line-strong)] hover:shadow-[0_0_0_1px_var(--line-strong)]";

function PlanRow({ when, what, first = false }: { when: string; what: string; first?: boolean }) {
  return (
    <div className={"grid grid-cols-[110px_minmax(0,1fr)] gap-4 px-4 py-3 text-[15px] lg:py-2.5 lg:text-[14.5px] " + (first ? "" : "border-t border-line-2 lg:border-t-0")}>
      <span className="text-sm text-ink-faint">{when}</span>
      <span className="leading-snug">{what}</span>
    </div>
  );
}
