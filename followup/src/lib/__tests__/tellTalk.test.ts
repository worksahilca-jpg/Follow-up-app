import { describe, expect, it } from "vitest";
import { readTalk, talkClock, talkFileName, talkLength } from "@/lib/tellTalk";
import { parseTellDraft } from "@/lib/tellFollowUp";

describe("Talk to FollowUp (A-318)", () => {
  it("names each recording kind a browser makes, and nothing else", () => {
    expect(talkFileName("audio/webm;codecs=opus")).toBe("talk.webm");
    expect(talkFileName("audio/mp4")).toBe("talk.mp4");
    expect(talkFileName("audio/ogg; codecs=opus")).toBe("talk.ogg");
    expect(talkFileName("text/plain")).toBeNull();
    expect(talkFileName("")).toBeNull();
  });

  it("says how long a talk was, and shows the timer", () => {
    expect(talkLength(134)).toBe("2 min 14 s");
    expect(talkLength(120)).toBe("2 min");
    expect(talkLength(45)).toBe("45 s");
    expect(talkClock(84.6)).toBe("1:24");
    expect(talkClock(5)).toBe("0:05");
  });

  it("reads a stored talk back defensively", () => {
    expect(readTalk({ text: "  I sell  homes ", seconds: 61.4 })).toEqual({ text: "I sell homes", seconds: 61 });
    expect(readTalk({ text: "", seconds: 10 })).toBeNull();
    expect(readTalk({ text: "x", seconds: 9999 })).toBeNull();
    expect(readTalk("nope")).toBeNull();
  });

  it("keeps the talk with the meeting's draft", () => {
    const draft = parseTellDraft({ rows: [{ label: "What you do", value: "Realtor" }], talk: { text: "I'm a realtor", seconds: 30 } });
    expect(draft.talk).toEqual({ text: "I'm a realtor", seconds: 30 });
    expect(parseTellDraft({ rows: [] })).toEqual({ rows: [] });
  });
});
