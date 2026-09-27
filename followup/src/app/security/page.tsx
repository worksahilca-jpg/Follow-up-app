import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import styles from "@/components/landing/v2/landing.module.css";
import s from "@/components/landing/v2/security.module.css";
import { ChannelIcon } from "@/components/landing/v2/icons";
import { isAlertEmailConfigured } from "@/lib/alertEmail";
import { publicSans, ibmPlexMono } from "@/lib/fonts";

export const metadata = {
  title: "Security",
  description:
    "Security at FollowUp, in plain words: what it can see, how it's kept, what you control, who else handles your data, and what we haven't done yet.",
  alternates: { canonical: "/security" },
};

/*
 * Security, in plain words (design brain A-041, from the Mercury study),
 * shown instead of listed (A-064): a picture of where messages go, the
 * permissions as chips, the switches as a picture of Settings.
 *
 * Every line is a claim, and every claim was checked against the code:
 * the Google scopes (gmail.ts), the Outlook scopes (outlook.ts), encrypted
 * connection keys (db.ts ENCRYPTED_FIELDS), the step-up sign-in before
 * deletion (business/delete), RLS closing the database to Supabase's
 * public API, the audit trail on each lead page, and the Automatic /
 * Assisted choice in onboarding. "Not done yet" is the Mercury lesson: say
 * what you are not before anyone has to ask. Never add a certification,
 * badge or "bank-grade" here that FollowUp doesn't hold (A-023, A-041).
 */

const SCOPES: [plain: string, tech: string][] = [
  ["Read your email", "gmail.readonly"],
  ["Send email as you", "gmail.send"],
  ["Add bookings to your calendar", "calendar.events"],
  ["See your email address", "userinfo.email"],
  ["Outlook: read and send", "Mail.Read · Mail.Send"],
];

const CHANNELS: [icon: string, name: string][] = [
  ["Gmail", "Gmail"],
  ["Outlook", "Outlook"],
  ["Instagram", "Instagram"],
  ["Messenger", "Messenger"],
  ["WhatsApp", "WhatsApp"],
  ["Your website", "Website form"],
];

const ICONS: Record<string, React.ReactNode> = {
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4" />
      <path d="m10.5 12.5 9-9" />
      <path d="m16.5 6.5 3 3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  who: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="m16 11 2 2 4-4" />
    </>
  ),
  yours: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
    </>
  ),
  closed: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  log: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
};

const KEPT: [icon: string, name: string, body: string][] = [
  ["key", "No FollowUp password", "You sign in with Google, so there’s none to steal."],
  ["lock", "Keys encrypted", "Connection keys are encrypted before they’re stored."],
  ["who", "Deleting asks who you are", "You sign in with Google again first."],
  ["yours", "Kept to your business", "Other FollowUp customers never see it."],
  ["closed", "Closed to the internet", "The database answers only our server."],
  ["log", "Everything written down", "Each message is recorded with its reason."],
];

const COMPANIES: [name: string, what: string][] = [
  ["Google", "Sign-in, Gmail, Calendar"],
  ["Microsoft", "Outlook, if you connect it"],
  ["Meta", "Instagram, Messenger, WhatsApp, Lead Ads"],
  ["Twilio", "Texts and calls, if you connect it"],
  ["OpenAI", "Writes the drafts; doesn’t train on your data"],
  ["Stripe", "Billing"],
  ["Supabase · Vercel", "The database and the servers"],
  ["Sentry", "Error reports, contact details removed"],
  ["Resend", "The emails FollowUp sends you"],
];

const NOT_YET: [name: string, body: string][] = [
  ["No outside security audit yet", "Larger companies show a SOC 2 report. We don’t have one yet. When we do, it goes here."],
  ["No outside penetration test yet", "No outside firm has tried to break in yet. It’s on our list."],
  ["Google is still verifying FollowUp", "Until it has, only people we add can sign in."],
];

function Toggle({ on }: { on?: boolean }) {
  return (
    <span className={`${s.toggle} ${on ? s.toggleOn : ""}`} aria-hidden="true">
      <span />
    </span>
  );
}

function PillBtn({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return <span className={`${s.pillBtn} ${danger ? s.danger : ""}`}>{children}</span>;
}

function settings(emailsOn: boolean): [name: string, body: string, control: React.ReactNode, state: string][] {
  return [
    ["Ask before every reply", "Or choose Automatic: simple replies go by themselves.", <Toggle key="t" on />, "on"],
    ["Pause all sending", "One tap holds everything.", <Toggle key="t" />, "off"],
    ["Only admins send", "Teammates write; an admin sends.", <Toggle key="t" />, "off"],
    emailsOn
      ? ["New sign-in emails", "When a device we haven’t seen signs in.", <Toggle key="t" on />, "on"]
      : ["Recent sign-ins", "Where your account was signed in, last 90 days.", <PillBtn key="t">View</PillBtn>, "a list"],
    ["Sign out everywhere", "Every device, within 5 minutes.", <PillBtn key="t">Sign out all</PillBtn>, "a button"],
    [
      "Your data",
      "Download it or delete it. Deleting is permanent.",
      <span key="t" className={s.pills}>
        <PillBtn>Download</PillBtn>
        <PillBtn danger>Delete</PillBtn>
      </span>,
      "two buttons",
    ],
  ];
}

function Arrow({ down }: { down?: boolean }) {
  return down ? (
    <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true" className={s.linkDown}>
      <path d="M7 0v17" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 13l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="120" height="12" viewBox="0 0 120 12" aria-hidden="true" className={s.linkRight}>
      <path d="M2 6h112" stroke="currentColor" strokeWidth="1.6" />
      <path d="M108 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ id, label, title, lede, children }: { id: string; label: string; title: React.ReactNode; lede?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={s.sec} aria-labelledby={`${id}-h`}>
      <div className={styles.mono}>{label}</div>
      <h2 id={`${id}-h`} className={s.h2}>
        {title}
      </h2>
      {lede && <p className={s.secLede}>{lede}</p>}
      <div className={s.inner}>{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  const emailsOn = isAlertEmailConfigured();
  const rows = settings(emailsOn);
  return (
    <div className={`${styles.root} ${publicSans.variable} ${ibmPlexMono.variable}`}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="FollowUp, home">
            <LogoMark height={22} />
            <span className={styles.brandWord}>FollowUp</span>
          </Link>
          <nav className={styles.nav} aria-label="Site">
            <Link href="/#demo">How it works</Link>
            <Link href="/#prices">Prices</Link>
            <Link href="/#questions">Questions</Link>
          </nav>
          <div className={styles.headerRight}>
            <Link href="/signin" className={`${styles.plain} ${styles.signInLink}`}>
              Sign in
            </Link>
            <Link href="/signin" className={`${styles.btn} ${styles.btnSm}`}>
              Start free
            </Link>
          </div>
        </header>
      </div>

      <main className={styles.wrap}>
        <section className={s.hero}>
          <div className={styles.mono}>Security</div>
          <h1 className={s.h1}>
            Security,
            <br />
            in plain words.
          </h1>
          <p className={s.lede}>What it can see, how it’s kept, what you control, and what we haven’t done yet.</p>
          <p className={s.updated}>Updated September 27, 2026</p>
          <nav className={s.jump} aria-label="On this page">
            <a href="#see">What it can see</a>
            <a href="#kept">How it’s kept</a>
            <a href="#control">What you control</a>
            <a href="#others">Who else</a>
            <a href="#not-yet">Not done yet</a>
          </nav>
        </section>

        <Section id="see" label="What it can see" title="Only what you connect.">
          <div className={s.flow} role="img" aria-label="FollowUp reads the inboxes and DMs you connect, and replies to your customer from your own address.">
            <div className={s.box}>
              <div className={styles.mono}>Your inbox and DMs</div>
              <ul className={s.chans}>
                {CHANNELS.map(([icon, name]) => (
                  <li key={name}>
                    <ChannelIcon name={icon} />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.link}>
              <Arrow down />
              Reads new messages
              <Arrow />
            </div>
            <div className={s.hub}>
              <LogoMark height={34} />
              <div className={s.hubName}>FollowUp</div>
              <div className={s.hubLine}>Finds who wrote to you and writes the reply</div>
            </div>
            <div className={s.link}>
              <Arrow down />
              Replies from your address
              <Arrow />
            </div>
            <div className={s.box}>
              <div className={styles.mono}>Your customer</div>
              <div className={s.reply}>Hi Sarah, happy to help. Which day suits you?</div>
              <div className={styles.mono} style={{ marginTop: 8, fontSize: 10.5, letterSpacing: "0.08em" }}>
                From your own address
              </div>
            </div>
          </div>
          <div className={s.scopes} aria-label="What FollowUp asks Google and Microsoft for">
            {SCOPES.map(([plain, tech]) => (
              <span key={tech} className={s.scope}>
                <span>{plain}</span>
                <code>{tech}</code>
              </span>
            ))}
          </div>
          <p className={s.note}>
            Disconnect any of them in Settings and access stops right away. To remove what’s already stored, delete it (below).
          </p>
        </Section>

        <Section id="kept" label="How it’s kept" title="Locked, and kept apart.">
          <ul className={s.kept}>
            {KEPT.map(([icon, name, body]) => (
              <li key={name}>
                <span className={s.icon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[icon]}
                  </svg>
                </span>
                <div>
                  <div className={s.factName}>{name}</div>
                  <div className={s.factBody}>{body}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <section id="control" className={`${s.sec} ${s.control}`} aria-labelledby="control-h">
          <div>
            <div className={styles.mono}>What you control</div>
            <h2 id="control-h" className={s.h2}>
              Yours to
              <br />
              switch off.
            </h2>
            <p className={s.secLede}>No need to ask us. It’s all in Settings.</p>
          </div>
          <div className={s.panel}>
            <div className={s.panelTop}>
              <span className={s.panelTitle}>Settings</span>
              <span className={styles.mono}>What you control</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {rows.map(([name, body, control, state]) => (
                <li key={name} className={s.setting}>
                  <div style={{ minWidth: 0 }}>
                    <div className={s.settingName}>{name}</div>
                    <div className={s.settingBody}>{body}</div>
                  </div>
                  <span className="sr-only">Shown as {state}.</span>
                  {control}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Section id="others" label="Who else handles it" title="The companies we use.">
          <dl className={s.companies}>
            {COMPANIES.map(([name, what]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
          <p className={s.note}>
            We never sell your data. The details are in the <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </Section>

        <Section id="not-yet" label="Not done yet" title="What we haven’t done yet." lede="We’d rather tell you than have you find out.">
          <ul className={s.notYet}>
            {NOT_YET.map(([name, body]) => (
              <li key={name}>
                <div className={s.notYetName}>{name}</div>
                <div className={s.notYetBody}>{body}</div>
              </li>
            ))}
          </ul>
        </Section>

        <section id="tell-us" className={s.tell} aria-label="Found a problem?">
          Something doesn’t look safe? Email <a href="mailto:contact@followupbase.io">contact@followupbase.io</a>. Sahil, who builds FollowUp, reads
          every message.
        </section>
      </main>

      <footer className={s.foot}>
        <div className={`${styles.wrap} ${s.footInner}`}>
          <div className={s.footBrand}>
            <LogoMark height={18} />
            <span>So no customer gets forgotten.</span>
          </div>
          <nav className={s.footLinks} aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:contact@followupbase.io">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
