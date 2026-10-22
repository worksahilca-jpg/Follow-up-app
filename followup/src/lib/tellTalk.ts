/**
 * "Talk to FollowUp about your business" (A-318): the 5-minute meeting (A-314) said out loud instead of typed. The owner
 * talks; the recording is turned into words (the same transcription voicemails use) and never kept; FollowUp reads the
 * words against the meeting's questions; what it takes waits in the meeting's draft with the words themselves, and the
 * same play-back shows it, so nothing said aloud is used before "Looks right".
 *
 * Every value is copied from what the owner said, as in the typed meeting: a value that isn't in the words is dropped
 * (correctionRows in src/lib/tellFollowUp.ts, with room for MAX_TALK_ROWS).
 */
// The meeting's page uses these too, so nothing here may import server code: factLines reaches the database through
// deidentify, so its one-line squash is repeated here.
const squash = (t: string) => t.replace(/\s+/g, " ").trim();

/** The longest talk FollowUp takes: the page stops recording here on its own. */
export const MAX_TALK_SECONDS = 300;
/** Shorter than this is a slip of the thumb, not a talk. */
export const MIN_TALK_SECONDS = 3;
/**
 * The biggest recording accepted. The page records at 32 kbps, about 1.2 MB for five minutes; this leaves room for a
 * browser that ignores the asked-for rate, and stays under the 4.5 MB a serverless request may carry.
 */
export const MAX_TALK_BYTES = 4 * 1024 * 1024;
/** The words kept with the draft, at most: five minutes of talking is about 4,000 characters. */
export const MAX_TALK_CHARS = 6000;
/** What FollowUp takes from one talk, at most: a whole meeting's worth. */
export const MAX_TALK_ROWS = 16;

/** The recording kinds a phone or computer browser makes, and the file name the transcription needs to read each. */
const KINDS: [prefix: string, name: string][] = [
  ["audio/webm", "talk.webm"],
  ["audio/ogg", "talk.ogg"],
  ["audio/mp4", "talk.mp4"],
  ["audio/x-m4a", "talk.m4a"],
  ["audio/aac", "talk.m4a"],
  ["audio/mpeg", "talk.mp3"],
  ["audio/wav", "talk.wav"],
  ["audio/x-wav", "talk.wav"],
];

/** The file name for a recording of this kind, or null for anything that isn't a recording FollowUp takes. */
export function talkFileName(type: string): string | null {
  const t = type.toLowerCase().split(";")[0].trim();
  return KINDS.find(([prefix]) => t === prefix)?.[1] ?? null;
}

/** "2 min 14 s", "45 s". */
export function talkLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`;
}

/** "1:24" on the timer while the owner talks. */
export function talkClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What the owner said, as kept with the meeting's draft. */
export type Talk = { text: string; seconds: number };

/** A talk as stored, checked again: it comes back from the database as plain JSON. Null when there is none. */
export function readTalk(raw: unknown): Talk | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === "string" ? squash(o.text).slice(0, MAX_TALK_CHARS) : "";
  const seconds = typeof o.seconds === "number" && Number.isFinite(o.seconds) ? Math.round(o.seconds) : -1;
  if (!text || seconds < 0 || seconds > MAX_TALK_SECONDS) return null;
  return { text, seconds };
}
