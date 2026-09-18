import Link from "next/link";
import {
  ArrowRight,
  Check,
  Inbox,
  Eye,
  Languages,
  ShieldCheck,
  MessageCircle,
  Users,
  Send,
  PauseCircle,
  FileText,
} from "lucide-react";
import styles from "./landing-light.module.css";
import LandingNavLight from "@/components/landing/light/LandingNavLight";
import HeroStoryLight from "@/components/landing/light/HeroStoryLight";
import RevealLight from "@/components/landing/light/RevealLight";
import FaqLight from "@/components/landing/light/FaqLight";
import LogoMark from "@/components/landing/light/LogoMark";
import CountUp from "@/components/motion/CountUp";
import { bricolageGrotesque, publicSans, ibmPlexMono, instrumentSerif } from "@/lib/fonts";
import { TIER_INFO, FREE_TIER_LEAD_CAP } from "@/lib/pricing";

// "Light direction" — the marketing page rebuilt on 2026-09-18 in the
// structure, rhythm and motion of the founder's chosen reference template,
// inverted onto white and grey, with FollowUp's own content in every
// section. Copy is carried over from the CEO-approved copy-accuracy pass
// (real channel list, the ASSISTED-by-default guarantee, the sourced
// 62% / 63% / 29–47 hrs benchmarks) and extended only where the new
// section shape needed a line. Nothing here is a claim about a customer:
// no testimonials, no customer logos, no results — FollowUp has no
// customers to quote yet, and an invented one is the one thing this page
// must never carry. See design-brain/decisions/design-decisions.md,
// 2026-09-18.
export default function LandingPage() {
  return (
    <div className={`${styles.root} ${bricolageGrotesque.variable} ${publicSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}>
      <LandingNavLight />

      {/* ---------- Hero ---------- */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <RevealLight mode="mount" y={10}>
            <span className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              New: reply buttons on Instagram and Messenger follow-ups
            </span>
          </RevealLight>
          <RevealLight mode="mount" delay={0.05}>
            <h1 className={styles.heroTitle}>
              Every tool answers the lead. FollowUp catches the one that <span className={styles.em}>went quiet.</span>
            </h1>
          </RevealLight>
          <RevealLight mode="mount" delay={0.1}>
            <p className={styles.heroLede}>
              You already paid to get them. Losing them after costs more. FollowUp reads every conversation, not just the
              new ones, and catches the lead who heard from you once and then went silent, before &ldquo;let me think
              about it&rdquo; turns into a lost sale.
            </p>
          </RevealLight>
          <RevealLight mode="mount" delay={0.15}>
            <div className={styles.heroActions}>
              <Link href="/signin" className={styles.btnPrimary}>
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className={styles.btnGhost}>
                See how it works
              </a>
            </div>
            <p className={styles.heroFine}>No credit card required.</p>
          </RevealLight>
          <RevealLight mode="mount" delay={0.2}>
            <div className={styles.strip}>
              <p className={styles.stripLabel}>Reads what you already use</p>
              <div className={styles.stripRow}>
                {["Gmail", "Outlook", "Instagram", "Messenger", "WhatsApp", "HubSpot", "Follow Up Boss"].map((name) => (
                  <span key={name} className={styles.chip}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </RevealLight>
        </div>
        <HeroStoryLight />
        <div style={{ height: 64 }} />
      </header>

      {/* ---------- Product ---------- */}
      <section id="product" className={styles.section}>
        <RevealLight className={styles.sectionHeadCenter}>
          <span className={styles.badge}>Product</span>
          <h2 className={styles.title}>
            The follow-up, <span className={styles.em}>handled.</span>
          </h2>
          <p className={styles.lede}>
            From the first reply to the last nudge, FollowUp does the part an owner never has time for, and shows its
            work.
          </p>
        </RevealLight>

        <div className={styles.grid2}>
          <RevealLight>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Who needs you today</h3>
              <p className={styles.cardBody}>
                Every open lead ranked by how likely you are to lose them, with the reason in plain words, not a score
                you have to decode.
              </p>
              <div className={styles.cardFigure}>
                {[
                  { s: "92", n: "Sarah Johnson", w: "Asked about pricing, no reply in 5 days", pill: "Needs you", cls: styles.pillCoral },
                  { s: "74", n: "Mike Patel", w: "Requested a proposal 3 days ago", pill: "Going cold", cls: styles.pillGold },
                  { s: "45", n: "Devon Ruiz", w: "Waiting on their answer since Tuesday", pill: "Waiting", cls: styles.pillSlate },
                ].map((r) => (
                  <div key={r.n} className={styles.leadRow}>
                    <span className={styles.score}>{r.s}</span>
                    <div className="min-w-0">
                      <div className={styles.leadName}>{r.n}</div>
                      <div className={styles.leadWhy}>{r.w}</div>
                    </div>
                    <span className={`${styles.pill} ${r.cls}`}>{r.pill}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>

          <RevealLight delay={0.08}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Every message, on the record</h3>
              <p className={styles.cardBody}>
                What went out, why, and what was held for you. Nothing FollowUp does is a surprise you find out about
                from a customer.
              </p>
              <div className={styles.cardFigure}>
                {[
                  { t: "Sent a check-in to Sarah", w: "5 days quiet after a pricing question", when: "9:14", cls: styles.pillSage, pill: "Sent" },
                  { t: "Held a draft for Mike", w: "It mentions a price. That is yours to say.", when: "8:50", cls: styles.pillGold, pill: "Needs you" },
                  { t: "Stopped the sequence for Priya", w: "She replied. Nothing more goes out.", when: "8:02", cls: styles.pillSlate, pill: "Stopped" },
                ].map((r) => (
                  <div key={r.t} className={styles.liveRow}>
                    <div className="min-w-0">
                      <div className={styles.leadName}>{r.t}</div>
                      <div className={styles.leadWhy}>{r.w}</div>
                    </div>
                    <span className={`${styles.pill} ${r.cls}`}>{r.pill}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>

          <RevealLight>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Drafts that sound like you</h3>
              <p className={styles.cardBody}>
                Written from how you actually talk to that lead, in their language, and never stating a fact that is
                not in the thread. On Instagram it is one short question with buttons.
              </p>
              <div className={styles.cardFigure}>
                <div className="text-[11px] font-bold" style={{ color: "var(--accent-deep)", letterSpacing: "0.08em" }}>
                  DRAFT READY FOR SARAH
                </div>
                <p className="mt-1.5 text-[13.5px] font-bold">Re: Your proposal</p>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  Wanted to check in, I know you&apos;ve had a look at the numbers a couple of times. Happy to walk through
                  anything that&apos;s unclear.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className={`${styles.btnPrimary} ${styles.btnSmall}`} style={{ boxShadow: "none" }}>
                    Send
                  </span>
                  <span className={`${styles.btnGhost} ${styles.btnSmall}`}>Edit</span>
                </div>
                <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                  <div className="text-[11px] font-bold" style={{ color: "var(--ink-faint)", letterSpacing: "0.08em" }}>
                    ON INSTAGRAM
                  </div>
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink)" }}>
                    Happy to price the two-bed clean. Is this for this week or later in the month?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["This week", "Later", "Not now"].map((b) => (
                      <span key={b} className={styles.chip} style={{ borderRadius: 999, fontSize: 12, padding: "5px 11px" }}>
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </RevealLight>

          <RevealLight delay={0.08}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Works for a team, not just you</h3>
              <p className={styles.cardBody}>
                See who has an overdue follow-up and on which deal, route new leads to the right person, and skip the
                status meeting.
              </p>
              <div className={styles.cardFigure}>
                {[
                  { n: "Alex", d: "3 overdue · $12,400 open", pill: "Needs a nudge", cls: styles.pillGold },
                  { n: "You", d: "1 overdue · $3,500 open", pill: "On track", cls: styles.pillSage },
                  { n: "Sam", d: "0 overdue · $6,100 open", pill: "On track", cls: styles.pillSage },
                ].map((r) => (
                  <div key={r.n} className={styles.liveRow}>
                    <div className="min-w-0">
                      <div className={styles.leadName}>{r.n}</div>
                      <div className={styles.leadWhy}>{r.d}</div>
                    </div>
                    <span className={`${styles.pill} ${r.cls}`}>{r.pill}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>
        </div>
      </section>

      {/* ---------- The gap ---------- */}
      <section id="why" style={{ background: "var(--paper-2)" }}>
        <div className={styles.section}>
          <RevealLight className={styles.sectionHeadCenter}>
            <span className={styles.badge}>The gap</span>
            <h2 className={styles.title}>
              Leads don&apos;t say no. They go <span className={styles.em}>quiet.</span>
            </h2>
            <p className={styles.lede}>
              CRMs store leads. Email tools help you write. Automation tools send sequences. None of them answer the one
              question that loses you money: which lead am I about to lose because I haven&apos;t followed up?
            </p>
          </RevealLight>

          <div className={styles.grid3}>
            {[
              { n: 62, suffix: "%", copy: "of calls to small businesses go unanswered entirely" },
              { n: 63, suffix: "%", copy: "of companies never respond to an inbound lead at all" },
              { text: "29–47 hrs", copy: "average time to first response, while the first 5 minutes are what moves conversion" },
            ].map((s, i) => (
              <RevealLight key={s.copy} delay={i * 0.07}>
                <div className={styles.card}>
                  <p className={styles.statBig}>{s.text ?? <CountUp to={s.n as number} suffix={s.suffix} />}</p>
                  <p className={styles.cardBody}>{s.copy}</p>
                </div>
              </RevealLight>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--ink-faint)" }}>
            Industry-wide lead-response benchmarks, not FollowUp&apos;s own results.
          </p>

          <div className={styles.grid3}>
            {[
              { icon: <PauseCircle className="h-5 w-5" />, t: "Stops the instant a lead replies", b: "The moment they write back, every scheduled follow-up for them is cancelled. No exceptions, and there is a test that proves it." },
              { icon: <ShieldCheck className="h-5 w-5" />, t: "Never talks price or terms without you", b: "Anything about money, contracts or a tense thread is held for your approval. Only low-risk, on-topic replies go out on their own." },
              { icon: <FileText className="h-5 w-5" />, t: "Nothing goes out unexplained", b: "Every automated message is on the record with the reason it was sent. You can always answer: what happened, why, and what next." },
            ].map((g, i) => (
              <RevealLight key={g.t} delay={i * 0.07}>
                <div className={styles.card}>
                  <span className={styles.iconChip}>{g.icon}</span>
                  <h3 className={styles.cardTitle} style={{ fontSize: 16.5 }}>
                    {g.t}
                  </h3>
                  <p className={styles.cardBody}>{g.b}</p>
                </div>
              </RevealLight>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Integrations ---------- */}
      <section id="integrations" className={styles.section}>
        <div className={styles.split}>
          <RevealLight>
            <span className={styles.badge}>Integrations</span>
            <h2 className={styles.title}>
              Works with what you <span className={styles.em}>already use.</span>
            </h2>
            <p className={styles.lede}>
              Nothing to migrate and nothing to log by hand. Connect the inbox and the channels your leads actually
              write to, and keep the CRM you have.
            </p>
            <div className="mt-7">
              <Link href="/signin" className={styles.btnPrimary}>
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </RevealLight>
          <RevealLight delay={0.1}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle} style={{ fontSize: 15 }}>
                Connected
              </h3>
              <div className="mt-4">
                {[
                  ["G", "Gmail", "Push, within seconds", "100%"],
                  ["O", "Outlook", "Microsoft 365", "100%"],
                  ["I", "Instagram DMs", "Reply buttons inside Meta's window", "100%"],
                  ["M", "Messenger", "Same rules as Instagram", "100%"],
                  ["W", "WhatsApp", "Business account", "100%"],
                  ["H", "HubSpot", "Contacts imported, notes pushed back", "86%"],
                  ["F", "Follow Up Boss", "Contacts imported, notes pushed back", "86%"],
                  ["Z", "Zapier and webhooks", "Any form, any tool", "72%"],
                ].map(([k, name, sub, w], i) => (
                  <div key={name} className={styles.intRow}>
                    <span className={styles.intLogo} aria-hidden="true">
                      {k}
                    </span>
                    <div className="min-w-0">
                      <div className={styles.intName}>{name}</div>
                      <div className={styles.leadWhy}>{sub}</div>
                      <div className={styles.progress}>
                        <div className={styles.progressFill} style={{ ["--w" as string]: w, ["--d" as string]: `${i * 0.08}s` }} />
                      </div>
                    </div>
                    <span className={styles.toggle} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>
        </div>
      </section>

      {/* ---------- Right now ---------- */}
      <section style={{ background: "var(--paper-2)" }}>
        <div className={`${styles.section} ${styles.split} ${styles.splitReverse}`}>
          <RevealLight delay={0.1}>
            <div className={styles.card}>
              <div className="flex items-center gap-2">
                <span className={styles.liveDot} aria-hidden="true" />
                <h3 className={styles.cardTitle} style={{ fontSize: 15 }}>
                  Right now
                </h3>
              </div>
              <div className="mt-4">
                {[
                  ["Sarah Johnson replied", "Your check-in worked. She wants Thursday.", "1 min ago"],
                  ["Draft ready for Mike Patel", "Short, on topic, waiting for your tap.", "3 min ago"],
                  ["Priya tapped “This week”", "Instagram. Window reopened, no chase needed.", "12 min ago"],
                  ["New lead from your website", "Acknowledged in Spanish, scored, in the queue.", "26 min ago"],
                ].map(([t, w, when]) => (
                  <div key={t} className={styles.liveRow}>
                    <div className="min-w-0">
                      <div className={styles.leadName}>{t}</div>
                      <div className={styles.leadWhy}>{w}</div>
                    </div>
                    <span className={styles.liveWhen}>{when}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>
          <RevealLight>
            <span className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Live
            </span>
            <h2 className={styles.title}>
              Your leads, <span className={styles.em}>as they move.</span>
            </h2>
            <p className={styles.lede}>
              A new message lands, FollowUp acknowledges it in the lead&apos;s language, scores it, and tells you the
              moment one comes back to life. You see what changed, not a list to dig through.
            </p>
          </RevealLight>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className={styles.section}>
        <RevealLight className={styles.sectionHeadCenter}>
          <span className={styles.badge}>How it works</span>
          <h2 className={styles.title}>
            Built to make a difference, not a <span className={styles.em}>dashboard.</span>
          </h2>
          <p className={styles.lede}>Six things FollowUp does that a reminder never will.</p>
        </RevealLight>
        <div className={styles.grid3}>
          {[
            { icon: <Inbox className="h-5 w-5" />, t: "One inbox for every lead", b: "Gmail, Outlook, Instagram, Messenger, WhatsApp and your website form, read in one place. Nothing to log." },
            { icon: <Eye className="h-5 w-5" />, t: "Scores you can see through", b: "Every urgency score comes with the exact detail that raised or lowered it. Never a black-box number." },
            { icon: <Languages className="h-5 w-5" />, t: "In their language", b: "A lead who writes in Spanish is acknowledged, scored and answered in Spanish. Same for any language." },
            { icon: <Send className="h-5 w-5" />, t: "Follow-up on by default, safely", b: "Low-risk replies send themselves. Anything else waits for you. You choose how much to hand off, per lead." },
            { icon: <MessageCircle className="h-5 w-5" />, t: "Meta's rules built in", b: "Instagram and Messenger get short questions with reply buttons inside the window, and one tap from you after it." },
            { icon: <Users className="h-5 w-5" />, t: "Routes leads to the right person", b: "New leads go to whoever should own them. Everyone sees what is overdue, without a spreadsheet." },
          ].map((f, i) => (
            <RevealLight key={f.t} delay={(i % 3) * 0.07}>
              <div className={styles.card}>
                <span className={styles.iconChip}>{f.icon}</span>
                <h3 className={styles.cardTitle} style={{ fontSize: 16.5 }}>
                  {f.t}
                </h3>
                <p className={styles.cardBody}>{f.b}</p>
              </div>
            </RevealLight>
          ))}
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" style={{ background: "var(--paper-2)" }}>
        <div className={styles.section}>
          <RevealLight className={styles.sectionHeadCenter}>
            <span className={styles.badge}>Pricing</span>
            <h2 className={styles.title}>
              Pricing that <span className={styles.em}>makes sense.</span>
            </h2>
            <p className={styles.lede}>
              No seats, no per-message credits, no &ldquo;AI add-on&rdquo;. Start free, pay when it is doing the job.
            </p>
          </RevealLight>

          <div className={styles.priceGrid}>
            <RevealLight>
              <div className={styles.priceCard}>
                <p className={styles.priceName}>{TIER_INFO.free.label}</p>
                <p className={styles.priceAmount}>
                  $0<small>/mo</small>
                </p>
                <p className={styles.priceDesc}>For seeing it work on your real inbox. No card.</p>
                <ul className={styles.priceList}>
                  {["Gmail or Outlook, plus your website form", `Up to ${FREE_TIER_LEAD_CAP} leads a month`, "Scoring with the reason shown", "Drafts you approve before they send"].map((f) => (
                    <li key={f}>
                      <span className={styles.check}>
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`}>
                    Get started
                  </Link>
                </div>
              </div>
            </RevealLight>

            <RevealLight delay={0.07}>
              <div className={`${styles.priceCard} ${styles.priceCardHot}`}>
                <span className={styles.priceTag}>Most owners</span>
                <p className={styles.priceName}>{TIER_INFO.plus.label}</p>
                <p className={styles.priceAmount}>
                  $39<small>/mo</small>
                </p>
                <p className={styles.priceDesc}>Every channel, follow-up on by default, and the safety that makes that okay.</p>
                <ul className={styles.priceList}>
                  {[
                    "Instagram, Messenger and WhatsApp too",
                    "Automated follow-up, with full autonomy per lead when you want it",
                    "Drafts in the lead's language",
                    "HubSpot and Follow Up Boss import",
                    "Weekly report of what FollowUp saved you",
                  ].map((f) => (
                    <li key={f}>
                      <span className={styles.check}>
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link href="/signin" className={`${styles.btnPrimary} w-full justify-center`}>
                    Start 14 days free <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className={styles.priceNote}>No credit card required to start.</p>
                </div>
              </div>
            </RevealLight>

            <RevealLight delay={0.14}>
              <div className={styles.priceCard}>
                <p className={styles.priceName}>{TIER_INFO.pro.label}</p>
                <p className={styles.priceAmount}>
                  $79<small>/mo</small>
                </p>
                <p className={styles.priceDesc}>For a team that shares the leads and needs to see who is dropping what.</p>
                <ul className={styles.priceList}>
                  {["Everything in Plus", "Team view: who is overdue, on which deal", "Leads routed to the right person", "No lead cap", "Priority support"].map((f) => (
                    <li key={f}>
                      <span className={styles.check}>
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`}>
                    Start 14 days free
                  </Link>
                  <p className={styles.priceNote}>No credit card required to start.</p>
                </div>
              </div>
            </RevealLight>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className={styles.section}>
        <RevealLight className={styles.sectionHeadCenter}>
          <span className={styles.badge}>FAQ</span>
          <h2 className={styles.title}>
            You asked, <span className={styles.em}>we answered.</span>
          </h2>
          <p className={styles.lede}>Straight answers. No sales call required.</p>
        </RevealLight>
        <RevealLight delay={0.08}>
          <FaqLight
            items={[
              {
                q: "Will FollowUp send messages without my permission?",
                a: "By default, FollowUp only sends a low-risk, on-topic follow-up on its own, never anything about price, terms, or a sensitive reply, and never once the lead has already answered you. Anything riskier is held for your approval. You can set any lead to fully autonomous or fully manual at any time.",
              },
              {
                q: "Is this another CRM I have to fill out?",
                a: "No. FollowUp reads the conversations you're already having (Gmail, Outlook, Instagram, Messenger, WhatsApp, your website form). There's nothing to manually log.",
              },
              {
                q: "What happens on Instagram after 24 hours?",
                a: "Meta only allows automatic replies within 24 hours of the lead's last message. Inside that window FollowUp sends up to three short follow-ups, each with reply buttons. After it, FollowUp writes one message for you to send with a tap, and after seven days it stops until the lead writes again. Nothing ever switches to email behind their back.",
              },
              {
                q: "I already use another CRM. Do I have to leave it?",
                a: "No. FollowUp imports your existing contacts from Follow Up Boss or HubSpot and runs alongside whatever you already use. It's the layer that watches your actual conversations, not a system you have to migrate into.",
              },
              {
                q: "What happens to my inbox data?",
                a: "You can export or fully delete everything FollowUp has stored at any time, including every conversation it's read. Nothing is sold, and nothing trains a model without being stripped of identifying details first.",
              },
              {
                q: "Does this work for a team, or just one person?",
                a: "Both. Invite your team, see who has an overdue follow-up and on which deal, and route new leads to the right person, without anyone maintaining a shared spreadsheet.",
              },
            ]}
          />
        </RevealLight>
      </section>

      {/* ---------- CTA band ---------- */}
      <div className={styles.cta}>
        <RevealLight>
          <div className={styles.ctaInner}>
            <div className={styles.ctaBrand}>
              <LogoMark size={30} />
              <span className={styles.wordmark} style={{ fontSize: 19 }}>
                FollowUp
              </span>
            </div>
            <h2 className={styles.title} style={{ maxWidth: 640, margin: "18px auto 0" }}>
              Your next lost sale is sitting in your inbox <span className={styles.em}>right now.</span>
            </h2>
            <p className={styles.lede} style={{ maxWidth: 520, margin: "14px auto 0" }}>
              FollowUp reads it, ranks it, and drafts the reply. You tap send. Free to start, on your real inbox, today.
            </p>
            <div className="mt-8">
              <Link href="/signin" className={styles.btnPrimary}>
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </RevealLight>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className="flex items-center gap-2.5">
            <LogoMark size={22} />
            <span>Built to make sure no lead gets forgotten.</span>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/signin">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
