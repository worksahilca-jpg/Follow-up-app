"use client";

import { useState } from "react";
import styles from "./landing.module.css";
import { CheckIcon, LockIcon } from "./icons";

/**
 * "See it working" (A-053, examples mixed per A-060): one frame, four
 * moments. On a desktop the moments are a list beside the frame; on a
 * phone they are four pills above it (R-015: the phone gets one thing at a
 * time). Same state, same content, two shapes — see landing.module.css.
 *
 * "Try it" shows a fixed example reply, clearly labelled, until the beta
 * opens (PRODUCT_DIRECTION, 2026-09-26: "wait until beta opens"). Nothing
 * a visitor types leaves the browser.
 */
const MOMENTS = [
  {
    short: "Their language",
    title: "Replies in their language",
    desc: "A customer writes in Spanish, they get answered in Spanish. It sounds like you, not a robot.",
  },
  {
    short: "Comes to you",
    title: "Decisions come to you",
    desc: "A price, a date or anything sensitive comes to you first, reply already written. One tap to send.",
  },
  {
    short: "One list",
    title: "Everything it did, in one list",
    desc: "What it sent, what it held for you, and where it stopped. No surprises.",
  },
  {
    short: "Try it",
    title: "Try it with your message",
    desc: "Paste something a customer sent you and see the reply it would write.",
  },
];

function Pill({ tone, strong, children }: { tone: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <span className={`${styles.pill} ${strong ? styles.pillStrong : ""}`}>
      <span className={styles.dot} style={{ background: tone }} />
      {children}
    </span>
  );
}

export default function SeeItWorking() {
  const [tab, setTab] = useState(0);
  const [tried, setTried] = useState(false);
  const current = MOMENTS[tab];

  return (
    <div className={styles.see}>
      <div role="tablist" aria-label="Moments" className={styles.tabs}>
        {MOMENTS.map((m, i) => (
          <button
            key={m.title}
            type="button"
            role="tab"
            id={`see-tab-${i}`}
            aria-selected={i === tab}
            aria-controls="see-panel"
            onClick={() => setTab(i)}
            className={styles.tab}
          >
            <span className={styles.tabShort}>{m.short}</span>
            <span className={styles.tabTitle}>{m.title}</span>
            {i === tab && <span className={styles.tabDesc}>{m.desc}</span>}
          </button>
        ))}
      </div>

      <div id="see-panel" role="tabpanel" aria-labelledby={`see-tab-${tab}`} className={styles.stage}>
        <div className={styles.stageTitle}>
          <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>{current.title}</div>
          <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5, color: "var(--soft)" }}>{current.desc}</p>
        </div>

        {tab === 0 && (
          <div className={styles.scene}>
            <div className={`${styles.bubble} ${styles.sceneMsg}`}>
              <div className={`${styles.mono} ${styles.monoTight}`}>WhatsApp · 4 min ago</div>
              <p className={styles.sceneP} style={{ color: "var(--soft)" }}>
                Hola, ¿todavía se puede visitar la casa de Elm Street?
              </p>
            </div>
            <div className={`${styles.wash} ${styles.grain} ${styles.sceneReply}`}>
              <div className={styles.above}>
                <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--soft)" }}>
                  Sent in Spanish · 1 min
                </div>
                <p className={styles.sceneP}>¡Hola, gracias por escribir! ¿Qué días le vendrían bien? Así le confirmo una hora.</p>
                <div className={styles.heroFoot}>
                  <CheckIcon size={15} className={styles.check} />
                  Sent on its own. No price, no date to promise.
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.avatar} style={{ width: 28, height: 28 }}>
                MA
              </span>
              <span className={styles.rowName}>Mike Alvarez</span>
              <LockIcon />
              <span style={{ marginLeft: "auto" }}>
                <Pill tone="var(--decision)" strong>
                  Needs you
                </Pill>
              </span>
            </div>
            <div className={styles.panelWhy}>
              <span style={{ color: "var(--dim)" }}>Why it waits</span>
              <span>The reply mentions a price, so it&apos;s yours to send.</span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div className={styles.panelDraft}>Hi Mike, the new tap with fitting comes to $240. Shall I book Thursday at 10?</div>
              {/* A picture of the buttons, not buttons: nothing here sends. */}
              <div aria-hidden="true" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span className={styles.fakeSend}>Send</span>
                <span className={styles.fakeEdit}>Edit</span>
                <span className={styles.fakeNo}>Don&apos;t send</span>
              </div>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 20px" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Today</span>
              <span style={{ fontSize: 13, color: "var(--dim)" }}>3 things happened</span>
            </div>
            {[
              ["Checked in with Sarah", "She went quiet after asking about price.", "var(--sage)", "Sent", false],
              ["Waiting for you: Mike", "The reply mentions money, so it's yours to send.", "var(--decision)", "Held for you", true],
              ["Stopped for Priya", "She replied. Nothing more goes out.", "var(--stone)", "Stopped", false],
            ].map(([name, sub, tone, label, strong]) => (
              <div key={name as string} className={styles.logRow}>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div className={styles.rowName}>{name}</div>
                  <div className={styles.rowSub} style={{ fontSize: 13.5 }}>
                    {sub}
                  </div>
                </div>
                <Pill tone={tone as string} strong={strong as boolean}>
                  {label}
                </Pill>
              </div>
            ))}
          </div>
        )}

        {tab === 3 && (
          <div className={styles.tryBox}>
            <label htmlFor="try-message" className={styles.tryLabel}>
              Paste a message a customer sent you.
            </label>
            <textarea
              id="try-message"
              rows={3}
              placeholder="Hi, how much for a deep clean this Saturday?"
              className={styles.tryArea}
            />
            <div className={styles.tryRow}>
              <button type="button" className={styles.btn} style={{ fontSize: 15, padding: "13px 22px" }} onClick={() => setTried(true)}>
                Write my reply
              </button>
              <span style={{ fontSize: 13, color: "var(--dim)" }}>No sign-up. Nothing is sent.</span>
            </div>
            {tried && (
              <div
                className={`${styles.wash} ${styles.grain}`}
                style={{ marginTop: 18, padding: "20px 22px", borderRadius: 16 }}
                role="status"
              >
                <div className={styles.above}>
                  <div className={`${styles.mono} ${styles.monoTight}`} style={{ color: "var(--soft)" }}>
                    Example reply · waits for your OK, it mentions a price
                  </div>
                  <p className={styles.sceneP}>
                    Hi! Yes, Saturday works. A deep clean is usually [YOUR PRICE] for a two-bedroom. Shall I hold 10am for you?
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
