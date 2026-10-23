"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WaitingView } from "@/lib/lessonReview";
import { verdictSentence } from "@/lib/lessonTestResult";

/**
 * "Waiting for your OK" on Admin → Train → Talk to it (A-319). What the founder taught a kind of business waits here,
 * used only in the practice chat, until they put it to work. With a test (realtors today): Test them, then both scores,
 * what changed with both replies, FollowUp's recommendation, and Put them to work or Drop them. Without one: their OK.
 * Keyed by kind on Talk to it, so another kind starts clean. Plan step 3 (2026-10-23): messages written for the new
 * rules join the list of what changed, a broken code check takes "anyway" away, and the chance check says how many
 * messages move on their own.
 */

const solid = "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-40";
const solidStyle = { background: "var(--accent)", color: "var(--on-accent)" };
const quiet = "min-h-11 underline underline-offset-4 disabled:opacity-50";

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: "Couldn't reach FollowUp. Check your connection and try again." } };
  }
}

function day(iso: string): string {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `today at ${time}` : `${day(iso)} at ${time}`;
}

const DOT: Record<string, string> = { worse: "var(--coral)", better: "var(--sage)", same_fail: "var(--ink-faint)" };

export default function TrainWaiting({ trade, short, view }: { trade: string; short: string; view: WaitingView | undefined }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [wording, setWording] = useState("");

  const running = testing || view?.test?.status === "running";
  // A test started from another tab, or before a reload, finishes on the server: look again until it has.
  useEffect(() => {
    if (testing || view?.test?.status !== "running") return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [testing, view?.test?.status, router]);

  const items = view?.items ?? [];
  if (items.length === 0) {
    return done ? (
      <p role="status" className="mt-8 border-t border-line pt-5 text-[15px]">
        {done}
      </p>
    ) : null;
  }

  const n = items.length;
  const one = n === 1;
  const test = view?.test ?? null;
  const current = !!test?.current;
  const rules = items.filter((w) => w.kind === "rule");
  const worse = current ? (test?.worse ?? 0) : 0;
  const blocked = current ? (test?.blocked ?? 0) : 0;

  async function runTest() {
    setTesting(true);
    setError(null);
    const { ok, data } = await post("/api/admin/train/test", { trade });
    setTesting(false);
    if (!ok) setError(String(data.message ?? "The test didn't finish. Test again."));
    router.refresh();
  }

  async function approve(anyway = false) {
    setBusy(true);
    setError(null);
    const { ok, data } = await post("/api/admin/train", { action: "lessons-approve", trade, anyway });
    setBusy(false);
    if (!ok) {
      setError(String(data.message ?? "That didn't work. Try again."));
      router.refresh();
      return;
    }
    setDone(`Put to work. Every ${short} business uses ${one ? "it" : "them"} from its next reply. You can undo any rule below.`);
    router.refresh();
  }

  async function drop(key: string) {
    if (key.startsWith("conversation:") && !window.confirm("This takes the pasted conversation out for good. Drop it?")) return;
    setBusy(true);
    setError(null);
    const { ok } = await post("/api/admin/train", { action: "lessons-drop", key });
    setBusy(false);
    if (!ok) setError("That didn't drop. Try again.");
    router.refresh();
  }

  async function dropAll() {
    if (items.some((w) => w.kind === "conversation") && !window.confirm("This takes the pasted conversations out for good. Drop them all?")) return;
    setBusy(true);
    setError(null);
    const { ok } = await post("/api/admin/train", { action: "lessons-drop-all", trade });
    setBusy(false);
    if (!ok) {
      setError("That didn't drop. Try again.");
      return;
    }
    setDone(`Dropped. ${short} businesses never got ${one ? "it" : "them"}.`);
    router.refresh();
  }

  async function saveWording(id: string) {
    const text = wording.trim();
    if (!text || busy) return;
    setBusy(true);
    const { ok } = await post("/api/admin/train", { action: "rule-edit", id, text });
    setBusy(false);
    if (!ok) {
      setError("That didn't save. Try again.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  const list = (
    <ul className="mt-3">
      {items.map((w) => (
        <li key={w.key} className="border-t border-line py-3">
          {editing === w.id ? (
            <div>
              <label htmlFor={`waiting-wording-${w.id}`} className="mb-1 block text-[12.5px] text-ink-faint">
                The rule, in new words
              </label>
              <textarea
                id={`waiting-wording-${w.id}`}
                value={wording}
                onChange={(e) => setWording(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed"
                style={{ borderColor: "var(--line-strong)" }}
              />
              <div className="mt-2 flex items-center gap-3">
                <button type="button" onClick={() => saveWording(w.id)} disabled={!wording.trim() || busy} className={solid} style={solidStyle}>
                  Save
                </button>
                <button type="button" onClick={() => setEditing(null)} className={`${quiet} text-ink-soft`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                {w.said && <p className="break-words text-sm text-ink-soft">“{w.said}”</p>}
                <p className="break-words">{w.text}</p>
                {w.replaces && <p className="mt-1 break-words text-[13.5px] text-ink-soft">Replaces “{w.replaces}”</p>}
                <p className="mt-1 text-[12.5px] text-ink-faint">
                  {w.label} · {day(w.at)}
                </p>
              </div>
              <div className="flex gap-3 text-sm text-ink-soft">
                {w.kind === "rule" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(w.id);
                      setWording(w.text);
                    }}
                    disabled={busy || running}
                    className={quiet}
                  >
                    Change
                  </button>
                )}
                <button type="button" onClick={() => drop(w.key)} disabled={busy || running} className={quiet}>
                  Drop
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const dropsOut = view?.dropsOut ?? [];
  const dropsOutLine =
    dropsOut.length > 0 ? (
      <p className="mt-3 text-[13.5px] text-ink-soft">
        Putting {one ? "it" : "them"} to work means FollowUp stops reading {dropsOut.length === 1 ? "your oldest rule" : `your ${dropsOut.length} oldest rules`}:{" "}
        {dropsOut.map((t) => `“${t}”`).join(", ")}. Every reply reads the newest 20.
      </p>
    ) : null;

  const errorLine = error && (
    <p role="alert" className="mt-3 text-[14px]" style={{ color: "var(--coral)" }}>
      {error}
    </p>
  );

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="talk-waiting" className="text-lg font-semibold">
        Waiting for your OK
      </h2>
      <span className="text-sm text-ink-soft">
        {n} {one ? "change" : "changes"} · {trade}
      </span>
    </div>
  );

  // A kind with no test messages yet: the founder's OK is the whole step.
  if (!view?.hasTest) {
    return (
      <section className="mt-8 border-t border-line pt-5" aria-labelledby="talk-waiting">
        {header}
        <p className="mt-1.5 max-w-[62ch] text-sm text-ink-soft">
          There&apos;s no reply test for {short} yet, so FollowUp can&apos;t show what changes. Only your practice chat uses{" "}
          {one ? "it" : "these"} until you put {one ? "it" : "them"} to work.
        </p>
        {list}
        {dropsOutLine}
        {errorLine}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => approve()} disabled={busy} className={solid} style={solidStyle}>
            Put {one ? "it" : "them"} to work
          </button>
          <button type="button" onClick={dropAll} disabled={busy} className={`${quiet} text-[15px] text-ink-soft`}>
            Drop {one ? "it" : "them"}
          </button>
        </div>
      </section>
    );
  }

  const size = view.testSize;
  if (!current || running) {
    return (
      <section className="mt-8 border-t border-line pt-5" aria-labelledby="talk-waiting">
        {header}
        <p className="mt-1.5 max-w-[62ch] text-sm text-ink-soft">
          Only your practice chat uses {one ? "it" : "these"}. FollowUp answers {size} realtor messages with and without{" "}
          {one ? "it" : "them"}, so you see what changes before every {short} business gets {one ? "it" : "them"}.
        </p>
        {list}
        {test?.status === "done" && !running && <p className="mt-3 text-[13.5px] text-ink-soft">Something changed since the last test, so test again.</p>}
        {test?.status === "failed" && !running && test.error && (
          <p className="mt-3 text-[13.5px]" style={{ color: "var(--coral)" }}>
            {test.error}
          </p>
        )}
        {errorLine}
        <div className="mt-3.5 flex flex-wrap items-center gap-3" aria-live="polite">
          {running ? (
            <p className="text-[15px] text-ink-soft">
              Testing… FollowUp is answering the {size} messages{rules.length > 0 ? ", and a few written for your new rules," : ""} three
              times each way. About 3 minutes.
            </p>
          ) : (
            <>
              <button type="button" onClick={runTest} disabled={busy} className={solid} style={solidStyle}>
                Test {one ? "it" : "them"}
              </button>
              <span className="text-sm text-ink-soft">About 3 minutes. You can keep talking to it meanwhile.</span>
            </>
          )}
        </div>
      </section>
    );
  }

  // A test that covered exactly what is waiting.
  const t = test!;
  const verdict = verdictSentence(t);
  const same = t.cases + t.targeted - t.changes.filter((c) => c.change !== "same_fail").length;
  const chance = t.chance;
  const chanceLine = !chance
    ? "One message either way can still be chance."
    : chance.flips === 0
      ? `When FollowUp answered the same ${chance.cases} messages twice with nothing changed, every one came out the same.`
      : `When FollowUp answered the same ${chance.cases} messages twice with nothing changed, ${chance.flips} came out differently, so a change of ${chance.flips === 1 ? "one message" : `${chance.flips} or fewer`} can be chance.`;
  const onlyRule = rules.length === 1 ? rules[0] : null;
  return (
    <section className="mt-8 border-t border-line pt-5" aria-labelledby="talk-waiting">
      {header}
      <div className="mt-3.5 rounded-2xl border border-line bg-card">
        <p className="px-4 pt-3.5 text-[13px] text-ink-soft">
          Tested {when(t.at)} on {t.cases} realtor Instagram messages{t.targeted > 0 ? ` and ${t.targeted} written for your rules` : ""}, each
          answered {t.tries} times both ways
        </p>
        <div className="flex flex-wrap">
          {[
            ["Without your changes", t.passedWithout],
            ["With them", t.passedWith],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-[140px] flex-1 px-4 py-3">
              <p className="text-[13px] text-ink-soft">{label}</p>
              <p className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.01em] tabular-nums">
                {value} <span className="text-[15px] font-medium tracking-normal text-ink-soft">of {t.cases} pass</span>
              </p>
            </div>
          ))}
        </div>
        <p className="px-4 pb-3.5 text-[15px]">
          <strong>{verdict.lead}</strong> {verdict.rest}
        </p>
      </div>

      {t.changes.length > 0 && (
        <>
          <h3 className="mt-5 text-[15px] font-semibold">What changed</h3>
          <ul className="mt-1.5">
            {t.changes.map((c) => (
              <li key={c.name} className="border-t border-line py-3">
                <p className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[c.change] }} />
                  {c.name}
                </p>
                <p className="ml-4 mt-0.5 text-sm text-ink-soft">{c.sentence}</p>
                {c.change === "same_fail" ? (
                  <details className="ml-4">
                    <summary className={`${quiet} inline-flex cursor-pointer items-center text-sm text-ink-soft`}>See both replies</summary>
                    <Replies said={c.said} without={c.without} withIt={c.with} />
                  </details>
                ) : (
                  <Replies said={c.said} without={c.without} withIt={c.with} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2.5 max-w-[62ch] text-[13.5px] text-ink-soft">
        A message passes only when all {t.tries} of its replies pass. {chanceLine} The other {same}{" "}
        {same === 1 ? "message came" : "messages came"} out the same both ways.
      </p>

      {worse > 0 ? (
        list
      ) : (
        <details className="mt-1">
          <summary className={`${quiet} inline-flex cursor-pointer items-center text-sm text-ink-soft`}>
            The {one ? "change" : `${n} changes`}
          </summary>
          {list}
        </details>
      )}
      {dropsOutLine}
      {errorLine}

      {worse > 0 ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-4">
          {onlyRule && editing !== onlyRule.id && (
            <button
              type="button"
              onClick={() => {
                setEditing(onlyRule.id);
                setWording(onlyRule.text);
              }}
              disabled={busy}
              className={solid}
              style={solidStyle}
            >
              Change the rule&apos;s wording
            </button>
          )}
          {blocked === 0 && (
            <button type="button" onClick={() => approve(true)} disabled={busy} className={`${quiet} text-[15px] text-ink-soft`}>
              Put {one ? "it" : "them"} to work anyway
            </button>
          )}
          <button type="button" onClick={dropAll} disabled={busy} className={`${quiet} text-[15px] text-ink-soft`}>
            Drop {one ? "it" : "them"}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3.5 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => approve()} disabled={busy} className={solid} style={solidStyle}>
              Put {one ? "it" : "them"} to work
            </button>
            <button type="button" onClick={dropAll} disabled={busy} className={`${quiet} text-[15px] text-ink-soft`}>
              Drop {one ? "it" : "them"}
            </button>
          </div>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Every {short} business uses {one ? "it" : "them"} from its next reply. You can undo any rule later.
          </p>
        </>
      )}
    </section>
  );
}

function Replies({ said, without, withIt }: { said: string; without: string; withIt: string }) {
  return (
    <div className="ml-4 mt-2 grid gap-1.5 text-[14.5px]">
      <p className="break-words">
        <span className="block text-[12.5px] text-ink-faint">Customer</span>“{said}”
      </p>
      <p className="break-words">
        <span className="block text-[12.5px] text-ink-faint">Without your changes</span>
        {without}
      </p>
      <p className="break-words">
        <span className="block text-[12.5px] text-ink-faint">With them</span>
        {withIt}
      </p>
    </div>
  );
}
