import Link from "next/link";
import { ArrowRight, Check, Inbox, Eye, Languages, Send, MessageCircle, Users } from "lucide-react";
import styles from "./landing-dark.module.css";
import NavDark from "@/components/landing/dark/NavDark";
import HeroFlow from "@/components/landing/dark/HeroFlow";
import FaqDark from "@/components/landing/dark/FaqDark";
import RevealLight from "@/components/landing/light/RevealLight";
import LogoMark from "@/components/landing/light/LogoMark";
import { publicSans, ibmPlexMono, instrumentSerif } from "@/lib/fonts";
import { TIER_INFO, FREE_TIER_LEAD_CAP } from "@/lib/pricing";

// The "faithful" build, 2026-09-18: the founder's chosen reference (the
// Scalable Framer template) reproduced section for section — its dark
// ground, indigo, card style, section order, hero dashboard card, masonry
// grid, integrations and real-time cards, 3×2 features, pricing, FAQ, CTA
// band — with FollowUp's own words, numbers and logo. Three of the session's
// own variations on that reference were rejected the same day (R-006, R-007,
// R-008); this one is the template itself, so the founder can react to the
// real thing before we diverge. What is not copied, by standing rule: fake
// testimonials, a fake logo strip, "book a demo" as the only action, annual
// pricing. See design-brain/decisions/design-decisions.md, 2026-09-18.
export default function LandingPage() {
  return (
    <div className={`${styles.root} ${publicSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}>
      <NavDark />

      {/* ---------- Hero ---------- */}
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <RevealLight mode="mount" y={10}>
            <span className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              New feature: reply buttons in Instagram follow-ups
            </span>
          </RevealLight>
          <RevealLight mode="mount" delay={0.05}>
            <h1 className={styles.h1}>
              Never lose a lead
              <br />
              <span className={styles.em}>because nobody followed up.</span>
            </h1>
          </RevealLight>
          <RevealLight mode="mount" delay={0.1}>
            <p className={styles.heroLede}>
              FollowUp reads every conversation you already have, scores who you are about to lose, and sends the
              follow-up before &ldquo;let me think about it&rdquo; becomes a lost sale.
            </p>
          </RevealLight>
          <RevealLight mode="mount" delay={0.15}>
            <div className={styles.heroActions}>
              <Link href="/signin" className={styles.btn}>
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#product" className={styles.btnGhost}>
                See the product
              </a>
            </div>
          </RevealLight>
        </div>
        <HeroFlow />
      </header>

      {/* ---------- Product ---------- */}
      <section id="product" className={styles.section}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <span className={styles.badge}>Product</span>
          <h2 className={styles.h2}>
            Track the leads that matter <span className={styles.em}>most to you.</span>
          </h2>
          <p className={styles.lede}>From the first reply to the last nudge, FollowUp does the part an owner never has time for.</p>
        </RevealLight>

        <div className={styles.grid2}>
          <RevealLight>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Who needs you today</h3>
              <p className={styles.cardBody}>Every open lead ranked by how likely you are to lose them, with the reason in plain words.</p>
              <div className={styles.figure}>
                {[
                  ["SJ", "Sarah Johnson", "Asked about pricing, no reply in 5 days", "Needs you", styles.pillRose],
                  ["MP", "Mike Patel", "Requested a proposal 3 days ago", "Going cold", styles.pillAmber],
                  ["DR", "Devon Ruiz", "Waiting on their answer since Tuesday", "Waiting", styles.pillMuted],
                ].map(([i, n, w, p, cls]) => (
                  <div key={n} className={styles.row}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={styles.avatar}>{i}</span>
                      <div className="min-w-0">
                        <div className={styles.rowName}>{n}</div>
                        <div className={styles.rowSub}>{w}</div>
                      </div>
                    </div>
                    <span className={`${styles.pill} ${cls}`}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>

          <RevealLight delay={0.08}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Every message, on the record</h3>
              <p className={styles.cardBody}>What went out, why, and what was held for you. Nothing is a surprise you hear from a customer.</p>
              <div className={styles.figure}>
                {[
                  ["Sent a check-in to Sarah", "5 days quiet after a pricing question", "Sent", styles.pillGreen],
                  ["Held a draft for Mike", "It mentions a price. That is yours to say.", "Held", styles.pillAmber],
                  ["Stopped the sequence for Priya", "She replied. Nothing more goes out.", "Stopped", styles.pillMuted],
                ].map(([t, w, p, cls]) => (
                  <div key={t} className={styles.row}>
                    <div className="min-w-0">
                      <div className={styles.rowName}>{t}</div>
                      <div className={styles.rowSub}>{w}</div>
                    </div>
                    <span className={`${styles.pill} ${cls}`}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>

          <RevealLight>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Invite your whole team</h3>
              <p className={styles.cardBody}>Route new leads to the right person and see who is overdue on which deal, without a spreadsheet.</p>
              <div className={styles.figure}>
                <div className={styles.rowName} style={{ fontSize: 13, marginBottom: 6 }}>
                  Pending invitations
                </div>
                {[
                  ["AR", "Alex Rivera", "alex@yourbusiness.com", "Sent Sep 8"],
                  ["SM", "Sam Mitchell", "sam@yourbusiness.com", "Sent Sep 9"],
                ].map(([i, n, e, d]) => (
                  <div key={n} className={styles.row}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={styles.avatar}>{i}</span>
                      <div className="min-w-0">
                        <div className={styles.rowName}>{n}</div>
                        <div className={styles.rowSub}>{e}</div>
                      </div>
                    </div>
                    <span className={styles.rowMeta}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>

          <RevealLight delay={0.08}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Drafts that sound like you</h3>
              <p className={styles.cardBody}>Written from how you actually talk to that lead, in their language, never stating a fact that is not in the thread.</p>
              <div className={styles.figure}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)" }}>DRAFT READY FOR SARAH</div>
                <p className="mt-1.5 text-[14px] font-medium">Re: Your proposal</p>
                <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  Wanted to check in, I know you&apos;ve had a look at the numbers a couple of times. Happy to walk through anything that&apos;s unclear.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className={`${styles.btn} ${styles.btnSmall}`} style={{ boxShadow: "none" }}>
                    Send
                  </span>
                  <span className={`${styles.btnGhost} ${styles.btnSmall}`}>Edit</span>
                </div>
              </div>
            </div>
          </RevealLight>

          <RevealLight className={styles.wide}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Your week, at a glance</h3>
              <p className={styles.cardBody}>One screen that answers the only question that matters on a Monday: who is about to slip, and what has already been handled.</p>
              <div className={styles.wideGrid}>
                <div className={styles.totalPanel}>
                  <div className={styles.totalLabel}>Open leads this week</div>
                  <div className={styles.totalValue}>86</div>
                  <div className={styles.totalBtns}>
                    <span className={`${styles.btn} ${styles.btnSmall}`} style={{ boxShadow: "none" }}>
                      Review
                    </span>
                    <span className={`${styles.btnGhost} ${styles.btnSmall}`}>Export</span>
                  </div>
                  <div className={styles.kv}>
                    {[
                      ["New this week", "27"],
                      ["Followed up for you", "148"],
                      ["Booked", "9"],
                    ].map(([k, v]) => (
                      <div key={k} className={styles.kvRow}>
                        <span>{k}</span>
                        <b>{v}</b>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.totalPanel}>
                  <div className={styles.panelHead}>
                    <span>Replies by day</span>
                    <span className={styles.tabs} aria-hidden="true">
                      <span className={`${styles.tab} ${styles.tabOn}`}>This week</span>
                      <span className={styles.tab}>Last week</span>
                    </span>
                  </div>
                  <div className={styles.bars} aria-hidden="true">
                    {[42, 58, 50, 76, 64, 30, 22].map((h, i) => (
                      <span key={i} className={`${styles.bar} ${i > 4 ? styles.barMuted : ""}`} style={{ ["--h" as string]: `${h}%`, ["--d" as string]: `${0.2 + i * 0.06}s` }} />
                    ))}
                  </div>
                  <div className={styles.legendInline}>
                    {[
                      ["Mon", "42"],
                      ["Tue", "58"],
                      ["Wed", "50"],
                      ["Thu", "76"],
                      ["Fri", "64"],
                    ].map(([k, v]) => (
                      <div key={k} className={styles.legendRow}>
                        <span className={styles.legendKey}>{k}</span>
                        <span className={styles.legendVal}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.totalPanel}>
                  <div className={styles.totalLabel} style={{ marginBottom: 12 }}>
                    Where every lead stands
                  </div>
                  <div className={styles.roleList}>
                    {[
                      ["Needs you", "3", styles.pillRose],
                      ["Going cold", "5", styles.pillAmber],
                      ["Waiting on them", "14", styles.pillMuted],
                      ["Replied", "38", styles.pillGreen],
                      ["Booked", "9", styles.pillGreen],
                    ].map(([k, v, cls]) => (
                      <div key={k} className={styles.role}>
                        <span>{k}</span>
                        <span className={`${styles.pill} ${cls}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </RevealLight>
        </div>
      </section>

      {/* ---------- Stories grid, with our rules instead of invented customers ---------- */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <span className={styles.badge}>What it will and won&apos;t do</span>
          <h2 className={styles.h2}>
            Built to make a difference, <span className={styles.em}>not noise.</span>
          </h2>
          <p className={styles.lede}>FollowUp isn&apos;t another fancy piece of software. Every rule below is enforced in code, and most have a test that proves it.</p>
        </RevealLight>
        <div className={styles.masonry}>
          {[
            ["Stops the instant a lead replies. Every scheduled follow-up for them is cancelled, no exceptions.", "Automation"],
            ["Never talks price or terms without you. Anything about money or a tense thread waits for your approval.", "Safety"],
            ["Answers in the lead's language. Spanish in, Spanish out. Same for any language.", "Drafting"],
            ["On Instagram and Messenger it asks one short question with reply buttons, inside Meta's window.", "Instagram"],
            ["Never switches a DM lead to email behind their back. They chose where to talk.", "Instagram"],
            ["Every automated message is on the record with the reason it was sent.", "Trust"],
            ["Reads the inbox you already have. Nothing to log, nothing to migrate.", "Setup"],
            ["Acknowledges a new lead within seconds, day or night, before you have seen it.", "Speed"],
            ["You can export or delete everything it has stored, any time.", "Privacy"],
          ].map(([q, tag], i) => (
            <RevealLight key={q} delay={(i % 3) * 0.06}>
              <div className={styles.story}>
                <div className={styles.storyKicker} aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <LogoMark key={j} height={12} />
                  ))}
                </div>
                <p className={styles.storyQuote}>{q}</p>
                <div className={styles.storyBy}>
                  <span className={styles.avatar} style={{ width: 26, height: 26, fontSize: 10 }}>
                    F
                  </span>
                  <span>
                    FollowUp rule · <span style={{ color: "var(--text)" }}>{tag}</span>
                  </span>
                </div>
              </div>
            </RevealLight>
          ))}
        </div>
      </section>

      {/* ---------- Integrations ---------- */}
      <section id="integrations" className={styles.section}>
        <div className={styles.split}>
          <RevealLight>
            <span className={styles.badge}>Integrations</span>
            <h2 className={styles.h2}>
              Integrate <span className={styles.em}>seamlessly.</span>
            </h2>
            <p className={styles.lede}>
              Effortlessly connect the inbox and the channels your leads actually write to. Keep the CRM you have; FollowUp imports its contacts and pushes notes back.
            </p>
            <div className="mt-7">
              <Link href="/signin" className={styles.btn}>
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </RevealLight>
          <RevealLight delay={0.1}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle} style={{ fontSize: 16 }}>
                Integrations
              </h3>
              <div className="mt-3">
                {[
                  ["G", "Gmail", "Push, within seconds", "100%", true],
                  ["O", "Outlook", "Microsoft 365", "100%", true],
                  ["I", "Instagram", "Reply buttons inside Meta's window", "100%", true],
                  ["W", "WhatsApp", "Business account", "100%", true],
                  ["H", "HubSpot", "Contacts imported, notes pushed back", "86%", true],
                  ["Z", "Zapier", "Any form, any tool", "72%", false],
                ].map(([k, name, sub, w, on], i) => (
                  <div key={name as string} className={styles.row} style={{ padding: "12px 0" }}>
                    <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
                      <span className={styles.logoBox} aria-hidden="true">
                        {k as string}
                      </span>
                      <div className="min-w-0" style={{ flex: 1 }}>
                        <div className={styles.rowName}>{name as string}</div>
                        <div className={styles.rowSub}>{sub as string}</div>
                        <div className={styles.progress} style={{ marginTop: 7, maxWidth: 220 }}>
                          <div className={styles.progressFill} style={{ ["--w" as string]: w as string, ["--d" as string]: `${i * 0.08}s` }} />
                        </div>
                      </div>
                    </div>
                    <span className={`${styles.toggle} ${on ? "" : styles.toggleOff}`} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>
        </div>
      </section>

      {/* ---------- Real-time ---------- */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={`${styles.split} ${styles.splitReverse}`}>
          <RevealLight delay={0.1}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle} style={{ fontSize: 16 }}>
                Real-time
              </h3>
              <div className="mt-3">
                {[
                  ["Sarah Johnson replied", "Your check-in worked. She wants Thursday.", "1 min ago"],
                  ["Draft ready for Mike Patel", "Short, on topic, waiting for your tap.", "3 mins ago"],
                  ["Priya tapped “This week”", "Instagram. Window reopened, no chase needed.", "12 mins ago"],
                  ["New lead from your website", "Acknowledged in Spanish, scored, in the queue.", "26 mins ago"],
                ].map(([t, w, when]) => (
                  <div key={t} className={styles.row}>
                    <div className="min-w-0">
                      <div className={styles.rowName}>{t}</div>
                      <div className={styles.rowSub}>{w}</div>
                    </div>
                    <span className={styles.rowMeta}>{when}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealLight>
          <RevealLight>
            <span className={styles.badge}>Real-time</span>
            <h2 className={styles.h2}>
              Your leads <span className={styles.em}>in real time.</span>
            </h2>
            <p className={styles.lede}>
              A new message lands, FollowUp acknowledges it in the lead&apos;s language, scores it, and tells you the moment one comes back to life. You see what changed, not a list to dig through.
            </p>
          </RevealLight>
        </div>
      </section>

      {/* ---------- Features 3×2 ---------- */}
      <section id="features" className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <h2 className={styles.h2} style={{ fontSize: "clamp(28px, 3.4vw, 40px)" }}>
            We&apos;ve built features that will actually make a difference <span className={styles.em}>to your business.</span>
          </h2>
        </RevealLight>
        <div className={styles.grid3}>
          {[
            [<Inbox key="i" className="h-5 w-5" />, "One inbox for every lead", "Gmail, Outlook, Instagram, Messenger, WhatsApp and your website form, read in one place."],
            [<Eye key="e" className="h-5 w-5" />, "Scores you can see through", "Every urgency score comes with the exact detail that raised or lowered it."],
            [<Languages key="l" className="h-5 w-5" />, "In their language", "A lead who writes in Spanish is acknowledged, scored and answered in Spanish."],
            [<Send key="s" className="h-5 w-5" />, "Follow-up on by default, safely", "Low-risk replies send themselves. Anything else waits for you."],
            [<MessageCircle key="m" className="h-5 w-5" />, "Meta's rules built in", "Short questions with reply buttons inside the window, one tap from you after it."],
            [<Users key="u" className="h-5 w-5" />, "Routes leads to the right person", "New leads go to whoever should own them. Everyone sees what is overdue."],
          ].map(([icon, t, b], i) => (
            <RevealLight key={t as string} delay={(i % 3) * 0.07}>
              <div className={styles.card}>
                <span className={styles.iconChip}>{icon}</span>
                <h3 className={styles.cardTitle} style={{ fontSize: 17 }}>
                  {t as string}
                </h3>
                <p className={styles.cardBody}>{b as string}</p>
              </div>
            </RevealLight>
          ))}
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className={styles.section}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <span className={styles.badge}>Pricing</span>
          <h2 className={styles.h2}>
            Pricing that <span className={styles.em}>makes sense.</span>
          </h2>
          <p className={styles.lede}>No seats, no per-message credits, no &ldquo;AI add-on&rdquo;. Start free, pay when it is doing the job.</p>
        </RevealLight>
        <div className={styles.priceGrid}>
          <RevealLight>
            <div className={styles.priceCard}>
              <p className={styles.priceName}>{TIER_INFO.free.label}</p>
              <p className={styles.priceAmount}>
                $0<small>/month</small>
              </p>
              <p className={styles.priceDesc}>For seeing it work on your real inbox. No card.</p>
              <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`} style={{ marginTop: 18 }}>
                Get started
              </Link>
              <p className={styles.priceNote}>No credit card required.</p>
              <p className={styles.priceListLabel}>Including:</p>
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
            </div>
          </RevealLight>
          <RevealLight delay={0.07}>
            <div className={`${styles.priceCard} ${styles.priceHot}`}>
              <p className={styles.priceName}>{TIER_INFO.plus.label}</p>
              <p className={styles.priceAmount}>
                $39<small>/month</small>
              </p>
              <p className={styles.priceDesc}>Every channel, follow-up on by default, and the safety that makes that okay.</p>
              <Link href="/signin" className={`${styles.btn} w-full justify-center`} style={{ marginTop: 18 }}>
                Start 14 days free
              </Link>
              <p className={styles.priceNote}>No credit card required to start.</p>
              <p className={styles.priceListLabel}>Free plus:</p>
              <ul className={styles.priceList}>
                {["Instagram, Messenger and WhatsApp", "Automated follow-up, full autonomy per lead when you want it", "Drafts in the lead's language", "HubSpot and Follow Up Boss import", "Weekly report of what FollowUp saved you"].map((f) => (
                  <li key={f}>
                    <span className={styles.check}>
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </RevealLight>
          <RevealLight delay={0.14}>
            <div className={styles.priceCard}>
              <p className={styles.priceName}>{TIER_INFO.pro.label}</p>
              <p className={styles.priceAmount}>
                $79<small>/month</small>
              </p>
              <p className={styles.priceDesc}>For a team that shares the leads and needs to see who is dropping what.</p>
              <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`} style={{ marginTop: 18 }}>
                Start 14 days free
              </Link>
              <p className={styles.priceNote}>No credit card required to start.</p>
              <p className={styles.priceListLabel}>Plus plus:</p>
              <ul className={styles.priceList}>
                {["Team view: who is overdue, on which deal", "Leads routed to the right person", "No lead cap", "Priority support"].map((f) => (
                  <li key={f}>
                    <span className={styles.check}>
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </RevealLight>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <span className={styles.badge}>FAQs</span>
          <h2 className={styles.h2}>
            You asked, <span className={styles.em}>we answered.</span>
          </h2>
          <p className={styles.lede}>Still got questions? Straight answers below, and a real person on email if you want one.</p>
        </RevealLight>
        <RevealLight delay={0.08}>
          <FaqDark
            items={[
              { q: "What is FollowUp, and how can it help my business?", a: "FollowUp reads the conversations you already have (Gmail, Outlook, Instagram, Messenger, WhatsApp, your website form), scores which leads you are about to lose, drafts the reply in your voice, and sends the low-risk ones itself. It exists so a lead never goes quiet because nobody followed up." },
              { q: "Will it send messages without my permission?", a: "By default it only sends a low-risk, on-topic follow-up on its own, never anything about price, terms, or a sensitive reply, and never once the lead has already answered you. Anything riskier is held for your approval. You can set any lead to fully autonomous or fully manual at any time." },
              { q: "What happens on Instagram after 24 hours?", a: "Meta only allows automatic replies within 24 hours of the lead's last message. Inside that window FollowUp sends up to three short follow-ups with reply buttons. After it, FollowUp writes one message for you to send with a tap, and after seven days it stops until the lead writes again. Nothing switches to email behind their back." },
              { q: "Can I keep my existing CRM?", a: "Yes. FollowUp imports your contacts from HubSpot or Follow Up Boss, runs alongside it, and pushes notes back. It is the layer that watches your actual conversations, not a system you migrate into." },
              { q: "How secure is my data?", a: "Your inbox data is read only for the leads you connect, stored under your business alone, and you can export or fully delete everything at any time. Nothing is sold, and nothing trains a model without being stripped of identifying details first." },
              { q: "Does it work for a team, or just one person?", a: "Both. Invite your team, see who has an overdue follow-up and on which deal, and route new leads to the right person, without anyone maintaining a shared spreadsheet." },
            ]}
          />
        </RevealLight>
      </section>

      {/* ---------- CTA band ---------- */}
      <div className={styles.cta}>
        <RevealLight>
          <div className={styles.ctaInner}>
            <div className={styles.ctaBrand} style={{ color: "var(--text)" }}>
              <LogoMark height={26} />
              <span className={styles.wordmark} style={{ fontSize: 19 }}>
                FollowUp
              </span>
            </div>
            <h2 className={styles.h2} style={{ maxWidth: 640, margin: "18px auto 0" }}>
              Get started <span className={styles.em}>today.</span>
            </h2>
            <p className={styles.lede} style={{ maxWidth: 520, margin: "14px auto 0" }}>
              Connect your inbox, and FollowUp starts catching the leads you were about to lose. Free to start, on your real inbox.
            </p>
            <div className="mt-8">
              <Link href="/signin" className={styles.btn}>
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </RevealLight>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className="flex items-center gap-2.5" style={{ color: "var(--text)" }}>
            <LogoMark height={18} />
            <span style={{ color: "var(--muted)" }}>Built to make sure no lead gets forgotten.</span>
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
