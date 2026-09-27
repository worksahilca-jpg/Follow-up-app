"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone, Plus, ShieldCheck, ChevronRight } from "lucide-react";
import OnlyAdminsSendSetting from "@/components/OnlyAdminsSendSetting";

/**
 * The top of Settings, as the canvas draws it (SettingsPhone and
 * SettingsControlPhone): a few short cards that answer "what is FollowUp
 * doing for me, where, and can I stop it" in one screen. Everything else
 * (every connection's own controls, billing, the team, data) stays below,
 * under "More settings".
 *
 * It reads the page's own state for the inbox and the switches, and asks
 * the three social config endpoints whether they're connected.
 */
type Social = { instagram: string | null | false; messenger: string | null | false; whatsapp: boolean };

export default function SettingsOverview({
  gmail,
  outlook,
  checkInDays,
  instantAck,
  holdAll,
  paused,
  pauseSaving,
  onPause,
  isAdmin,
  onOpenMore,
}: {
  gmail: { connected: boolean; email?: string };
  outlook: { connected: boolean; email?: string };
  checkInDays: number[];
  instantAck: boolean;
  holdAll: boolean;
  paused: boolean;
  pauseSaving: boolean;
  onPause: (paused: boolean) => void;
  isAdmin: boolean;
  /** Jump to a section of "More settings" (connect, team, advanced…). */
  onOpenMore: (section: string) => void;
}) {
  const [social, setSocial] = useState<Social | null>(null);
  useEffect(() => {
    const get = (url: string) =>
      fetch(url)
        .then((r) => r.json())
        .catch(() => ({}));
    Promise.all([get("/api/instagram/config"), get("/api/facebook/config"), get("/api/whatsapp/config")]).then(([ig, fb, wa]) =>
      setSocial({
        instagram: ig?.connected ? (ig.username ?? null) : false,
        messenger: fb?.connected ? (fb.pageName ?? null) : false,
        whatsapp: Boolean(wa?.connected),
      })
    );
  }, []);

  const places: { icon: React.ReactNode; name: string; detail: string | null }[] = [];
  if (gmail.connected) places.push({ icon: <Mail className="h-5 w-5" strokeWidth={1.8} />, name: "Gmail", detail: gmail.email ?? null });
  if (outlook.connected) places.push({ icon: <Mail className="h-5 w-5" strokeWidth={1.8} />, name: "Outlook", detail: outlook.email ?? null });
  if (social?.instagram !== false && social) places.push({ icon: <InstagramGlyph />, name: "Instagram", detail: social.instagram ? `@${social.instagram}` : null });
  if (social?.messenger !== false && social) places.push({ icon: <MessageCircle className="h-5 w-5" strokeWidth={1.8} />, name: "Messenger", detail: social.messenger || null });
  if (social?.whatsapp) places.push({ icon: <Phone className="h-5 w-5" strokeWidth={1.8} />, name: "WhatsApp", detail: null });

  const days = checkInDays.length > 1 ? `Day ${checkInDays.slice(0, -1).join(", ")}, ${checkInDays[checkInDays.length - 1]}` : `Day ${checkInDays[0] ?? 3}`;

  return (
    <div className="max-w-[560px] space-y-5">
      <Card label="Your follow-up plan" action={<Link href="/workflows" className="text-sm underline underline-offset-[3px]">Change</Link>}>
        {instantAck && <PlanRow when="Right away" what="A quick “got your message” reply." first />}
        <PlanRow when={days} what="A check-in, if they go quiet." first={!instantAck} />
        <PlanRow when="Then" what="It stops. And it stops the moment they answer." />
        <PlanRow when="Always" what={holdAll ? "Every reply waits for your OK." : "Prices and dates always come to you."} />
      </Card>

      <Card label="Where customers write">
        {places.length === 0 && social !== null && (
          <p className="py-3.5 text-[15px] text-ink-soft">Nothing is connected yet, so FollowUp can&apos;t see anyone write.</p>
        )}
        {places.map((p, i) => (
          <div key={p.name} className={"flex items-center gap-3 py-3.5 " + (i > 0 ? "border-t border-line-2" : "")}>
            <span className="text-ink">{p.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-base">{p.name}</div>
              {p.detail && <div className="truncate text-[13.5px] text-ink-faint">{p.detail}</div>}
            </div>
            <span className="text-sm text-ink-faint">On</span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onOpenMore("integrations")}
          className={"flex w-full items-center gap-3 py-3.5 text-left text-base " + (places.length > 0 ? "border-t border-line-2" : "")}
        >
          <Plus className="h-5 w-5" strokeWidth={1.8} />
          {places.length > 0 ? "Add another" : "Connect one"}
        </button>
      </Card>

      <Card label="Sending">
        <div className="flex items-center gap-3.5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-base">{paused ? "Sending is paused" : "Pause all sending"}</div>
            <div className="mt-0.5 text-[13.5px] leading-snug text-ink-faint">
              {paused
                ? "Everything waits for your OK until you resume. Your settings stayed as they were."
                : "Everything waits for your OK until you resume. Your settings stay."}
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onPause(!paused)}
              disabled={pauseSaving}
              className="h-11 shrink-0 rounded-full border bg-card px-4.5 px-[18px] text-[15px] font-medium disabled:opacity-60"
              style={{ borderColor: "rgba(10,10,10,0.18)" }}
            >
              {pauseSaving ? "…" : paused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </Card>

      <Card label="Your team">
        <OnlyAdminsSendSetting bare />
      </Card>

      <button
        type="button"
        onClick={() => onOpenMore("security")}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-[20px] border border-line bg-card px-[18px] text-left"
      >
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
        <span className="flex-1 text-base">Sign-ins and security</span>
        <ChevronRight className="h-5 w-5 text-ink-faint" strokeWidth={1.8} />
      </button>

      <div>
        <div className="text-sm text-ink-faint">Everything else</div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
          {[
            ["/leads", "Customers"],
            ["/waiting", "Waiting on customers"],
            ["/coming-up", "Coming up"],
            ["/workflows", "Follow-up plans"],
            ["/pipeline", "Pipeline"],
            ["/analytics", "Numbers"],
            ["/activity", "Activity"],
          ].map(([href, name]) => (
            <Link key={href} href={href} className="text-ink-soft underline-offset-[3px] hover:text-ink hover:underline">
              {name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-faint">{label}</span>
        {action}
      </div>
      <div className="mt-2 rounded-[20px] border border-line bg-card px-[18px] py-1">{children}</div>
    </section>
  );
}

function PlanRow({ when, what, first = false }: { when: string; what: string; first?: boolean }) {
  return (
    <div className={"flex gap-3.5 py-3 " + (first ? "" : "border-t border-line-2")}>
      <span className="w-[92px] shrink-0 text-sm text-ink-faint">{when}</span>
      <span className="text-[15.5px] leading-snug">{what}</span>
    </div>
  );
}

/** The canvas's Instagram glyph (a rounded square and a circle); lucide has no brand icons. */
function InstagramGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
