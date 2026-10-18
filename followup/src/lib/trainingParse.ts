import { deidentifyText, type KnownIdentifier } from "@/lib/deidentify";
import { MAX_EXAMPLE_TEXT } from "@/lib/ownerExampleLines";

/**
 * "Train FollowUp" (A-292), the pure half: read a pasted conversation (a WhatsApp export, or plain "Name: text"
 * lines from an Instagram chat or an email thread), take the names, numbers, emails, links and addresses out, and
 * turn each good agent reply into an example (what the customer said, what the agent answered). No database here.
 *
 * Nothing raw is ever kept: the route reads the paste, and only what leaves this file is saved.
 */

export type TrainingChannel = "email" | "instagram" | "whatsapp" | "text";
export const TRAINING_CHANNELS: readonly TrainingChannel[] = ["email", "instagram", "whatsapp", "text"];

export type ParsedLine = { speaker: string; text: string };
export type TrainingTurn = { from: "customer" | "agent"; text: string };
export type TrainingExampleDraft = { context: TrainingTurn[]; customerSaid: string; reply: string };

/** A paste longer than this is refused before it is read. */
export const MAX_PASTE = 200_000;
/** Turns kept before each example, so the scorecard can replay the moment. */
export const CONTEXT_TURNS = 8;
/** Examples taken from one conversation. */
export const MAX_EXAMPLES_PER_CONVERSATION = 60;

// "[10/18/26, 10:02:13 AM] Name: text" (WhatsApp on iPhone) and "10/18/26, 10:02 - Name: text" (Android).
const DATE = String.raw`\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}`;
const TIME = String.raw`\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s?[APap]\.?\s?[Mm]\.?)?`;
const WA_BRACKET = new RegExp(String.raw`^\[(${DATE}),?\s+(${TIME})\]\s*([^:]{1,60}?):\s?(.*)$`);
const WA_DASH = new RegExp(String.raw`^(${DATE}),?\s+(${TIME})\s+[-–]\s+([^:]{1,60}?):\s?(.*)$`);
// "[10:02] Name: text" or "10:02 Name: text"
const TIME_ONLY = new RegExp(String.raw`^\[?(${TIME})\]?\s+([^:]{1,40}?):\s?(.*)$`);
const PLAIN = /^([^:]{1,40}?):\s?(.*)$/;

/** WhatsApp's own lines, and the stand-ins it writes for media: never a turn. */
const SYSTEM_TEXT =
  /^(messages and calls are end-to-end encrypted|.*(?:<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|document omitted|gif omitted)|this message was deleted|you deleted this message|missed (?:voice|video) call|.* (?:joined|left|added|removed|changed the subject|changed this group's icon).*)$/i;

const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;

function plausibleSpeaker(name: string): boolean {
  const n = name.trim();
  if (!n || /https?:|www\./i.test(n)) return false;
  return n.split(/\s+/).length <= 5;
}

/** Each message as (speaker, text). A line that starts no message continues the one above it. */
export function parseConversation(raw: string): { speakers: string[]; lines: ParsedLine[] } {
  const lines: ParsedLine[] = [];
  let plainMode = false;
  for (const rawLine of raw.slice(0, MAX_PASTE).replace(INVISIBLE, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = WA_BRACKET.exec(line) ?? WA_DASH.exec(line);
    let speaker: string | null = null;
    let text = "";
    if (m) [speaker, text] = [m[3], m[4]];
    else {
      const t = TIME_ONLY.exec(line);
      if (t) [speaker, text] = [t[2], t[3]];
      else {
        const p = PLAIN.exec(line);
        if (p && plausibleSpeaker(p[1])) {
          [speaker, text] = [p[1], p[2]];
          plainMode = true;
        }
      }
    }
    if (speaker && plausibleSpeaker(speaker)) {
      lines.push({ speaker: speaker.trim(), text: text.trim() });
    } else if (lines.length) {
      lines[lines.length - 1].text += `\n${line}`;
    }
  }

  // In plain "Name: text" pastes, "Note: call back" inside a message looks like a speaker. Anyone who speaks only
  // once while two others speak more is a line of the message above.
  if (plainMode) {
    const count = new Map<string, number>();
    for (const l of lines) count.set(l.speaker, (count.get(l.speaker) ?? 0) + 1);
    const regulars = [...count.values()].filter((c) => c > 1).length;
    if (regulars >= 2) {
      for (let i = lines.length - 1; i > 0; i--) {
        if (count.get(lines[i].speaker) === 1) {
          lines[i - 1].text += `\n${lines[i].speaker}: ${lines[i].text}`;
          lines.splice(i, 1);
        }
      }
    }
  }

  const kept = lines.filter((l) => l.text && !SYSTEM_TEXT.test(l.text));
  const speakers = [...new Set(kept.map((l) => l.speaker))];
  return { speakers, lines: kept };
}

/** The agent is usually the one who answers: the second person to speak. The founder can change it. */
export function guessAgent(lines: readonly ParsedLine[]): string | null {
  const first = lines[0]?.speaker;
  return lines.find((l) => l.speaker !== first)?.speaker ?? null;
}

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

/** Emails, phones, addresses and links, then every speaker's full name and each part of it (3+ letters). */
export function scrub(text: string, speakers: readonly string[], agent: string): string {
  const ids: KnownIdentifier[] = [];
  for (const s of speakers) {
    const placeholder = s === agent ? "[AGENT_NAME]" : "[CUSTOMER_NAME]";
    ids.push({ value: s, placeholder });
    for (const part of s.split(/\s+/)) if (part.replace(/\W/g, "").length >= 3) ids.push({ value: part, placeholder });
  }
  // Longest first, so "Ana Lopez" goes before "Ana".
  ids.sort((a, b) => b.value.length - a.value.length);
  // Emails, phones, addresses and links first, so a name inside an email address can't break it apart.
  const patterned = deidentifyText(text.replace(URL_RE, "[LINK]"), []).replace(/\(\s*\[PHONE\]/g, "[PHONE]");
  return ids.reduce(
    (t, id) => t.replace(new RegExp(`(?<!\\w)${id.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`, "gi"), id.placeholder),
    patterned
  );
}

/** The conversation as turns, scrubbed, with a speaker's back-to-back messages joined into one. */
export function toTurns(lines: readonly ParsedLine[], agent: string): TrainingTurn[] {
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const turns: TrainingTurn[] = [];
  for (const l of lines) {
    const from = l.speaker === agent ? "agent" : "customer";
    const text = scrub(l.text, speakers, agent);
    const last = turns[turns.length - 1];
    if (last && last.from === from) last.text += `\n${text}`;
    else turns.push({ from, text });
  }
  return turns;
}

/** Each agent turn that answers a customer turn is an example, with the turns before it as its moment. */
export function toExamples(turns: readonly TrainingTurn[]): TrainingExampleDraft[] {
  const out: TrainingExampleDraft[] = [];
  for (let i = 1; i < turns.length && out.length < MAX_EXAMPLES_PER_CONVERSATION; i++) {
    if (turns[i].from !== "agent" || turns[i - 1].from !== "customer") continue;
    const reply = turns[i].text.trim();
    if (reply.replace(/\W/g, "").length < 2) continue;
    out.push({
      context: turns.slice(Math.max(0, i - 1 - CONTEXT_TURNS), i - 1).map((t) => ({ from: t.from, text: t.text.slice(0, MAX_EXAMPLE_TEXT) })),
      customerSaid: turns[i - 1].text.trim().slice(0, MAX_EXAMPLE_TEXT),
      reply: reply.slice(0, MAX_EXAMPLE_TEXT),
    });
  }
  return out;
}
