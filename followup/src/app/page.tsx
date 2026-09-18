import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import styles from "./landing-dark.module.css";
import NavDark from "@/components/landing/dark/NavDark";
import HeroFlow from "@/components/landing/dark/HeroFlow";
import FaqDark from "@/components/landing/dark/FaqDark";
import RevealLight from "@/components/landing/light/RevealLight";
import LogoMark from "@/components/landing/light/LogoMark";
import { publicSans, ibmPlexMono, instrumentSerif } from "@/lib/fonts";
import { TIER_INFO, FREE_TIER_LEAD_CAP } from "@/lib/pricing";

// The simplest version of the page (founder, 2026-09-18: "simplify it as
// much as you can"). Six things, in order: the promise and the moving
// diagram; three steps; three promises; the apps it works with; three
// prices; four questions. Every line is written for someone who has never
// used software like this (brand principle 9). Nothing here claims a
// behaviour that is not built. History: design-brain/decisions/design-decisions.md.
const STEPS = [
  ["1", "Connect your inbox.", "Gmail, Outlook, Instagram, WhatsApp or your website. Two minutes."],
  ["2", "FollowUp spots who is going quiet.", "It reads your messages and tells you who needs a reply."],
  ["3", "It writes back for you.", "Simple replies go out on their own. Anything about money waits for you."],
] as const;

const PROMISES = [
  "When a customer replies, it stops.",
  "It never talks about money without you.",
  "Every message it sends is written down, with the reason.",
  "You can delete everything, any time.",
] as const;

const APPS = ["Gmail", "Outlook", "Instagram", "Messenger", "WhatsApp", "Your website", "HubSpot"] as const;

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

      {/* ---------- Three steps ---------- */}
      <section id="how" className={styles.section}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <h2 className={styles.h2}>
            Three <span className={styles.em}>steps.</span>
          </h2>
        </RevealLight>
        <div className={styles.grid3}>
          {STEPS.map(([n, title, body], i) => (
            <RevealLight key={n} delay={i * 0.08}>
              <div className={styles.card}>
                <span className={styles.iconChip} aria-hidden="true">
                  <span style={{ fontFamily: "var(--font-plex-mono)", fontSize: 15, fontWeight: 600 }}>{n}</span>
                </span>
                <h3 className={styles.cardTitle} style={{ fontSize: 19 }}>
                  {title}
                </h3>
                <p className={styles.cardBody}>{body}</p>
              </div>
            </RevealLight>
          ))}
        </div>
      </section>

      {/* ---------- Three promises ---------- */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <h2 className={styles.h2}>
            Four <span className={styles.em}>promises.</span>
          </h2>
        </RevealLight>
        <div className={styles.grid4}>
          {PROMISES.map((q, i) => (
            <RevealLight key={q} delay={i * 0.08}>
              <div className={styles.story} style={{ marginBottom: 0 }}>
                <div className={styles.storyKicker} aria-hidden="true">
                  <LogoMark height={14} />
                </div>
                <p className={styles.storyQuote} style={{ fontSize: 18 }}>
                  {q}
                </p>
              </div>
            </RevealLight>
          ))}
        </div>
      </section>

      {/* ---------- Works with ---------- */}
      <section id="works" className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={styles.headCenter}>
          <h2 className={styles.h2}>
            Works with what <span className={styles.em}>you use.</span>
          </h2>
          <div className={styles.stripRow} style={{ marginTop: 28 }}>
            {APPS.map((a) => (
              <span key={a} className={styles.stripMark}>
                {a}
              </span>
            ))}
          </div>
        </RevealLight>
      </section>

      {/* ---------- Prices ---------- */}
      <section id="pricing" className={styles.section}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <h2 className={styles.h2}>
            Simple <span className={styles.em}>prices.</span>
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
              <p className={styles.priceDesc}>To try it.</p>
              <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`} style={{ marginTop: 18 }}>
                Start free
              </Link>
              <ul className={styles.priceList} style={{ marginTop: 22 }}>
                {["Email and your website", `Up to ${FREE_TIER_LEAD_CAP} customers a month`, "You approve every reply"].map((f) => (
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
              <p className={styles.priceDesc}>For one business.</p>
              <Link href="/signin" className={`${styles.btn} w-full justify-center`} style={{ marginTop: 18 }}>
                Start free for 14 days
              </Link>
              <ul className={styles.priceList} style={{ marginTop: 22 }}>
                {["Every app above", "FollowUp replies for you", "Any language"].map((f) => (
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
              <p className={styles.priceDesc}>For a team.</p>
              <Link href="/signin" className={`${styles.btnGhost} w-full justify-center`} style={{ marginTop: 18 }}>
                Start free for 14 days
              </Link>
              <ul className={styles.priceList} style={{ marginTop: 22 }}>
                {["Everything in Plus", "Share customers with your team", "No limit on customers"].map((f) => (
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

      {/* ---------- Questions ---------- */}
      <section id="faq" className={styles.section} style={{ paddingTop: 0 }}>
        <RevealLight className={`${styles.headCenter} ${styles.sectionGlow}`}>
          <h2 className={styles.h2}>
            <span className={styles.em}>Questions.</span>
          </h2>
        </RevealLight>
        <RevealLight delay={0.08}>
          <FaqDark
            items={[
              { q: "Will it send things I didn't approve?", a: "Only simple replies. Anything about money waits for you. When a customer answers, it stops." },
              { q: "What about Instagram's 24-hour rule?", a: "Instagram only lets apps reply within 24 hours of a customer's message. Inside that time, FollowUp replies by itself. After it, FollowUp writes the message and you send it with one tap." },
              { q: "Is my data safe?", a: "It only reads what you connect. You can delete everything any time. Nothing is sold." },
              { q: "Is it for a team?", a: "Yes. Add your team and share customers." },
            ]}
          />
        </RevealLight>
      </section>

      {/* ---------- Start ---------- */}
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
