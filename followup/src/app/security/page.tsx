import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import { isAlertEmailConfigured } from "@/lib/alertEmail";

export const metadata = {
  title: "Security",
  description:
    "Security at FollowUp, in plain words: what it can see, how it's kept, what you control, who else handles your data, and what we haven't done yet.",
  alternates: { canonical: "/security" },
};

/*
 * Security, in plain words (design brain A-041, from the Mercury study).
 *
 * Every line is a claim, and every claim was checked against the code on
 * 2026-09-26: the four Google scopes (gmail.ts), the Outlook scopes
 * (outlook.ts), encrypted connection keys (db.ts ENCRYPTED_FIELDS), the
 * step-up sign-in before deletion (business/delete), RLS closing the
 * database to Supabase's public API, the audit trail on each lead page.
 * "Not done yet" is the Mercury lesson: say what you are not before anyone
 * has to ask. Never add a certification, badge or "bank-grade" here that
 * FollowUp doesn't hold (A-023, A-041).
 */

type Row = [title: string, body: string, tech?: string];

const SEE: [group: string, rows: Row[]][] = [
  [
    "Gmail and Google Calendar",
    [
      ["Read your email", "To find the customers writing to you.", "gmail.readonly"],
      ["Send email as you", "Replies go out from your own address.", "gmail.send"],
      ["Add events to your calendar", "Only when a customer books a time.", "calendar.events"],
      ["See your email address", "To know which account is yours.", "userinfo.email"],
    ],
  ],
  ["Outlook and Microsoft 365", [["Read and send your mail", "The same as Gmail, if you use Outlook instead.", "Mail.Read · Mail.Send"]]],
  ["Instagram, Messenger and WhatsApp", [["Messages to the accounts you connect", "And sending the replies you approve."]]],
];

const KEPT: Row[] = [
  ["No FollowUp password", "You sign in with Google, so there's no FollowUp password to steal or reuse."],
  ["Connection keys are encrypted", "The keys that reach your Gmail, Outlook, Instagram, Facebook or WhatsApp are encrypted before they're stored."],
  ["Deleting asks who you are", "Before an account can be deleted, you sign in with Google again."],
  ["Kept to your business", "Your customers, messages and settings belong to your business. Other FollowUp customers can never see them."],
  ["Closed to the internet", "The database answers only FollowUp's own server."],
  ["Everything is written down", "Each message FollowUp sends or holds is recorded with the reason. You see it on each customer's page."],
];

function control(emailsOn: boolean): Row[] {
  return [
    ["Every reply waits for your OK", "Every account starts this way. Simple replies go by themselves only if you turn that on."],
    ["Pause all sending", "One tap holds everything until you resume. Your settings stay as they are."],
    ["Only admins send", "Teammates write and edit replies. An admin sends them."],
    [
      "Recent sign-ins",
      emailsOn
        ? "See where your account was signed in. If it's signed in from a device we haven't seen, we email you."
        : "See where your account was signed in over the last 90 days.",
    ],
    ["Sign out everywhere", "One tap signs out every device within 5 minutes."],
    ["Download or delete everything", "Any time, from Settings. Deleting is permanent."],
  ];
}

const OTHERS: Row[] = [
  ["Google", "Sign-in, Gmail and Google Calendar."],
  ["Microsoft", "Outlook, if you connect it."],
  ["Meta", "Instagram, Messenger, Facebook Lead Ads and WhatsApp."],
  ["Twilio", "Text messages and calls, if you connect it."],
  ["OpenAI", "Writes and scores the drafts. It doesn't train on your data."],
  ["Stripe", "Billing."],
  ["Supabase and Vercel", "The database and the servers."],
  ["Sentry", "Error reports, with emails and phone numbers removed."],
  ["Resend", "The emails FollowUp sends you, like “a customer is waiting”."],
];

const NOT_YET: Row[] = [
  ["No outside security audit yet", "Larger companies show a SOC 2 report. We're small and new, and we don't have one yet. When we do, it will be listed here."],
  ["No outside penetration test yet", "No outside firm has tried to break in yet. It's on our list."],
  ["Google is still verifying FollowUp", "Until it has, only people we add by hand can sign in."],
];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-3">
      {rows.map(([title, body, tech]) => (
        <li key={title} className="py-3 border-t border-line flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div className="min-w-0 flex-1 basis-72">
            <p className="text-ink font-medium">{title}</p>
            <p className="mt-0.5">{body}</p>
          </div>
          {tech && <code className="font-mono text-xs text-ink-soft">{tech}</code>}
        </li>
      ))}
    </ul>
  );
}

function Section({ id, label, title, lede, children }: { id: string; label: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{label}</p>
      <h2 className="font-display text-2xl text-ink mt-2">{title}</h2>
      {lede && <p className="mt-2">{lede}</p>}
      {children}
    </section>
  );
}

export default function SecurityPage() {
  const emailsOn = isAlertEmailConfigured();
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
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">Security</p>
        <h1 className="font-display text-4xl mt-2 text-balance">Security, in plain words.</h1>
        <p className="mt-4 text-ink-soft text-lg leading-relaxed max-w-xl">
          What FollowUp can see, how it&apos;s kept, what you control, and what we haven&apos;t done yet.
        </p>
        <p className="text-sm text-ink-soft mt-2">Updated September 26, 2026</p>

        <div className="mt-14 space-y-14 text-sm leading-relaxed text-ink-soft">
          <Section
            id="see"
            label="What FollowUp can see"
            title="Only what you connect."
            lede="Each connection asks for the least it needs. Here is everything, in plain words, with the technical name beside it."
          >
            {SEE.map(([group, rows]) => (
              <div key={group} className="mt-5">
                <p className="text-ink font-semibold">{group}</p>
                <Rows rows={rows} />
              </div>
            ))}
            <p className="mt-4">
              Disconnect any of them in Settings and FollowUp&apos;s access stops right away. To remove what&apos;s
              already stored, delete it (see below).
            </p>
          </Section>

          <Section id="kept" label="How it's kept" title="Locked, and kept apart.">
            <Rows rows={KEPT} />
          </Section>

          <Section id="control" label="What you control" title="Yours to switch off." lede="No need to ask us. Each of these is in Settings.">
            <Rows rows={control(emailsOn)} />
          </Section>

          <Section id="others" label="Who else handles it" title="The companies we use.">
            <Rows rows={OTHERS} />
            <p className="mt-4">
              We never sell your data. The full details are in our{" "}
              <Link href="/privacy" className="underline text-ink">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section id="not-yet" label="Not done yet" title="What we haven't done yet." lede="We'd rather tell you than have you find out.">
            <div className="mt-4 rounded-xl px-5 py-1" style={{ backgroundColor: "var(--card-2)" }}>
              <ul>
                {NOT_YET.map(([title, body], i) => (
                  <li key={title} className={`py-3 ${i ? "border-t border-line" : ""}`}>
                    <p className="text-ink font-medium">{title}</p>
                    <p className="mt-0.5">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          <Section id="tell-us" label="Found a problem?" title="Tell us.">
            <p className="mt-3 text-ink">
              If something doesn&apos;t look safe, email{" "}
              <a href="mailto:contact@followupbase.io" className="underline">
                contact@followupbase.io
              </a>
              . Sahil, who builds FollowUp, reads every message.
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-soft">
        <Link href="/" className="underline">
          FollowUp
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
