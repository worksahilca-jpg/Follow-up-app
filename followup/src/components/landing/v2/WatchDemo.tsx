"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";
import d from "./demo.module.css";
import { CheckIcon } from "./icons";

/**
 * One customer, start to finish (design brain A-063). It replaces How it
 * works, One customer and See it working, which told this same story three
 * times: the real Today screen plays it in five steps instead.
 *
 * Every line in the thread is something the product does today:
 *  - a price comes to the owner with the reply written (assessSendRisk);
 *  - after 30 minutes the customer hears the holding line, word for word
 *    from holdingMessage.ts, which promises nothing;
 *  - the owner adds the number and sends;
 *  - the check-in on Friday is the day-3 reminder, and it stops when she
 *    replies.
 *
 * Motion only adds or changes what is on screen (A-048). Pause and Replay
 * are there because it moves for more than five seconds (WCAG 2.2.2).
 * Reduced motion shows the end of the story, still, with nothing to pause.
 * The loop restarts when the section first comes into view, so a visitor
 * starts at step 1, not in the middle.
 */
const CAPTIONS = [
  "A customer asks the price.",
  "It comes to you, reply written.",
  "Busy? It tells her you’re on it.",
  "You add the number. Send.",
  "It checks in, then stops.",
];

const STORY =
  "Example: Sarah asks the price on Instagram. It comes to you with the reply written. After 30 minutes FollowUp tells her you are on it. You add $1,200 and send. On Friday it checks in, Sarah replies, and the check-ins stop.";

function Dot({ tone }: { tone: string }) {
  return <span className={d.dot} style={{ background: tone }} />;
}

function Status({ k, tone, children, rest }: { k: string; tone: string; children: React.ReactNode; rest?: boolean }) {
  return (
    <span className={`${d.status} ${rest ? "" : d.t} ${k ? d[k] : ""}`}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

function Pill({ k, tone, strong, rest, children }: { k: string; tone: string; strong?: boolean; rest?: boolean; children: React.ReactNode }) {
  return (
    <span className={`${d.pill} ${rest ? "" : d.t} ${d[k]}`} style={strong ? { fontWeight: 600 } : undefined}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

function Row({ init, name, children, on }: { init: string; name: string; children: React.ReactNode; on?: boolean }) {
  return (
    <div className={`${d.row} ${on ? d.rowOn : ""}`}>
      <span className={d.av}>{init}</span>
      <div style={{ minWidth: 0 }}>
        <div className={d.rowName}>{name}</div>
        <div className={d.stack}>{children}</div>
      </div>
    </div>
  );
}

function Theirs({ k, when, children }: { k: string; when: string; children: React.ReactNode }) {
  return (
    <div className={`${d.inMsg} ${d[k]}`}>
      <div className={d.meta}>{when}</div>
      <div className={`${d.bub} ${d.bubIn}`}>{children}</div>
    </div>
  );
}

function Ours({ k, when, you, children }: { k: string; when: string; you?: boolean; children: React.ReactNode }) {
  return (
    <div className={`${d.outMsg} ${d[k]}`}>
      <div className={d.meta}>{when}</div>
      <div className={`${d.bub} ${you ? `${d.bubYou} ${styles.wash}` : d.bubAuto}`}>{children}</div>
    </div>
  );
}

function Sys({ k, tone, children }: { k: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`${d.sys} ${d[k]}`}>
      <Dot tone={tone} />
      {children}
    </div>
  );
}

function Window() {
  return (
    <div className={d.window} role="img" aria-label={STORY}>
      <div className={d.winTop}>
        <span className={d.winTitle}>Today</span>
        <span className={d.stack} style={{ fontSize: 13.5, color: "var(--soft)", justifyItems: "end" }}>
          <span className={`${d.t} ${d.kHNew}`}>1 new</span>
          <span className={`${d.t} ${d.kHNeed}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink)", fontWeight: 500 }}>
            <Dot tone="var(--decision)" />1 needs you
          </span>
          <span className={d.kHDone} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CheckIcon size={15} /> You’re caught up
          </span>
        </span>
      </div>
      <div className={d.body}>
        <div className={d.list}>
          <Row init="SJ" name="Sarah Johnson" on>
            <Status k="kPNew" tone="var(--slate)">New · Instagram</Status>
            <Status k="kPNeed" tone="var(--decision)">
              <b style={{ fontWeight: 600, color: "var(--ink)" }}>Needs you</b> · a price
            </Status>
            <Status k="kPSent" tone="var(--sage)">Sent · waiting on her</Status>
            <Status k="kPStop" tone="var(--stone)" rest>
              Stopped · she replied
            </Status>
          </Row>
          <Row init="GK" name="Grace Kim">
            <Status k="" tone="var(--sage)" rest>
              Sent · day-3 check-in
            </Status>
          </Row>
          <Row init="LO" name="Luis Ortega">
            <Status k="" tone="var(--sage)" rest>
              Sent · in Spanish
            </Status>
          </Row>
          <Row init="PS" name="Priya Shah">
            <Status k="" tone="var(--stone)" rest>
              Stopped · she replied
            </Status>
          </Row>
        </div>
        <div className={d.conv}>
          <div className={d.convHead}>
            <span className={`${d.av} ${d.convAv}`}>SJ</span>
            <span className={d.convTitle}>
              <span className={d.convName}>Sarah Johnson</span> <span className={d.convVia}>· Instagram</span>
            </span>
            <span className={d.convPills}>
              <Pill k="kPNew" tone="var(--slate)">New</Pill>
              <Pill k="kPNeed" tone="var(--decision)" strong>
                Needs you
              </Pill>
              <Pill k="kPSent" tone="var(--sage)">Sent</Pill>
              <Pill k="kPStop" tone="var(--stone)" rest>
                Stopped
              </Pill>
            </span>
          </div>
          <div className={d.thread}>
            <Theirs k="kM1" when="Instagram · Tue 10:12">
              Hi! What does your 3-month coaching package cost?
            </Theirs>
            <Sys k="kS1" tone="var(--decision)">
              Came to you · it names a price
            </Sys>
            <Ours k="kM2" when="Sent on its own · 10:42">
              Thanks for asking! Let me check and I’ll send you the price soon.
            </Ours>
            <Ours k="kM3" when="Sent by you · 12:40" you>
              <span className={styles.above}>Hi Sarah, the 3-month package is $1,200. Would you like a free 20-minute call first?</span>
            </Ours>
            <Ours k="kM4" when="Sent on its own · Fri 9:00">
              Hi Sarah, just checking in. Any questions about the package?
            </Ours>
            <Theirs k="kM5" when="Fri 11:05">
              Thanks! Booking the call now.
            </Theirs>
            <Sys k="kS2" tone="var(--stone)">
              Check-ins stopped · Sarah replied
            </Sys>
          </div>
          <div className={d.composer}>
            <div className={`${d.empty} ${d.t} ${d.kCA}`}>Reply to Sarah…</div>
            <div className={`${d.t} ${d.kCB}`}>
              <div className={`${d.meta} ${d.needs}`}>
                <Dot tone="var(--decision)" />
                Needs you · it names a price
              </div>
              <div className={d.draft}>
                Hi Sarah, the 3-month package is{" "}
                <span className={d.slot}>
                  <span className={`${d.slotEmpty} ${d.t} ${d.kCBb}`}>$ price</span>
                  <span className={`${d.slotFull} ${d.t} ${d.kCBf}`}>$1,200</span>
                </span>
                . Would you like a free 20-minute call first?
              </div>
              <div className={d.acts}>
                <span className={`${d.send} ${d.kPress}`}>Send</span>
                <span className={d.edit}>Edit</span>
              </div>
            </div>
            <div className={`${d.done} ${d.kCC}`}>
              <CheckIcon size={15} /> Nothing waiting on you.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export default function WatchDemo() {
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Restart the loop in place: take the timeline off, let the browser see
  // that, put it back. The DOM stays, so the Replay button keeps focus.
  const restart = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove(d.run);
    void el.offsetWidth;
    el.classList.add(d.run);
  }, []);

  // Start from step 1 the first time the demo is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          restart();
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [restart]);

  return (
    <div ref={ref} className={`${d.demo} ${d.run} ${paused ? d.paused : ""}`}>
      <div className={d.head}>
        <div className={styles.mono}>One customer</div>
        <h2 className={styles.h2}>
          On its own,
          <br />
          except the price.
        </h2>
        {/* The "that's simple" step of the founder's strategy, since How it works folded into this demo (A-063). */}
        <p className={styles.lede} style={{ marginTop: 14 }}>
          Connect your inbox in 2 minutes. It finds who’s waiting and follows up.
        </p>
      </div>

      <ol className={d.caps}>
        {CAPTIONS.map((c, i) => (
          <li key={c}>
            <span className={d.num}>{i + 1}</span>
            <div>
              <div className={`${d.cap} ${d[`kCap${i + 1}`]}`}>{c}</div>
              <div className={d.track}>
                <div className={`${d.bar} ${d[`kBar${i + 1}`]}`} />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className={d.pcaps}>
        <ol className={d.pcapList}>
          <li className={`${d.stillText} ${d.kStill}`} aria-hidden="true">
            One customer, start to finish.
          </li>
          {CAPTIONS.map((c, i) => (
            <li key={c} className={`${d.one} ${d[`kOne${i + 1}`]}`}>
              <span className={`${styles.mono} ${d.oneNum}`}>{i + 1}/5</span>
              <span className={d.oneText}>{c}</span>
            </li>
          ))}
        </ol>
        <div className={d.segs} aria-hidden="true">
          {CAPTIONS.map((c, i) => (
            <span key={c}>
              <span className={`${d.seg} ${d[`kSeg${i + 1}`]}`} />
            </span>
          ))}
        </div>
      </div>

      <div className={d.ctl}>
        <button type="button" className={d.btn} onClick={() => setPaused((p) => !p)}>
          {paused ? <PlayIcon /> : <PauseIcon />}
          {paused ? "Play" : "Pause"}
        </button>
        <button
          type="button"
          className={d.btn}
          onClick={() => {
            setPaused(false);
            restart();
          }}
        >
          <ReplayIcon />
          Replay
        </button>
      </div>

      <div className={`${styles.mono} ${d.note}`}>
        <span className={d.noteLong}>An example, not a real customer</span>
        <span className={d.noteShort}>Example</span>
      </div>

      <div className={d.win}>
        <Window />
      </div>
    </div>
  );
}
