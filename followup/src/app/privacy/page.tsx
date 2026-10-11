import Link from "next/link";
import LogoMark from "@/components/LogoMark";

export const metadata = {
  // The title template in layout.tsx appends " — FollowUp", so this is just
  // the page's own name. The description is the point: without one, this page
  // inherited the homepage's sales pitch, and Google showed the privacy
  // policy to someone searching for the product, described as "Never lose a
  // lead because you forgot to follow up." (Founder, 2026-09-21.)
  title: "Privacy Policy",
  description:
    "How FollowUp handles your data: what it collects from your connected inbox and social accounts, what it never does with it, how Google and Meta user data is used under their Limited Use rules, how it is protected, and how to export or delete everything.",
  alternates: { canonical: "/privacy" },
};

// Static legal page — no auth, no DB, no client JS. Required for both
// Google OAuth verification and Meta App Review (the consent screen and
// the App Review submission both link here), so the Google API Services
// User Data Policy / Limited Use section and the Meta Platform Terms
// section below each use that platform's own required framing, not a
// generic paraphrase.
export default function PrivacyPage() {
  return (
    <div>
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark height={20} />
            <span className="font-display text-lg">FollowUp</span>
          </Link>
          <Link href="/" className="text-sm text-ink-soft">
            Back home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl">Privacy Policy</h1>
        <p className="text-sm text-ink-soft mt-2">Last updated: October 11, 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-display text-xl text-ink">Who we are</h2>
            <p className="mt-2">
              FollowUp (&quot;FollowUp&quot;, &quot;we&quot;, &quot;us&quot;) helps businesses reply to their own
              customers on time. This policy explains what data we collect, why, and how you can control it.
              Contact us at{" "}
              <a href="mailto:contact@followupbase.io" className="underline">
                contact@followupbase.io
              </a>{" "}
              with any questions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">What we collect</h2>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>
                <strong className="text-ink">Account info</strong> — your name and email address from Google
                sign-in.
              </li>
              <li>
                <strong className="text-ink">Sign-ins</strong> — each time you sign in, the kind of browser and
                device (for example, &quot;Chrome on Mac&quot;) and the approximate city our host reports. Never
                your IP address. We keep them for 90 days so you can see recent sign-ins in Settings and so we can
                email you about a sign-in from a device we haven&apos;t seen before.
              </li>
              <li>
                <strong className="text-ink">Gmail and Outlook data</strong> — with your explicit permission, we
                read recent inbox threads to identify customer conversations, and store the ones we identify as
                leads (sender, subject, message content, timestamps) so we can score them and draft replies.
                By default, FollowUp never sends anything until you approve it. If you choose to turn on
                sending without asking (in Settings, or for a specific lead), FollowUp sends only simple,
                low-risk follow-ups for you; anything about price or anything sensitive still waits for you.
              </li>
              <li>
                <strong className="text-ink">Your past Gmail replies (only if you turn on &quot;Write like me&quot;)</strong>
                {" "}— we read the replies you sent from Gmail in the last 12 months and keep up to 300 of them, with names,
                email addresses, phone numbers and street addresses removed first, so your drafts sound like you. They are
                used only for your own drafts, never for anyone else and never to train an AI model. Turning it off
                deletes them all.
              </li>
              <li>
                <strong className="text-ink">Instagram and Facebook data</strong> — with your explicit permission
                (connecting your Instagram professional account or Facebook Page), we receive the direct messages
                and lead-form submissions sent to your account, so we can identify them as leads, score them, and
                draft replies. By default, FollowUp never sends anything until you approve it. If you choose to turn on
                sending without asking (in Settings, or for a specific lead), FollowUp sends only simple,
                low-risk follow-ups for you; anything about price or anything sensitive still waits for you.
              </li>
              <li>
                <strong className="text-ink">WhatsApp data</strong> — when you connect your WhatsApp Business
                number through Meta, we receive the messages sent to and from that number so we can identify
                customers and draft replies. Because it may be the same number you use for personal chats, a
                message from someone who isn&apos;t already a lead is first checked by our AI provider. Chats
                that look personal are set aside rather than treated as leads; we keep them only so you can
                bring one back if we got it wrong, and they are deleted with your account.
              </li>
              <li>
                <strong className="text-ink">Leads you add yourself</strong> — manually entered leads, ones
                imported via CSV, and contacts from a CRM you connect (Follow Up Boss or HubSpot), where we also
                add a note back when you send a message.
              </li>
              <li>
                <strong className="text-ink">Billing info</strong> — handled entirely by Stripe; we never see
                or store your card details ourselves.
              </li>
              <li>
                <strong className="text-ink">Usage data</strong> — basic product analytics (pages visited,
                features used) to improve FollowUp.
              </li>
              <li>
                <strong className="text-ink">A record of what FollowUp did</strong> — every message FollowUp
                drafts, holds or sends is written down with the reason, so you can see what happened and why.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Google user data — Limited Use disclosure</h2>
            <p className="mt-2">
              FollowUp&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Specifically:
            </p>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>We only access the Gmail and Google Calendar scopes needed to identify sales conversations, send follow-ups on your behalf, and create a calendar event when a lead asks to schedule a call.</li>
              <li>We never use Gmail or Calendar data for advertising.</li>
              <li>We never use Gmail or Calendar data to develop, improve or train generalized AI or machine-learning models. When you turn on &quot;Write like me&quot;, your past replies are used only to shape your own drafts.</li>
              <li>We never allow humans to read Gmail or Calendar data except: (a) with your explicit consent, (b) to investigate abuse or a security issue, or (c) to comply with the law.</li>
              <li>We never transfer Gmail or Calendar data to third parties except our AI processing provider (to draft/score follow-ups on your behalf), or as required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Instagram and Facebook data — Meta Platform Terms</h2>
            <p className="mt-2">
              FollowUp&apos;s use of data received from Meta&apos;s Instagram and Facebook APIs adheres to the{" "}
              <a
                href="https://developers.facebook.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Meta Platform Terms
              </a>
              . Specifically:
            </p>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>We only request the permissions needed to receive Instagram/Messenger DMs, WhatsApp messages and Facebook Lead Ads submissions, and to reply to them on your behalf.</li>
              <li>We only reply to people who have messaged your business first. We never message people who haven&apos;t contacted you.</li>
              <li>We never use this data for advertising, and never sell it.</li>
              <li>We never allow humans to read it except: (a) with your explicit consent, (b) to investigate abuse or a security issue, or (c) to comply with the law.</li>
              <li>We never transfer it to third parties except our AI processing provider (to draft/score follow-ups on your behalf), or as required by law.</li>
              <li>
                To request deletion of your Instagram/Facebook data, use the account-deletion process below, or
                remove FollowUp&apos;s access directly from your Facebook{" "}
                <a
                  href="https://www.facebook.com/settings?tab=business_tools"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Business Integrations settings
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">How we use AI</h2>
            <p className="mt-2">
              To score leads and draft follow-up messages, relevant conversation text is sent to our AI
              provider (currently OpenAI) for processing. That provider does not use your data to train its
              models under our account terms with them. AI-drafted messages are never sent without your
              approval unless you have turned on sending without asking, as described above.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Helping improve FollowUp (off unless you turn it on)</h2>
            <p className="mt-2">
              In Settings you can choose to help improve FollowUp. It is off by default. If you turn it on, we
              keep FollowUp&apos;s draft beside the message you actually sent, and review the differences in
              de-identified form (names, email addresses and phone numbers removed) to improve how FollowUp
              writes. We do not train AI models on your data. You can turn it off at any time.
            </p>
          </section>

          {/* Added 2026-10-06: Google's verification review asked the policy to
              say how sensitive data is protected. Every line was checked against
              the code (src/lib/crypto.ts, src/lib/db.ts, next.config.ts) and the
              live database before it went in; keep it that way. */}
          <section>
            <h2 className="font-display text-xl text-ink">How we protect your data</h2>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>
                <strong className="text-ink">Encrypted in transit</strong> — every connection to FollowUp uses
                HTTPS (TLS), and browsers are told never to connect to us without it.
              </li>
              <li>
                <strong className="text-ink">Encrypted at rest</strong> — our database provider (Supabase) encrypts
                everything we store. On top of that, the keys that let FollowUp reach your accounts (Gmail and
                Outlook access, Instagram, Facebook and WhatsApp access, your Twilio auth token and CRM API keys)
                are encrypted again by FollowUp with AES-256-GCM before they are saved, using a key that is kept
                outside the database.
              </li>
              <li>
                <strong className="text-ink">No passwords to steal</strong> — you sign in with Google, so FollowUp
                never stores a password.
              </li>
              <li>
                <strong className="text-ink">Each business&apos;s data is kept apart</strong> — every request is
                checked against your signed-in account and your business before anything is read or changed, and
                the database refuses direct outside access to every table.
              </li>
              <li>
                <strong className="text-ink">Only real messages get in</strong> — messages from Google, Meta,
                Twilio and Stripe are accepted only with that service&apos;s signature or a secret only it holds.
              </li>
              <li>
                <strong className="text-ink">Less personal data in more places</strong> — error reports have email
                addresses and phone numbers removed, and past replies kept for &quot;Write like me&quot; have names,
                email addresses, phone numbers and street addresses removed before they are stored.
              </li>
              <li>
                <strong className="text-ink">You can see who signed in</strong> — Settings lists recent sign-ins,
                we email you when your account is signed in from a new device, and exporting or deleting your
                data asks you to sign in again first.
              </li>
              <li>
                <strong className="text-ink">If something goes wrong</strong> — we have a written plan for it. We
                stop the problem, tell the affected businesses in plain words what happened and what to do, and
                report it to the privacy regulator where the law requires.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Data retention &amp; deletion</h2>
            <p className="mt-2">
              We keep your data for as long as your account is active. You can delete an individual lead (and
              its full conversation history) at any time from that lead&apos;s page. You can export all of
              your data, or delete your entire account and all associated data, yourself from Settings → Your
              data. You can also email{" "}
              <a href="mailto:contact@followupbase.io" className="underline">
                contact@followupbase.io
              </a>{" "}
              and we&apos;ll confirm deletion within 2 business days. Revoking FollowUp&apos;s Gmail access at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                myaccount.google.com/permissions
              </a>{" "}
              stops future access immediately; it doesn&apos;t delete data already stored — use the account
              deletion request above for that.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Cookies and your browser</h2>
            <p className="mt-2">
              FollowUp uses only the cookies it needs to work. There are no advertising or tracking cookies, and
              nothing that follows you to other websites.
            </p>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li>
                <strong className="text-ink">Signing in</strong> — keeps you signed in, for up to 7 days, and protects
                the forms you submit.
              </li>
              <li>
                <strong className="text-ink">Connecting an account</strong> — while you connect Gmail, Outlook,
                Instagram or Facebook, a short-lived cookie makes sure the connection comes back to you. It ends after
                10 minutes.
              </li>
              <li>
                <strong className="text-ink">Team invites</strong> — remembers the invite link you opened until you
                finish signing in, for up to an hour.
              </li>
            </ul>
            <p className="mt-2">
              Your browser also keeps a few small notes for FollowUp on your own device: a reply you started writing,
              until you close the tab, so it isn&apos;t lost; the last day you opened the app, so we count it once;
              whether you said &quot;Not now&quot; to phone alerts; and, on our home page, whether animations should
              be calmer on a slower computer.
            </p>
            <p className="mt-2">
              We count visits to our pages with Vercel Web Analytics, which uses no cookies and stores no personal
              data; only the page&apos;s address is sent. If you open the WhatsApp section of Settings, Facebook&apos;s
              own script loads so you can connect WhatsApp, and Facebook may set its own cookies under its own policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Third parties we use</h2>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li><strong className="text-ink">Google</strong> — sign-in, Gmail and Google Calendar access.</li>
              <li><strong className="text-ink">Microsoft</strong> — Outlook / Microsoft 365 access, if you connect it.</li>
              <li><strong className="text-ink">Meta</strong> — Instagram DM, Messenger, Facebook Lead Ads and WhatsApp access.</li>
              <li><strong className="text-ink">Twilio</strong> — text messages and voice calls, if you connect it (and WhatsApp for businesses that connected it through Twilio before).</li>
              <li><strong className="text-ink">Follow Up Boss and HubSpot</strong> — only if you connect your CRM.</li>
              <li><strong className="text-ink">OpenAI</strong> — AI scoring and message drafting.</li>
              <li><strong className="text-ink">Stripe</strong> — subscription billing.</li>
              <li><strong className="text-ink">Supabase and Vercel</strong> — database and application hosting.</li>
              <li><strong className="text-ink">Sentry</strong> — error reports, with email addresses and phone numbers removed.</li>
              <li><strong className="text-ink">Resend</strong> — the alert emails FollowUp sends to you, like when a customer is waiting or your account is signed in from a new device (sent from the United States).</li>
            </ul>
            <p className="mt-2">We never sell your data.</p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Your rights</h2>
            <p className="mt-2">
              Depending on where you live, you may have rights to access, correct, export, or delete your
              personal data, and to object to certain processing. To exercise any of these, contact{" "}
              <a href="mailto:contact@followupbase.io" className="underline">
                contact@followupbase.io
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Changes to this policy</h2>
            <p className="mt-2">
              If we make material changes, we&apos;ll notify you by email or an in-app notice before they take
              effect.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-soft">
        <Link href="/" className="underline">
          FollowUp
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
