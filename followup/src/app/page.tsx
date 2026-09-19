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
          <RevealLight mode="mount" delay={0.05}>
            <h1 className={styles.h1}>
              Never lose a lead
              <br />
              <span className={styles.em}>because you forgot to follow up.</span>
            </h1>
          </RevealLight>
          <RevealLight mode="mount" delay={0.1}>
            <p className={styles.heroLede}>Only for owners who have leads and don&apos;t have time to reply.</p>
          </RevealLight>
          <RevealLight mode="mount" delay={0.15}>
            <div className={styles.heroActions}>
              <Link href="/signin" className={styles.btn}>
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className={styles.heroNote}>No card. It stops the moment they reply.</p>
          </RevealLight>
        </div>
        <HeroFlow />
      </header>

      {/* ---------- Product ---------- */}
      <section id="how" className={styles.section}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <span className={styles.badge}>Product</span>
          <h2 className={styles.h2}>
            See who needs you, <span className={styles.em}>and why.</span>
          </h2>
          <p className={styles.lede}>FollowUp does the part nobody has time for: remembering every customer and writing back.</p>
        </RevealLight>

        <div className={styles.grid2}>
          <RevealLight>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Who needs you today</h3>
              <p className={styles.cardBody}>Your customers, in order of who you are most likely to lose. The reason is written next to each name.</p>
              <div className={styles.figure}>
                {[
                  ["SJ", "Sarah Johnson", "Asked about price. No reply for 5 days.", "Needs you", styles.pillRose],
                  ["MP", "Mike Patel", "Asked for a quote 3 days ago.", "Going quiet", styles.pillAmber],
                  ["DR", "Devon Ruiz", "We replied. Waiting on him since Tuesday.", "Waiting", styles.pillMuted],
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
              <h3 className={styles.cardTitle}>Everything it did, in one list</h3>
              <p className={styles.cardBody}>What it sent, why, and what it held back for you. No surprises.</p>
              <div className={styles.figure}>
                {[
                  ["Checked in with Sarah", "She went quiet after asking about price.", "Sent", styles.pillGreen],
                  ["Waiting for you: Mike", "The reply mentions money, so it is yours to send.", "Held", styles.pillAmber],
                  ["Stopped for Priya", "She replied. Nothing more goes out.", "Stopped", styles.pillMuted],
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
              <h3 className={styles.cardTitle}>Bring your team</h3>
              <p className={styles.cardBody}>New customers go to the right person. Everyone can see what is waiting.</p>
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
              <h3 className={styles.cardTitle}>Replies that sound like you</h3>
              <p className={styles.cardBody}>Written the way you talk, in the customer&apos;s language. It never makes anything up.</p>
              <div className={styles.figure}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)" }}>READY TO SEND TO SARAH</div>
                <p className="mt-1.5 text-[14px] font-medium">Re: Your proposal</p>
                <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  Just checking in. I know you&apos;ve looked at the numbers a couple of times. Happy to talk through anything.
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

        </div>
      </section>

      {/* ---------- Stories grid, with our rules instead of invented customers ---------- */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <span className={styles.badge}>Our promises</span>
          <h2 className={styles.h2}>
            What it will <span className={styles.em}>and won&apos;t do.</span>
          </h2>
          <p className={styles.lede}>Four promises. Each one is built into the product, not just written here.</p>
        </RevealLight>
        <div className={styles.grid4}>
          {[
            ["When a customer replies, it stops. No more messages to them.", "Stops"],
            ["It never talks about money without you. Anything about price waits for you to send.", "Safe"],
            ["Every message it sends is written down, with the reason it was sent.", "Honest"],
            ["You can delete everything it has, whenever you want.", "Yours"],
          ].map(([q, tag], i) => (
            <RevealLight key={q} delay={i * 0.06}>
              <div className={styles.story} style={{ marginBottom: 0 }}>
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
                    Promise · <span style={{ color: "var(--text)" }}>{tag}</span>
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
            <span className={styles.badge}>Works with</span>
            <h2 className={styles.h2}>
              Works with what <span className={styles.em}>you already use.</span>
            </h2>
            <p className={styles.lede}>
              Connect your inbox and the apps your customers message you on. Keep the tools you have. FollowUp works alongside them.
            </p>
            <div className="mt-7">
              <Link href="/signin" className={styles.btn}>
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </RevealLight>
          <RevealLight delay={0.1}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle} style={{ fontSize: 16 }}>
                Connected
              </h3>
              <div className="mt-3">
                {[
                  ["G", "Gmail", "New emails, within seconds", true],
                  ["O", "Outlook", "Same as Gmail", true],
                  ["I", "Instagram", "Messages, with one-tap reply buttons", true],
                  ["W", "WhatsApp", "Messages", true],
                  ["H", "HubSpot", "Your contacts come in. Notes go back.", true],
                  ["Z", "Zapier", "Any form or app", false],
                ].map(([k, name, sub, on]) => (
                  <div key={name as string} className={styles.row} style={{ padding: "12px 0" }}>
                    <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
                      <span className={styles.logoBox} aria-hidden="true">
                        {k as string}
                      </span>
                      <div className="min-w-0" style={{ flex: 1 }}>
                        <div className={styles.rowName}>{name as string}</div>
                        <div className={styles.rowSub}>{sub as string}</div>
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
                Just now
              </h3>
              <div className="mt-3">
                {[
                  ["Sarah Johnson replied", "She wants Thursday.", "1 min ago"],
                  ["A reply is ready for Mike Patel", "Tap once to send it.", "3 min ago"],
                  ["Priya tapped “This week”", "On Instagram. FollowUp keeps going.", "12 min ago"],
                  ["New customer from your website", "Answered in Spanish, right away.", "26 min ago"],
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
            <span className={styles.badge}>As it happens</span>
            <h2 className={styles.h2}>
              See what changed, <span className={styles.em}>the moment it does.</span>
            </h2>
            <p className={styles.lede}>
              A customer replies. A new one writes in. FollowUp sends something for you. You see each one as it happens, in plain words.
            </p>
          </RevealLight>
        </div>
      </section>

      {/* ---------- Features 3×2 ---------- */}
      <section id="features" className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <h2 className={styles.h2} style={{ fontSize: "clamp(28px, 3.4vw, 40px)" }}>
            Everything you need, <span className={styles.em}>nothing you don&apos;t.</span>
          </h2>
        </RevealLight>
        <div className={styles.grid3}>
          {[
            [<Inbox key="i" className="h-5 w-5" />, "Every customer in one place", "Gmail, Outlook, Instagram, Messenger, WhatsApp and your website form. One list."],
            [<Eye key="e" className="h-5 w-5" />, "Know who is slipping", "FollowUp tells you which customers are going quiet, and why."],
            [<Languages key="l" className="h-5 w-5" />, "Speaks their language", "They write in Spanish, they get answered in Spanish. Any language."],
            [<Send key="s" className="h-5 w-5" />, "Follows up for you", "Simple replies go out on their own. Anything about money waits for you."],
            [<MessageCircle key="m" className="h-5 w-5" />, "Made for Instagram and WhatsApp", "Short messages with buttons, so a customer can answer with one tap."],
            [<Users key="u" className="h-5 w-5" />, "Works for a team", "New customers go to the right person. Everyone sees what is waiting."],
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
          <p className={styles.lede}>Start free. No card. No seats, no per-message fees, no AI add-on.</p>
        </RevealLight>
        <div className={styles.priceGrid}>
          <RevealLight>
            <div className={styles.priceCard}>
              <p className={styles.priceName}>{TIER_INFO.free.label}</p>
              <p className={styles.priceAmount}>
                $0<small>/month</small>
              </p>
              <p className={styles.priceDesc}>Try it on your real inbox. No card needed.</p>
              <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`} style={{ marginTop: 18 }}>
                Start free
              </Link>
              <p className={styles.priceNote}>No credit card required.</p>
              <p className={styles.priceListLabel}>Including:</p>
              <ul className={styles.priceList}>
                {["Gmail or Outlook, plus your website form", `Up to ${FREE_TIER_LEAD_CAP} customers a month`, "See who is slipping, and why", "You approve every reply before it goes out"].map((f) => (
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
              <p className={styles.priceDesc}>Every channel, with FollowUp replying for you.</p>
              <Link href="/signin" className={`${styles.btn} w-full justify-center`} style={{ marginTop: 18 }}>
                Start 14 days free
              </Link>
              <p className={styles.priceNote}>No credit card required to start.</p>
              <p className={styles.priceListLabel}>Free plus:</p>
              <ul className={styles.priceList}>
                {["Instagram, Messenger and WhatsApp", "FollowUp replies for you", "Replies in your customer's language", "Bring in contacts from HubSpot or Follow Up Boss", "A weekly report of what it did for you"].map((f) => (
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
              <p className={styles.priceDesc}>For a team that shares customers.</p>
              <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`} style={{ marginTop: 18 }}>
                Start 14 days free
              </Link>
              <p className={styles.priceNote}>No credit card required to start.</p>
              <p className={styles.priceListLabel}>Plus plus:</p>
              <ul className={styles.priceList}>
                {["See who on your team is behind, and where", "New customers go to the right person", "No limit on customers", "Priority support"].map((f) => (
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
          <p className={styles.lede}>Straight answers. And a real person on email if you want one.</p>
        </RevealLight>
        <RevealLight delay={0.08}>
          <FaqDark
            items={[
              { q: "Will it send things I did not approve?", a: "Only simple, safe replies go out on their own. Anything about price, or anything sensitive, waits for you. Once a customer answers, it stops. You can turn it fully on or fully off for any customer." },
              { q: "What about Instagram's 24-hour rule?", a: "Instagram only lets apps reply within 24 hours of a customer's last message. Inside that time, FollowUp replies by itself. After that, it writes one message you can send with a tap. It never moves the conversation to email without them." },
              { q: "Is my data safe?", a: "It only reads the conversations you connect. Everything is stored for your business only, and you can download or delete all of it whenever you want. Nothing is sold." },
              { q: "Is it for a team, or just me?", a: "Both. Add your team, see who is behind, and send new customers to the right person." },
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
              Start <span className={styles.em}>free.</span>
            </h2>
            <p className={styles.lede} style={{ maxWidth: 520, margin: "14px auto 0" }}>
              Connect your inbox. That&apos;s it.
            </p>
            <div className="mt-8">
              <Link href="/signin" className={styles.btn}>
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </RevealLight>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className="flex items-center gap-2.5" style={{ color: "var(--text)" }}>
            <LogoMark height={18} />
            <span style={{ color: "var(--muted)" }}>So no customer gets forgotten.</span>
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
