import Link from "next/link";
import styles from "@/components/landing/v2/landing.module.css";
import { ArrowIcon, CheckIcon, PlayIcon, ChannelIcon } from "@/components/landing/v2/icons";
import WatchDemo from "@/components/landing/v2/WatchDemo";
import Questions from "@/components/landing/v2/Questions";
import { PlanCards, PlanPicker } from "@/components/landing/v2/Pricing";
import LogoMark from "@/components/LogoMark";
import { publicSans, ibmPlexMono } from "@/lib/fonts";
import { realProof } from "@/lib/proof";

/**
 * The landing page, as approved on the canvas: MainLean (desktop) and
 * PhoneLean (phone), design brain A-063 on top of A-053 → A-060. One page,
 * both widths; the phone layout takes over below 760px
 * (landing.module.css says how).
 *
 * Less to read (A-063): one watchable demo tells the story that How it
 * works, One customer and See it working used to tell three times, and
 * each promise is said once.
 *
 * The page's centre is the founder's direction of 2026-09-26: FollowUp
 * follows up on its own, and only decisions come to the owner. That is
 * true for an account whose owner chose Automatic in onboarding, which is
 * why the FAQ names the choice — and why this page ships only with, or
 * after, the onboarding step that asks it.
 *
 * Standing rules this page keeps: no invented proof, logos or counts
 * (A-023; the proof section renders only when a story is real), no AI
 * sparkles (S-13), no hand-drawn marks (R-020), a promise is never made
 * twice in different words, and every price or date in an example is shown
 * as a decision that comes to the owner, never as something sent on its
 * own (A-056).
 */

/**
 * Gmail first (A-081, founder 2026-10-04): the page sells the one job on
 * the one inbox. The other channels exist in the product and stay
 * reachable from Settings; here they are named once, as coming, in the
 * one place channels appear (R-020).
 */
const CHANNELS = ["Gmail"];
const COMING = "Outlook, Instagram, Messenger, WhatsApp and a website form are coming. Tell us which you need.";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className={styles.mono}>{children}</div>;
}

/** The section head every section below the hero shares (Linear study, P2): eyebrow, title left, one line right. */
function Head({ eyebrow, title, line, ink }: { eyebrow: string; title: React.ReactNode; line: string; ink?: boolean }) {
  return (
    <div className={styles.head}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={styles.h2}>{title}</h2>
      </div>
      <p className={`${styles.lede} ${ink ? styles.ledeInk : ""}`}>{line}</p>
    </div>
  );
}

export default function LandingPage() {
  const proof = realProof();
  return (
    <div className={`${styles.root} ${publicSans.variable} ${ibmPlexMono.variable}`}>
      {/* ---------- Header ---------- */}
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="FollowUp, home">
            <LogoMark height={22} />
            <span className={styles.brandWord}>FollowUp</span>
          </Link>
          <nav className={styles.nav} aria-label="Page">
            <a href="#demo">How it works</a>
            <a href="#prices">Prices</a>
            <a href="#questions">Questions</a>
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

      <main>
        {/* ---------- Hero ---------- */}
        <section id="top" className={styles.wrap}>
          <div className={styles.hero}>
            <div className={styles.heroText}>
              <h1 className={styles.h1}>
                Never lose a lead
                <br />
                because you forgot
                <br />
                to follow up.
              </h1>
              {/* Gmail first (A-081): the line says what it does on Gmail, never who it's for (R-020). */}
              <p className={styles.heroLede}>
                <span className={styles.heroLedeLong}>
                  FollowUp reads the customers in your Gmail, answers them in your words within minutes, and checks in if they
                  go quiet. When something needs your decision, like a price or a date, it hands it to you.
                </span>
                <span className={styles.heroLedeShort}>
                  It reads the customers in your Gmail, answers in your words within minutes, and checks in if they go quiet.
                </span>
              </p>

              {/* The phone's first screen shows the product doing its job (R-021, A-058): a Gmail lead, the reply written. */}
              <div
                className={`${styles.phonePic} ${styles.washHero} ${styles.grain}`}
                role="img"
                aria-label="A customer emails about a listing. A minute later the reply is written in the owner's words and waits for one tap to send from their own Gmail."
              >
                <div className={styles.pc1}>
                  <div className={`${styles.mono} ${styles.monoTight}`}>Gmail · 2 min ago</div>
                  <p className={styles.pcP} style={{ color: "var(--body-2)" }}>
                    Hi, is the 3-bedroom on Maple Street still available? Could I see it this weekend?
                  </p>
                </div>
                <div className={`${styles.pc2} ${styles.wash} ${styles.grain}`}>
                  <div className={styles.above}>
                    <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--soft)" }}>
                      Reply written · 1 min · in your words
                    </div>
                    <p className={styles.pcP}>Yes, it&apos;s still available. Would Saturday morning work for a viewing?</p>
                  </div>
                </div>
                <div className={styles.pc3}>
                  <span className={styles.dot} style={{ width: 8, height: 8, background: "var(--ink)" }} />
                  <div>
                    <div className={`${styles.mono} ${styles.monoTight}`}>Waits for your OK</div>
                    <div style={{ marginTop: 3, fontSize: 14.5, lineHeight: 1.35 }}>Tap Send. It goes from your own Gmail.</div>
                  </div>
                </div>
              </div>

              <div className={styles.heroActions}>
                <Link href="/signin" className={styles.btn}>
                  Connect Gmail, start free <ArrowIcon />
                </Link>
                <a href="#demo" className={styles.playLink}>
                  <span className={styles.playDot}>
                    <PlayIcon />
                  </span>
                  See how it works
                </a>
                <span className={styles.heroTrustShort}>
                  <CheckIcon size={15} /> Free in beta · No card
                </span>
              </div>
              <div className={styles.heroTrust}>
                <span>
                  <CheckIcon /> Free while in beta · No credit card
                </span>
              </div>
            </div>

            {/* Desktop picture (A-081): a Gmail lead arrives, the reply is written and waits for one tap. */}
            <div className={styles.heroPic} role="img" aria-label="A customer emails about a listing. A minute later the reply is written in the owner's words and waits for one tap to send from their own Gmail.">
              <div className={`${styles.heroPicWash} ${styles.washHero} ${styles.grain}`} />
              <div className={styles.deck1} />
              <div className={styles.deck2} />
              <div className={`${styles.bubble} ${styles.heroMsg}`}>
                <div className={`${styles.mono} ${styles.monoTight}`}>Gmail · 2 min ago · via your listing</div>
                <p className={styles.heroP} style={{ color: "var(--soft)" }}>
                  Hi, is the 3-bedroom on Maple Street still available? Could I see it this weekend?
                </p>
              </div>
              <div className={`${styles.wash} ${styles.grain} ${styles.heroReply}`}>
                <div className={styles.above}>
                  <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--soft)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.dot} style={{ background: "var(--ink)" }} />
                    Reply written · 1 min · in your words
                  </div>
                  <p className={styles.heroP}>Hi Priya, yes, the 3-bedroom on Maple Street is still available. Would Saturday morning work for a viewing?</p>
                  <div className={styles.heroFoot} style={{ justifyContent: "space-between" }}>
                    <span className={`${styles.btn} ${styles.btnSm}`} aria-hidden="true">
                      Send
                    </span>
                    <span>Sent from your own Gmail</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Works with ---------- */}
        <section aria-label="Works with" className={styles.works}>
          <div className={`${styles.wrap} ${styles.worksInner}`}>
            <Eyebrow>Works with</Eyebrow>
            <ul className={styles.worksList}>
              {CHANNELS.map((c) => (
                <li key={c}>
                  <ChannelIcon name={c} />
                  {c}
                </li>
              ))}
            </ul>
            <p className={styles.worksSoon}>{COMING}</p>
          </div>
        </section>

        {/* ---------- The gap ---------- */}
        <section aria-label="The gap" className={`${styles.wrap} ${styles.section}`}>
          <Head
            eyebrow="The gap"
            title={
              <>
                “Which customer am I about to lose because I haven&apos;t replied?”
              </>
            }
            line="A CRM stores names. A reminder tells you it’s time. FollowUp answers them and follows up, every day."
          />
        </section>

        {/* ---------- One customer (A-063) ---------- */}
        <section id="demo" aria-label="One customer" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <WatchDemo />
        </section>

        {/* ---------- Your control (A-063) ----------
            Four promises, one line each, and the one switch worth a picture.
            The other switches are on /security. */}
        <section id="control" aria-label="Your control" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <div className={styles.control}>
            <div>
              <Eyebrow>Your control</Eyebrow>
              <h2 className={styles.h2}>
                What it will
                <br />
                and won&apos;t do.
              </h2>
              <div className={styles.promiseRows}>
                {[
                  ["It stops", "when a customer replies."],
                  ["It asks", "when it isn’t sure."],
                  ["It writes down", "why it sent each message."],
                  ["It’s yours.", "Delete everything, any time."],
                ].map(([t, b]) => (
                  <p key={t}>
                    <span style={{ fontWeight: 500 }}>{t}</span> {b}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <div className={styles.pauseCard} role="img" aria-label="In Settings: Pause all sending. One tap holds everything.">
                <div className={styles.mono}>Settings</div>
                <div className={styles.pauseRow}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 500 }}>Pause all sending</div>
                    <div style={{ marginTop: 4, fontSize: 14.5, lineHeight: 1.45, color: "var(--soft)" }}>One tap holds everything.</div>
                  </div>
                  <span className={styles.toggle}>
                    <span />
                  </span>
                </div>
              </div>
              <Link href="/security" className={`${styles.underline} ${styles.safeLink}`}>
                How we keep your data safe
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Proof (A-050) ----------
            A tester's own before and after, in their numbers and words. Not
            rendered at all until a story is complete and agreed in writing
            (src/lib/proof.ts): no placeholder, no fake quote (A-023). */}
        {proof.length > 0 && (
          <section id="proof" aria-label="Proof" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
            <Head eyebrow="Proof" title="From the first owners using it." line="Their own numbers and their own words." />
            <div className={styles.proofGrid}>
              {proof.map((p) => (
                <figure key={p.firstName + p.business} className={`${styles.card}`} style={{ margin: 0, padding: "26px 24px 28px" }}>
                  <p style={{ margin: 0, fontSize: 15, color: "var(--soft)" }}>
                    <s>{p.before}</s> → <span style={{ fontSize: 28, letterSpacing: "-0.03em", color: "var(--ink)" }}>{p.after}</span>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--dim)" }}>for a customer to hear back, from their own FollowUp records</p>
                  <blockquote style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.45 }}>&ldquo;{p.quote}&rdquo;</blockquote>
                  <figcaption style={{ marginTop: 12, fontSize: 14, color: "var(--soft)" }}>
                    <strong style={{ color: "var(--ink)" }}>{p.firstName}</strong> · {p.business}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Underneath ---------- */}
        <section id="more" aria-label="Underneath" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <Head
            eyebrow="Underneath"
            title={
              <>
                Simple on the outside.
                <br />
                The rest is there when you want it.
              </>
            }
            line="Most days you open one list. Everything else runs behind it."
          />
          <div className={styles.cols}>
            {[
              ["Today", "Who needs you, and why."],
              ["Follow-up plans", "Check-ins you’d forget."],
              ["Rules", "What sends on its own."],
              ["Your week", "Every Monday: who booked."],
              ["Your team", "Customers shared out evenly."],
            ].map(([t, b]) => (
              <div key={t} className={styles.col}>
                <div className={styles.colName}>{t}</div>
                <div className={styles.colBody}>{b}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="prices" aria-label="Pricing" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <Head
            eyebrow="Pricing"
            title={
              <>
                Free while
                <br />
                in beta.
              </>
            }
            line="Then simple monthly prices. No seats, no per-message fees, no AI add-on."
          />
          <div style={{ marginTop: 48 }}>
            <div className={styles.beta}>
              <span className={styles.mono} style={{ color: "var(--ink)", flexShrink: 0 }}>
                In the beta
              </span>
              <span style={{ fontSize: 15.5, lineHeight: 1.45 }}>
                You get everything in Pro, free. There’s no card on file, so nothing can be charged.
              </span>
            </div>
            <PlanCards />
            <PlanPicker />
          </div>
        </section>

        {/* ---------- Questions ---------- */}
        <section id="questions" aria-label="Questions" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <div className={styles.faqWrap}>
            <div className={styles.faqHead}>
              <Eyebrow>Questions</Eyebrow>
              <h2 className={styles.h2}>
                Straight
                <br />
                answers.
              </h2>
              <p className={styles.lede} style={{ marginTop: 20 }}>
                And a real person on email if you want one: <a href="mailto:contact@followupbase.io">contact@followupbase.io</a>
              </p>
            </div>
            <Questions />
          </div>
        </section>

        {/* ---------- Start free ---------- */}
        <section id="start" aria-label="Start free" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <div className={`${styles.washEnd} ${styles.grain} ${styles.startBox}`}>
            <div className={styles.startInner}>
              <h2 className={styles.startH}>Start free.</h2>
              <p style={{ margin: "24px 0 0", fontSize: 19, lineHeight: 1.5, color: "var(--body-2)" }}>Connect your Gmail. That&apos;s it.</p>
              <Link href="/signin" className={styles.btn} style={{ marginTop: 34, fontSize: 17, padding: "17px 28px" }}>
                Start free <ArrowIcon />
              </Link>
              <div className={styles.startTrust}>
                {["Free while in beta, no card"].map((t) => (
                  <span key={t}>
                    <CheckIcon size={15} /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer (A-057) ----------
          The Follow column (blog, social) is not rendered: none of those
          accounts exist yet, and a link to an empty profile or a placeholder
          handle is the kind of fake the page never shows (A-023). */}
      <footer className={styles.footer}>
        <div className={`${styles.wrap}`}>
          <div className={styles.footGrid}>
            <div className={styles.footBrand}>
              <Link href="/" className={styles.brand}>
                <LogoMark height={22} />
                <span className={styles.brandWord}>FollowUp</span>
              </Link>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--soft)" }}>So no customer gets forgotten.</p>
              <a href="mailto:contact@followupbase.io" className={styles.underline} style={{ fontSize: 15 }}>
                contact@followupbase.io
              </a>
            </div>
            <div className={styles.footCol}>
              <Eyebrow>Product</Eyebrow>
              <a href="#demo">How it works</a>
              <a href="#prices">Pricing</a>
              <a href="#questions">Questions</a>
              <Link href="/signin">Sign in</Link>
            </div>
            <div className={styles.footCol}>
              <Eyebrow>Works with</Eyebrow>
              <span style={{ color: "var(--soft)" }}>Gmail</span>
              <span style={{ color: "var(--dim)", fontSize: 14 }}>Outlook, Instagram, Messenger, WhatsApp, website form: coming</span>
            </div>
            <div className={styles.footCol}>
              <Eyebrow>Trust</Eyebrow>
              <Link href="/security">Security</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/security#control">Delete your data</Link>
            </div>
          </div>
          <div className={styles.footBottom}>© 2026 FollowUp</div>
        </div>
      </footer>
    </div>
  );
}
