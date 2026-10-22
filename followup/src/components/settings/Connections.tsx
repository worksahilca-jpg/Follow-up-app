"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import FilteredEmails from "@/components/FilteredEmails";
import ChannelNotReceiving from "@/components/ChannelNotReceiving";
import CrmConfig from "@/components/CrmConfig";
import CalendarConnection from "./CalendarConnection";
import { useWhatsAppSignup } from "@/lib/useWhatsAppSignup";
import { safeBannerText } from "@/lib/bannerText";
import { BOX, PILL, ConnectedAs, ConnectedMark, ConnectionRow, ConnectionSheet, NeedsMark, Soon } from "./connectionBits";

/**
 * Settings › Where customers write (A-253, founder: "We just have to show
 * 'Connect this' or 'that' … Say 'Connected', 'Okay', 'Done'"). One row per
 * place, Connect or ✓ Connected; a connected row opens a small window with
 * who it's connected as, the messages FollowUp kept out, Done and
 * Disconnect. What used to be on these pages (access tokens, "Meta console
 * reference", Sync now, Scan spam, the raw embed code) is gone from the
 * screen (R-115); a place with no one-tap connect yet says "Soon". Every app
 * FollowUp works with is here and nowhere else (A-316): the CRM, and the
 * calendar bookings land in.
 */

type Social = { connected: boolean; receiving: boolean; name: string | null; oauthAvailable: boolean };
type Open = "gmail" | "outlook" | "instagram" | "facebook" | "whatsapp" | "website" | null;
type Banner = { kind: "ok" | "error"; words: string } | null;

export type EmailState = { connected: boolean; email?: string; loaded: boolean };

export default function Connections({
  gmail,
  outlook,
  gmailPushActive,
  gmailNeedsReconnect,
  outlookAvailable,
  isAdmin,
  onGmailDisconnect,
  onOutlookDisconnect,
}: {
  gmail: EmailState;
  outlook: EmailState;
  gmailPushActive: boolean;
  gmailNeedsReconnect: boolean;
  outlookAvailable: boolean;
  isAdmin: boolean;
  /** The page's own handlers (they ask first, then update Settings' rows): true once disconnected. */
  onGmailDisconnect: () => Promise<boolean>;
  onOutlookDisconnect: () => Promise<boolean>;
}) {
  const searchParams = useSearchParams();
  const signup = useWhatsAppSignup();
  const [instagram, setInstagram] = useState<Social | null>(null);
  const [facebook, setFacebook] = useState<Social | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [kept, setKept] = useState<Record<string, number>>({});
  // "See them" on Today's "Your last 90 days" (A-306) lands here with ?skipped=gmail: that inbox's window opens with
  // what it set aside showing.
  const skippedFor = searchParams.get("skipped");
  const seeSkipped = skippedFor === "gmail" || skippedFor === "outlook" ? skippedFor : null;
  const [open, setOpen] = useState<Open>(seeSkipped);
  const [showKept, setShowKept] = useState(seeSkipped !== null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pages, setPages] = useState<{ id: string; name: string }[] | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadInstagram = () =>
    fetch("/api/instagram/config")
      .then((r) => r.json())
      .then((d: { connected?: boolean; receiving?: boolean; instagramUsername?: string | null; oauthAvailable?: boolean }) =>
        setInstagram({ connected: !!d.connected, receiving: d.receiving !== false, name: d.instagramUsername ? `@${d.instagramUsername}` : null, oauthAvailable: !!d.oauthAvailable })
      )
      .catch(() => setInstagram({ connected: false, receiving: true, name: null, oauthAvailable: false }));
  const loadFacebook = () =>
    fetch("/api/facebook/config")
      .then((r) => r.json())
      .then((d: { connected?: boolean; receiving?: boolean; pageName?: string | null; oauthAvailable?: boolean }) =>
        setFacebook({ connected: !!d.connected, receiving: d.receiving !== false, name: d.pageName ?? null, oauthAvailable: !!d.oauthAvailable })
      )
      .catch(() => setFacebook({ connected: false, receiving: true, name: null, oauthAvailable: false }));

  useEffect(() => {
    void loadInstagram();
    void loadFacebook();
    fetch("/api/embed/config")
      .then((r) => r.json())
      .then((d: { success?: boolean; embedUrl?: string }) => d.success && d.embedUrl && setEmbedUrl(d.embedUrl))
      .catch(() => {});
    // How many messages each place kept out, for the "Not customers" row in its window.
    fetch("/api/integrations/gmail/filtered")
      .then((r) => r.json())
      .then((d: { success?: boolean; filtered?: { provider: string }[] }) => {
        const n: Record<string, number> = {};
        for (const f of d.filtered ?? []) n[f.provider] = (n[f.provider] ?? 0) + 1;
        setKept(n);
      })
      .catch(() => {});
  }, []);

  // Back from Facebook with more than one Page: ask which one (its tokens never leave the server).
  const facebookResult = searchParams.get("facebook");
  useEffect(() => {
    if (facebookResult !== "choose_page") return;
    fetch("/api/facebook/oauth/pending-pages")
      .then((r) => r.json())
      .then((d: { pages?: { id: string; name: string }[] }) => {
        setPages(d.pages ?? []);
        setOpen("facebook");
      })
      .catch(() => {});
  }, [facebookResult]);

  // One line at the top after a connect: what just happened, or what went wrong and why.
  const banner: Banner = (() => {
    for (const [key, name, line] of [
      ["instagram", "Instagram", "New DMs show up in Today."],
      ["facebook", "Facebook", "Messenger messages and lead forms show up in Today."],
      ["gmail", "Gmail", "New emails show up within 10 minutes."],
      ["outlook", "Outlook", "New emails show up within 10 minutes."],
    ] as const) {
      const result = searchParams.get(key);
      if (result === "connected") return { kind: "ok", words: `${name} connected. ${line}` };
      if (result === "error") return { kind: "error", words: safeBannerText(searchParams.get("message"), `Couldn't connect ${name}.`) };
    }
    if (signup.justConnected) return { kind: "ok", words: "WhatsApp connected. New messages show up in Today." };
    if (signup.error) return { kind: "error", words: signup.error };
    return null;
  })();

  const show = (which: Open) => {
    setShowKept(false);
    setCopied(false);
    setOpen(which);
  };
  const close = () => {
    setOpen(null);
    setPages(null);
    setPageError(null);
  };

  async function disconnect(which: "instagram" | "facebook" | "whatsapp", name: string) {
    if (!window.confirm(`Disconnect ${name}? New messages stop coming into FollowUp. You can connect it again any time.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${which}/config`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (data.success) {
        if (which === "instagram") await loadInstagram();
        else if (which === "facebook") await loadFacebook();
        else await signup.reload();
        close();
      }
    } finally {
      setBusy(false);
    }
  }

  async function disconnectEmail(which: "gmail" | "outlook") {
    setBusy(true);
    try {
      if (await (which === "gmail" ? onGmailDisconnect() : onOutlookDisconnect())) close();
    } finally {
      setBusy(false);
    }
  }

  async function choosePage(id: string) {
    setBusy(true);
    setPageError(null);
    try {
      const res = await fetch("/api/facebook/oauth/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id }),
      });
      const data: { success: boolean; message?: string } = await res.json();
      if (data.success) {
        setPages(null);
        await loadFacebook();
      } else {
        setPageError(data.message ?? "Couldn't connect that Page.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!embedUrl) return;
    const code = `<iframe src="${embedUrl}" style="width:100%;max-width:420px;height:660px;border:none;" title="Contact us"></iframe>`;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      window.prompt("Copy this code:", code);
    }
  }

  if (!gmail.loaded || !outlook.loaded || !instagram || !facebook || !signup.loaded) return null;

  /** "Not customers": what FollowUp kept out of this place, one tap from bringing one back. */
  const keptRow = (provider: string, channels: "email" | "chats") =>
    (kept[provider] ?? 0) > 0 && (
      <div className="mt-4">
        <button type="button" onClick={() => setShowKept((v) => !v)} className={BOX + " flex min-h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-card-2"}>
          <span className="flex-1 text-[16px]">Skipped: not customers</span>
          <span className="text-[15px] text-ink-faint">{kept[provider]}</span>
        </button>
        <p className="mt-1.5 text-[14px] text-ink-faint">
          {channels === "email" ? "Emails" : "Chats"} FollowUp kept out. One tap moves one back.
        </p>
        {showKept && (
          <div className="mt-3">
            <FilteredEmails channels={channels} provider={provider} bare />
          </div>
        )}
      </div>
    );

  const connect = (href: string, available = true) => (!available ? <Soon /> : isAdmin ? <a href={href} className={PILL}>Connect</a> : null);
  const showOutlook = outlook.connected || (!gmail.connected && !gmailNeedsReconnect && outlookAvailable);
  const showGmail = gmail.connected || gmailNeedsReconnect || !outlook.connected;

  return (
    <div className="grid gap-3">
      {banner && (
        <p role={banner.kind === "error" ? "alert" : "status"} className="text-[15px]" style={{ color: banner.kind === "ok" ? "var(--sage)" : "var(--coral)" }}>
          {banner.words}
        </p>
      )}

      <div className={BOX}>
        {showGmail &&
          (gmail.connected ? (
            <ConnectionRow glyph="gmail" name="Gmail" sub={gmail.email} first onOpen={() => show("gmail")} mark={<ConnectedMark />} />
          ) : gmailNeedsReconnect ? (
            <ConnectionRow
              glyph="gmail"
              name="Gmail"
              sub="Stopped working. Connect it again."
              first
              action={isAdmin ? <a href="/api/integrations/gmail/connect" className={PILL}>Reconnect</a> : <NeedsMark word="Stopped" />}
            />
          ) : (
            <ConnectionRow glyph="gmail" name="Gmail" first action={connect("/api/integrations/gmail/connect")} />
          ))}
        {showOutlook &&
          (outlook.connected ? (
            <ConnectionRow glyph="outlook" name="Outlook" sub={outlook.email} first={!showGmail} onOpen={() => show("outlook")} mark={<ConnectedMark />} />
          ) : (
            <ConnectionRow glyph="outlook" name="Outlook" first={!showGmail} action={connect("/api/integrations/outlook/connect")} />
          ))}
        {instagram.connected ? (
          <ConnectionRow
            glyph="instagram"
            name="Instagram"
            sub={instagram.name}
            onOpen={() => show("instagram")}
            mark={instagram.receiving ? <ConnectedMark /> : <NeedsMark word="Fix" />}
          />
        ) : (
          <ConnectionRow glyph="instagram" name="Instagram" action={connect("/api/instagram/oauth/start", instagram.oauthAvailable)} />
        )}
        {facebook.connected ? (
          <ConnectionRow
            glyph="facebook"
            name="Facebook"
            sub={facebook.name}
            onOpen={() => show("facebook")}
            mark={facebook.receiving ? <ConnectedMark /> : <NeedsMark word="Fix" />}
          />
        ) : (
          <ConnectionRow glyph="facebook" name="Facebook" action={connect("/api/facebook/oauth/start", facebook.oauthAvailable)} />
        )}
        {signup.connected ? (
          <ConnectionRow glyph="whatsapp" name="WhatsApp" sub={signup.displayNumber} onOpen={() => show("whatsapp")} mark={<ConnectedMark />} />
        ) : (
          <ConnectionRow
            glyph="whatsapp"
            name="WhatsApp"
            action={
              !signup.available ? (
                <Soon />
              ) : isAdmin ? (
                <button type="button" onClick={signup.start} disabled={signup.connecting} className={PILL}>
                  {signup.connecting ? "Finishing…" : "Connect"}
                </button>
              ) : null
            }
          />
        )}
        <ConnectionRow
          glyph="web"
          name="Website form"
          action={
            embedUrl ? (
              <button type="button" onClick={() => show("website")} className={PILL}>
                Add
              </button>
            ) : null
          }
        />
      </div>
      {!isAdmin && <p className="text-[14px] text-ink-soft">Only an admin can connect or disconnect these.</p>}

      <p className="mt-4 text-[14px] text-ink-faint">Use a CRM?</p>
      <CrmConfig />

      <p className="mt-4 text-[14px] text-ink-faint">Your calendar</p>
      <CalendarConnection isAdmin={isAdmin} />

      {open === "gmail" && (
        <ConnectionSheet
          label="Gmail"
          glyph="gmail"
          title="Gmail"
          status={<ConnectedAs who={gmail.email} />}
          onClose={close}
          onDisconnect={isAdmin ? () => disconnectEmail("gmail") : undefined}
          disconnectLabel="Disconnect Gmail"
          busy={busy}
        >
          <p className="mt-4 text-[15px] text-ink-soft">{gmailPushActive ? "New emails show up within seconds." : "New emails show up within 10 minutes."}</p>
          {keptRow("gmail", "email")}
        </ConnectionSheet>
      )}

      {open === "outlook" && (
        <ConnectionSheet
          label="Outlook"
          glyph="outlook"
          title="Outlook"
          status={<ConnectedAs who={outlook.email} />}
          onClose={close}
          onDisconnect={isAdmin ? () => disconnectEmail("outlook") : undefined}
          disconnectLabel="Disconnect Outlook"
          busy={busy}
        >
          <p className="mt-4 text-[15px] text-ink-soft">New emails show up within 10 minutes.</p>
          {keptRow("outlook", "email")}
        </ConnectionSheet>
      )}

      {open === "instagram" && (
        <ConnectionSheet
          label="Instagram"
          glyph="instagram"
          title="Instagram"
          status={<ConnectedAs who={instagram.name} />}
          onClose={close}
          onDisconnect={isAdmin ? () => disconnect("instagram", "Instagram") : undefined}
          disconnectLabel="Disconnect Instagram"
          busy={busy}
        >
          {instagram.receiving ? (
            <p className="mt-4 text-[15px] text-ink-soft">New DMs show up in Today.</p>
          ) : (
            <div className="mt-4">
              <ChannelNotReceiving
                platform="Instagram"
                subject="Your account"
                missed="nothing people DM you reaches FollowUp"
                otherCause="the account is no longer set up as a Business or Creator account"
                retryPath="/api/instagram/subscribe"
                onReceiving={() => setInstagram({ ...instagram, receiving: true })}
                stillWorks="FollowUp checks it for new DMs every few minutes and picks them up."
              />
            </div>
          )}
          {keptRow("instagram", "chats")}
        </ConnectionSheet>
      )}

      {open === "facebook" && (
        <ConnectionSheet
          label="Facebook"
          glyph="facebook"
          title="Facebook"
          status={pages ? undefined : facebook.connected ? <ConnectedAs who={facebook.name} /> : undefined}
          onClose={close}
          onDisconnect={isAdmin && facebook.connected && !pages ? () => disconnect("facebook", "Facebook") : undefined}
          disconnectLabel="Disconnect Facebook"
          busy={busy}
        >
          {pages ? (
            <div className="mt-4">
              <p className="text-[15px] text-ink-soft">Which Page should FollowUp answer for?</p>
              <div className={BOX + " mt-3"}>
                {pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choosePage(p.id)}
                    disabled={busy}
                    className={"flex min-h-[52px] w-full items-center px-4 text-left text-[16px] hover:bg-card-2 disabled:opacity-60" + (i ? " border-t border-line-2" : "")}
                  >
                    {p.name}
                  </button>
                ))}
                {pages.length === 0 && <p className="px-4 py-3 text-[15px] text-ink-soft">No Pages came back from Facebook. Connect again and pick one.</p>}
              </div>
              {pageError && (
                <p role="alert" className="mt-2 text-[14px]" style={{ color: "var(--coral)" }}>
                  {pageError}
                </p>
              )}
            </div>
          ) : facebook.receiving ? (
            <p className="mt-4 text-[15px] text-ink-soft">Messenger messages and lead forms show up in Today.</p>
          ) : (
            <div className="mt-4">
              <ChannelNotReceiving
                platform="Facebook"
                subject={facebook.name ?? "Your Page"}
                missed="nothing people send the Page reaches FollowUp"
                otherCause="you no longer manage the Page"
                retryPath="/api/facebook/subscribe"
                onReceiving={() => setFacebook({ ...facebook, receiving: true })}
              />
            </div>
          )}
          {!pages && keptRow("messenger", "chats")}
        </ConnectionSheet>
      )}

      {open === "whatsapp" && (
        <ConnectionSheet
          label="WhatsApp"
          glyph="whatsapp"
          title="WhatsApp"
          status={<ConnectedAs who={signup.displayNumber} />}
          onClose={close}
          onDisconnect={isAdmin ? () => disconnect("whatsapp", "WhatsApp") : undefined}
          disconnectLabel="Disconnect WhatsApp"
          busy={busy}
        >
          <p className="mt-4 text-[15px] text-ink-soft">New messages show up in Today. You keep using the app on your phone as before.</p>
          {keptRow("whatsapp", "chats")}
        </ConnectionSheet>
      )}

      {open === "website" && embedUrl && (
        <ConnectionSheet
          label="Website form"
          glyph="web"
          title="Website form"
          onClose={close}
          primary={
            <button type="button" onClick={copyCode} className="min-h-[50px] w-full rounded-full bg-ink text-[16px] font-semibold text-on-accent">
              {copied ? "Copied ✓" : "Copy the code"}
            </button>
          }
        >
          <p className="mt-4 text-[15px] text-ink-soft">
            Paste it into your website, or send it to whoever made your site. What people send through it shows up in Today.
          </p>
          <a href={embedUrl} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center text-[15px] text-ink-soft underline underline-offset-[3px] hover:text-ink">
            See the form
          </a>
        </ConnectionSheet>
      )}
    </div>
  );
}
