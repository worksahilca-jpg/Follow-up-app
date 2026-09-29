"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { StateKey } from "./canvasBits";

/**
 * "Everything you can change" (A-069, the SettingsAll board). Every
 * setting as one row in plain words, its state on the right, each opening
 * its own page. Built from the research, not taste:
 *
 * - Stripe (three layers): the everyday places first, and what most
 *   businesses never need last, under "For advanced setups".
 * - Zapier (a rule that can't run is found one customer at a time): what
 *   stopped working rises to the top as "Needs you", with what is paused
 *   and how to fix it.
 * - Calendly / NN/g (hidden menus get used less): one list you can scan,
 *   never a drawer.
 *
 * It asks the social config endpoints whether each account is connected
 * and whether it is actually receiving (they are not the same question).
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
  carrierAvailable,
  holdAll,
  onlyAdminsSend,
  planStatus,
  onOpen,
}: {
  gmail: { connected: boolean; email?: string };
  outlook: { connected: boolean; email?: string };
  carrierAvailable: boolean;
  holdAll: boolean;
  onlyAdminsSend: boolean;
  planStatus: string;
  onOpen: (page: string) => void;
}) {
  const [social, setSocial] = useState<Social | null>(null);
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
  }, []);

  const inbox = gmail.connected ? `Gmail${gmail.email ? ` · ${gmail.email}` : ""}` : outlook.connected ? `Outlook${outlook.email ? ` · ${outlook.email}` : ""}` : "Not set up";
  const social_ = (s: { connected: boolean; receiving: boolean; name: string | null } | undefined): Pick<Row, "status" | "state"> =>
    !s || !s.connected ? { status: social ? "Not set up" : "" } : s.receiving ? { status: s.name ?? "Connected", state: "sent" } : { status: "Not receiving messages", state: "needs" };

  // What stopped working, said once at the top (Zapier study).
  const needs: { page: string; title: string; text: string }[] = [];
  if (social?.facebook.connected && !social.facebook.receiving)
    needs.push({ page: "social", title: "Your Facebook Page isn’t sending messages here", text: "It’s connected, but nothing people send the Page reaches FollowUp, so replies and check-ins there are paused. Open it to fix the link." });
  if (social?.instagram.connected && !social.instagram.receiving)
    needs.push({ page: "social", title: "Instagram isn’t sending messages here", text: "It’s connected, but no DMs reach FollowUp, so replies and check-ins there are paused. Open it to fix the link." });
  if (social && !gmail.connected && !outlook.connected && !social.instagram.connected && !social.facebook.connected && !social.whatsapp)
    needs.push({ page: "email", title: "Nothing is connected to send with", text: "FollowUp can take in customers, but it has no way to reply to them yet. Connect your email and it starts." });

  const groups: { title: string; note?: string; rows: Row[] }[] = [
    {
      title: "Where customers write",
      rows: [
        { page: "email", name: "Email", status: inbox, state: gmail.connected || outlook.connected ? "sent" : undefined },
        { page: "website", name: "Website form", status: "Add it to your site" },
        { page: "social", name: "Facebook Page", ...social_(social?.facebook) },
        { page: "social", name: "Instagram", ...social_(social?.instagram) },
        { page: "whatsapp", name: "WhatsApp", status: social ? (social.whatsapp ? "Connected" : "Not set up") : "", state: social?.whatsapp ? "sent" : undefined },
      ],
    },
    {
      title: "How it writes",
      rows: [
        { page: "replies", name: "Replies and check-ins", status: holdAll ? "Every reply waits for you" : "Simple replies send themselves" },
        { page: "@/workflows", name: "Follow-up plans" },
      ],
    },
    {
      title: "Your business",
      rows: [
        { page: "business", name: "Your business" },
        { page: "team", name: "Team", status: onlyAdminsSend ? "Only admins send" : "Anyone can send" },
      ],
    },
    { title: "Plan", rows: [{ page: "billing", name: "Your plan", status: planStatus }] },
    {
      title: "Account",
      rows: [
        { page: "security", name: "Sign-ins and security" },
        { page: "data", name: "Your data", status: "Download or delete" },
        { page: "feedback", name: "Tell us something" },
      ],
    },
    {
      title: "For advanced setups",
      note: "Most businesses never need these.",
      rows: [
        { page: "crm", name: "Your CRM", status: "Follow Up Boss or HubSpot" },
        { page: "tools", name: "Other tools", status: "Zapier, Make, a webhook" },
        ...(carrierAvailable ? [{ page: "phone", name: "Phone and text" }] : []),
        { page: "routing", name: "New customers, by where they wrote" },
      ],
    },
  ];

  return (
    <div>
      <h2 className="text-[22px] leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.015em" }}>
        Everything you can change
      </h2>
      <p className="mt-1.5 text-[14.5px] text-ink-soft">One list, in plain words. Anything that stopped working shows first.</p>

      {needs.map((n) => (
        <button
          key={n.title}
          type="button"
          onClick={() => onOpen(n.page)}
          className="mt-4 flex w-full items-start gap-2.5 rounded-[18px] border border-line bg-card px-[18px] py-3.5 text-left hover:bg-card-2"
        >
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--state-needs)" }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-medium">{n.title}</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-soft">{n.text}</span>
          </span>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
        </button>
      ))}

      {groups.map((g) => (
        <section key={g.title} className="mt-6">
          <h3 className="text-sm text-ink-faint" style={{ fontWeight: 400, letterSpacing: 0 }}>
            {g.title}
          </h3>
          {g.note && <p className="mt-0.5 text-[13.5px] text-ink-faint">{g.note}</p>}
          <div className="mt-2 overflow-hidden rounded-[18px] border border-line bg-card">
            {g.rows.map((r, i) => {
              const inner = (
                <>
                  <span className="shrink-0 text-[15.5px]">{r.name}</span>
                  {!r.status && <span className="flex-1" />}
                  {r.status && (
                    <span className="inline-flex min-w-0 flex-1 items-center justify-end gap-1.5 text-[14px] text-ink-faint">
                      {r.state && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: `var(--state-${r.state})` }} aria-hidden />}
                      <span className="truncate">{r.status}</span>
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </>
              );
              const cls = "flex min-h-[50px] w-full items-center gap-3 px-[18px] text-left hover:bg-card-2 " + (i ? "border-t border-line-2" : "");
              return r.page.startsWith("@") ? (
                <a key={r.name} href={r.page.slice(1)} className={cls}>
                  {inner}
                </a>
              ) : (
                <button key={r.name} type="button" onClick={() => onOpen(r.page)} className={cls}>
                  {inner}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
