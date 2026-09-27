import Link from "next/link";
import styles from "@/components/landing/v2/landing.module.css";
import { ArrowIcon, CheckIcon, PlayIcon, ChannelIcon } from "@/components/landing/v2/icons";
import SeeItWorking from "@/components/landing/v2/SeeItWorking";
import Questions from "@/components/landing/v2/Questions";
import { PlanCards, PlanPicker } from "@/components/landing/v2/Pricing";
import LogoMark from "@/components/LogoMark";
import { publicSans, ibmPlexMono } from "@/lib/fonts";
import { realProof } from "@/lib/proof";

/**
 * The landing page, as approved on the canvas: MainV2 (desktop) and PhoneV2
 * (phone), design brain A-053 → A-060. One page, both widths; the phone
 * layout takes over below 760px (landing.module.css says how).
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

const CHANNELS = ["Gmail", "Outlook", "Instagram", "Messenger", "WhatsApp", "Your website"];

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

function Pill({ tone, strong, children }: { tone: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <span className={`${styles.pill} ${strong ? styles.pillStrong : ""}`}>
      <span className={styles.dot} style={{ background: tone }} />
      {children}
    </span>
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
            <a href="#how">How it works</a>
            <a href="#see">Try it</a>
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
              <p className={styles.heroLede}>
                <span className={styles.heroLedeLong}>
                  FollowUp answers every customer and follows up on its own, in their language. When something needs your
                  decision, like a price or a date, it hands it to you.
                </span>
                <span className={styles.heroLedeShort}>
                  It answers every customer and follows up on its own. Only the decisions come to you.
                </span>
              </p>

              {/* The phone's first screen shows the product doing its job (R-021, A-058). */}
              <div
                className={`${styles.phonePic} ${styles.washHero} ${styles.grain}`}
                role="img"
                aria-label="A customer asks for a quote on Instagram. FollowUp replies on its own in a minute. The price comes to you."
              >
                <div className={styles.pc1}>
                  <div className={`${styles.mono} ${styles.monoTight}`}>Instagram · now</div>
                  <p className={styles.pcP} style={{ color: "var(--body-2)" }}>
                    Hi! Can you quote a new kitchen tap this week?
                  </p>
                </div>
                <div className={`${styles.pc2} ${styles.wash} ${styles.grain}`}>
                  <div className={styles.above}>
                    <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--soft)" }}>
                      Sent on its own · 1 min
                    </div>
                    <p className={styles.pcP}>Thanks! Happy to quote that. Could you send a photo of your current tap?</p>
                  </div>
                </div>
                <div className={styles.pc3}>
                  <span className={styles.dot} style={{ width: 8, height: 8, background: "var(--decision)" }} />
                  <div>
                    <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--decision)" }}>
                      Needs you · the price
                    </div>
                    <div style={{ marginTop: 3, fontSize: 14.5, lineHeight: 1.35 }}>Reply written. You add the number.</div>
                  </div>
                </div>
              </div>

              <div className={styles.heroActions}>
                <Link href="/signin" className={styles.btn}>
                  Start free <ArrowIcon />
                </Link>
                <a href="#story" className={styles.playLink}>
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
                <span>
                  <CheckIcon /> Prices and dates always come to you · Delete everything, any time
                </span>
              </div>
            </div>

            {/* Desktop picture: the message arrives, the reply goes on its own. */}
            <div className={styles.heroPic} role="img" aria-label="A customer asks for a quote on Instagram, and FollowUp replies on its own a minute later, from the owner's own address.">
              <div className={`${styles.heroPicWash} ${styles.washHero} ${styles.grain}`} />
              <div className={styles.deck1} />
              <div className={styles.deck2} />
              <div className={`${styles.bubble} ${styles.heroMsg}`}>
                <div className={`${styles.mono} ${styles.monoTight}`}>Instagram · 2 min ago</div>
                <p className={styles.heroP} style={{ color: "var(--soft)" }}>
                  Hi! Can you quote a new kitchen tap this week?
                </p>
              </div>
              <div className={`${styles.wash} ${styles.grain} ${styles.heroReply}`}>
                <div className={styles.above}>
                  <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--soft)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.dot} style={{ background: "var(--ink)" }} />
                    Sent on its own · 1 min
                  </div>
                  <p className={styles.heroP}>Thanks! Happy to quote that. Could you send a photo of your current tap?</p>
                  <div className={styles.heroFoot}>
                    <CheckIcon size={15} className={styles.check} />
                    Sent from your own address
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

        {/* ---------- How it works ---------- */}
        <section id="how" aria-label="How it works" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <Head
            eyebrow="How it works"
            title={
              <>
                Connect. It follows up.
                <br />
                You decide.
              </>
            }
            line="Two minutes to set up. Then it follows up every day, and hands you only the decisions."
          />

          <div className={styles.steps}>
            <div>
              <Eyebrow>1 · Connect</Eyebrow>
              <div className={styles.stepTitle}>Connect where customers write.</div>
              <p className={styles.stepBody}>Your inbox, Instagram, WhatsApp or website form. Two minutes.</p>
              <div className={`${styles.card} ${styles.cardPad}`} aria-hidden="true">
                <div className={styles.row} style={{ justifyContent: "space-between" }}>
                  <span className={styles.rowName}>Gmail or Outlook</span>
                  <Pill tone="var(--sage)">Connected</Pill>
                </div>
                {["Instagram", "WhatsApp", "Website form"].map((c) => (
                  <div key={c} className={styles.row} style={{ justifyContent: "space-between" }}>
                    <span className={styles.rowName}>{c}</span>
                    <span className={styles.fakeBtn}>Connect</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow>2 · Follow up</Eyebrow>
              <div className={styles.stepTitle}>It follows up on its own.</div>
              <p className={styles.stepBody}>
                Every customer gets an answer, then check-ins, in their language. It stops the moment they reply.
              </p>
              <div className={`${styles.card} ${styles.cardPad}`}>
                <div style={{ fontSize: 13, color: "var(--dim)" }}>Today, while you worked</div>
                {[
                  ["GK", "Grace Kim", "Day-3 check-in after a viewing, on its own", false],
                  ["OH", "Omar Haddad", "Answered how his coaching sessions work", false],
                  ["PS", "Priya Shah", "Asked for a price. That’s your call.", true],
                ].map(([init, name, sub, decision]) => (
                  <div key={name as string} className={styles.row}>
                    <span className={styles.avatar}>{init}</span>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div className={styles.rowName}>{name}</div>
                      <div className={styles.rowSub}>{sub}</div>
                    </div>
                    {decision ? (
                      <Pill tone="var(--decision)" strong>
                        Needs you
                      </Pill>
                    ) : (
                      <Pill tone="var(--slate)">Sent</Pill>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow>3 · Decide</Eyebrow>
              <div className={styles.stepTitle}>Only the decisions come to you.</div>
              <p className={styles.stepBody}>A price, a date or a tricky moment. The reply is already written; you check it and send.</p>
              <div className={`${styles.card} ${styles.cardPad}`}>
                <div className={`${styles.wash} ${styles.grain}`} style={{ padding: "14px 16px", borderRadius: 16 }}>
                  <div className={styles.above}>
                    <div style={{ fontSize: 12.5, color: "var(--soft)" }}>Needs you · it names a price</div>
                    <p style={{ margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.5 }}>
                      Hi Priya, a full bathroom usually starts around $6,500. Could I come by Thursday to measure?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Phone: the same three steps as plain lines (A-057). */}
          <ol className={styles.stepLines}>
            {[
              ["01", "Connect where customers write.", "Inbox, Instagram, WhatsApp or website form. Two minutes."],
              ["02", "It follows up on its own.", "Every customer gets an answer, then check-ins, in their language."],
              ["03", "Only the decisions come to you.", "A price, a date or a tricky moment, with the reply already written."],
            ].map(([n, t, b]) => (
              <li key={n}>
                <span className={styles.mono} style={{ fontSize: 12, paddingTop: 3 }}>
                  {n}
                </span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 500 }}>{t}</div>
                  <div style={{ marginTop: 3, fontSize: 15, lineHeight: 1.5, color: "var(--soft)" }}>{b}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- One customer ---------- */}
        <section id="story" aria-label="One customer" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <div className={styles.story}>
            <div className={styles.storyHead}>
              <Eyebrow>One customer</Eyebrow>
              <h2 className={styles.h2}>
                On its own,
                <br />
                except the price.
              </h2>
              <p className={styles.lede} style={{ marginTop: 20 }}>
                One customer, start to finish. FollowUp did the follow-up; you made one decision.
              </p>
            </div>

            <div className={`${styles.card} ${styles.storyCard}`}>
              {[
                {
                  when: "Tue · 10:12",
                  title: "Sarah asked about a price.",
                  body: <div className={styles.theirBubble}>Hi! What does your 3-month coaching package cost?</div>,
                },
                {
                  when: "Tue · 10:12",
                  title: "A price is your call, so it came to you.",
                  body: (
                    <div className={styles.card} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14 }}>
                      <span className={styles.avatar} style={{ width: 28, height: 28 }}>
                        SJ
                      </span>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>Sarah Johnson</div>
                        <div style={{ fontSize: 13, color: "var(--soft)" }}>Price to confirm · reply written</div>
                      </div>
                      <Pill tone="var(--decision)" strong>
                        Needs you
                      </Pill>
                    </div>
                  ),
                },
                {
                  when: "Tue · 10:42",
                  title: "You were busy, so FollowUp let Sarah know.",
                  body: (
                    <div className={styles.sentLine}>
                      <CheckIcon size={15} className={styles.check} />
                      <span>Sent: “Thanks Sarah! Let me check and I’ll send you the price soon.” No number, no promise.</span>
                    </div>
                  ),
                },
                {
                  when: "Tue · 12:40",
                  title: "You added the number and sent it.",
                  body: (
                    <div className={`${styles.wash} ${styles.grain}`} style={{ padding: "14px 16px", borderRadius: 16 }}>
                      <div className={styles.above}>
                        <div style={{ fontSize: 12.5, color: "var(--soft)" }}>Sent by you</div>
                        <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>
                          Hi Sarah, the 3-month package is $1,200. Would you like a free 20-minute call first?
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  when: "Fri",
                  title: "Sarah went quiet. FollowUp checked in on its own.",
                  body: (
                    <div className={styles.sentLine}>
                      <CheckIcon size={15} className={styles.check} />
                      <span>Sent: a short check-in. It stops the moment Sarah writes back.</span>
                    </div>
                  ),
                },
              ].map((s, i, all) => (
                <div key={s.when + s.title} className={styles.tl}>
                  <div className={styles.tlRail}>
                    <span className={styles.tlNum}>{i + 1}</span>
                    {i < all.length - 1 && <span className={styles.tlLine} />}
                  </div>
                  <div className={styles.tlBody} style={i === all.length - 1 ? { paddingBottom: 0 } : undefined}>
                    <div className={`${styles.mono} ${styles.monoTight}`}>{s.when}</div>
                    <div className={styles.tlTitle}>{s.title}</div>
                    {s.body}
                  </div>
                </div>
              ))}
            </div>

            {/* Phone: the same story as plain lines; red dots mark the decision (A-057). */}
            <div className={styles.storyLinesWrap}>
              <ol className={styles.storyLines}>
                {[
                  ["Tue · 10:12", "Sarah asked what your coaching package costs.", false],
                  ["Tue · 10:12", "A price is your call, so it came to you, reply written.", true],
                  ["Tue · 10:42", "You were busy, so FollowUp told Sarah you’d send the price soon. No number, no promise.", false],
                  ["Tue · 12:40", "You added the number and sent it.", true],
                  ["Fri", "Sarah went quiet. FollowUp checked in on its own. It stops the moment she writes back.", false],
                ].map(([when, text, decision]) => (
                  <li key={(when as string) + (text as string)}>
                    <span className={styles.storyDot} style={decision ? { background: "var(--decision)" } : undefined} />
                    <div className={`${styles.mono} ${styles.monoTight}`}>{when}</div>
                    <div style={{ marginTop: 3, fontSize: 16, lineHeight: 1.45 }}>{text}</div>
                  </li>
                ))}
              </ol>
              <p className={styles.storyLines} style={{ border: 0, marginTop: 16, fontSize: 14, color: "var(--soft)" }}>
                Red dots: the one decision that came to you.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- See it working ---------- */}
        <section id="see" aria-label="See it working" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <Head
            eyebrow="See it working"
            title={
              <>
                It does the work.
                <br />
                You stay in charge.
              </>
            }
            line="It follows up on its own. It hands you only the decisions: a price, a date, a tricky moment."
            ink
          />
          <SeeItWorking />
        </section>

        {/* ---------- Your control ---------- */}
        <section id="control" aria-label="Your control" className={`${styles.wrap} ${styles.section} ${styles.ruled}`}>
          <Head
            eyebrow="Your control"
            title={
              <>
                What it will
                <br />
                and won&apos;t do.
              </>
            }
            line="Four promises built into the product, and the switches that stay in your hands."
          />
          <div className={styles.promises}>
            {[
              ["It stops", "When a customer replies, it stops. No more messages to them."],
              ["It’s safe", "When it isn’t sure, it asks you. Prices, dates and anything tense wait for your OK."],
              ["It’s honest", "Every message it sends is written down, with the reason it was sent."],
              ["It’s yours", "You can delete everything it has, whenever you want."],
            ].map(([t, b]) => (
              <div key={t} className={`${styles.card} ${styles.promise}`}>
                <div className={styles.mono} style={{ color: "var(--ink)" }}>
                  {t}
                </div>
                <p>{b}</p>
              </div>
            ))}
          </div>
          <div className={styles.promiseList}>
            {[
              ["It stops.", "No more messages once a customer replies."],
              ["It’s safe.", "When it isn’t sure, it asks you. Prices, dates and anything tense wait for your OK."],
              ["It’s honest.", "Everything it sends is written down, with the reason."],
              ["It’s yours.", "Delete everything it has, whenever you want."],
            ].map(([t, b]) => (
              <p key={t}>
                <span style={{ fontWeight: 500 }}>{t}</span> {b}
              </p>
            ))}
          </div>

          <div className={styles.switchesBlock} style={{ marginTop: 64 }}>
            <Eyebrow>What stays in your hands</Eyebrow>
            <p style={{ margin: "12px 0 18px", fontSize: 19, lineHeight: 1.5 }}>Switches you can use any time, without asking us.</p>
            <div className={styles.switches}>
              {[
                ["Ask me before everything", "Turn it on and every reply waits for your OK."],
                ["Pause all sending", "One tap holds everything. Your settings stay as they are."],
                ["Only admins send", "Your team writes and edits replies. An admin sends them."],
                ["Recent sign-ins", "See where your account was signed in, and sign out everywhere."],
              ].map(([t, b]) => (
                <div key={t} className={styles.switch}>
                  <div className={styles.switchName}>{t}</div>
                  <div className={styles.switchBody}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 24 }} className={styles.chips}>
            <div className={styles.mono} style={{ width: "100%" }}>
              Switches, any time
            </div>
            {["Ask me before everything", "Pause all sending", "Only admins send", "Recent sign-ins"].map((c) => (
              <span key={c} className={styles.chip}>
                {c}
              </span>
            ))}
          </div>

          <div className={styles.googleLine}>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: "var(--soft)" }}>
              It asks Google only for what it needs, and can’t see anything you haven’t connected.
            </p>
            <Link href="/security" className={styles.underline} style={{ flexShrink: 0, fontSize: 16, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              How we keep your data safe
            </Link>
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
            line="Less chasing, more booking. Most days you open one list, and everything else runs behind it."
          />
          <div className={styles.cols}>
            {[
              ["Today", "No message missed. Who needs you, and why."],
              ["Follow-up plans", "Check-ins you’d forget. They stop the moment they answer."],
              ["Rules", "What goes out on its own, and what always comes to you."],
              ["Your week", "Every Monday: who answered, who came back, who booked."],
              ["Your team", "New customers shared out evenly. See who’s falling behind."],
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
            <div className={styles.money}>
              {[
                ["What happens when the beta ends?", "Nothing is charged unless you pick a plan. You stay on Free, with everything you set up."],
                ["What counts as a customer?", "One new person who writes to you, counted once, however many messages they send."],
                ["Can I leave?", "Any time. You can delete everything FollowUp has, whenever you want."],
              ].map(([q, a]) => (
                <div key={q} className={styles.col}>
                  <div className={styles.moneyQ}>{q}</div>
                  <p className={styles.moneyA}>{a}</p>
                </div>
              ))}
            </div>
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
              <p style={{ margin: "24px 0 0", fontSize: 19, lineHeight: 1.5, color: "var(--body-2)" }}>Connect your inbox. That&apos;s it.</p>
              <Link href="/signin" className={styles.btn} style={{ marginTop: 34, fontSize: 17, padding: "17px 28px" }}>
                Start free <ArrowIcon />
              </Link>
              <div className={styles.startTrust}>
                {["Decisions always come to you", "Free while in beta, no card", "Delete everything, any time"].map((t) => (
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
              <a href="#how">How it works</a>
              <a href="#see">See it working</a>
              <a href="#prices">Pricing</a>
              <a href="#questions">Questions</a>
              <Link href="/signin">Sign in</Link>
            </div>
            <div className={styles.footCol}>
              <Eyebrow>Works with</Eyebrow>
              {["Gmail", "Outlook", "Instagram", "Messenger", "WhatsApp", "Website form"].map((c) => (
                <span key={c} style={{ color: "var(--soft)" }}>
                  {c}
                </span>
              ))}
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
