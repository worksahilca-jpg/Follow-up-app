import { describe, it, expect } from "vitest";
import { guessAgent, parseConversation, scrub, toExamples, toTurns } from "@/lib/trainingParse";

const IPHONE = `[10/18/26, 10:02:13 AM] Maya Chen: Hi is the condo on 42 King Street still available?
[10/18/26, 10:05:01 AM] Ravi Patel: Hi Maya! Yes it is. Are you hoping to move soon?
[10/18/26, 10:07:44 AM] Maya Chen: Soon, our lease ends in March.
Is parking included?
[10/18/26, 10:08:02 AM] Maya Chen: ‎image omitted
[10/18/26, 10:09:30 AM] Ravi Patel: One spot. Call me on (416) 555-0199 or ravi@realty.ca
[10/18/26, 10:09:31 AM] Ravi Patel: https://example.com/listing/123`;

const ANDROID = `18/10/2026, 10:02 - Maya Chen: Hi
18/10/2026, 10:03 - Ravi Patel: Hello! How can I help?
18/10/2026, 10:04 - Maya Chen: Looking for a 2 bed`;

describe("parseConversation", () => {
  it("reads an iPhone WhatsApp export, joins wrapped lines, drops media lines", () => {
    const { speakers, lines } = parseConversation(IPHONE);
    expect(speakers).toEqual(["Maya Chen", "Ravi Patel"]);
    expect(lines).toHaveLength(5);
    expect(lines[2].text).toBe("Soon, our lease ends in March.\nIs parking included?");
  });

  it("reads an Android export", () => {
    expect(parseConversation(ANDROID).lines.map((l) => l.speaker)).toEqual(["Maya Chen", "Ravi Patel", "Maya Chen"]);
  });

  it("reads plain Name: text lines, and keeps 'Note:' inside a message", () => {
    const { speakers, lines } = parseConversation(
      "Customer: Hi\nAgent: Hello\nNote: I can do evenings\nCustomer: Great\nAgent: See you then"
    );
    expect(speakers).toEqual(["Customer", "Agent"]);
    expect(lines[1].text).toBe("Hello\nNote: I can do evenings");
  });
});

describe("guessAgent", () => {
  it("is the second person to speak", () => {
    expect(guessAgent(parseConversation(IPHONE).lines)).toBe("Ravi Patel");
  });
});

describe("scrub", () => {
  it("takes out names, first names, phones, emails, addresses and links", () => {
    const out = scrub("Hi Maya, Ravi here. 42 King Street. (416) 555-0199, ravi@realty.ca, www.x.com/a", ["Maya Chen", "Ravi Patel"], "Ravi Patel");
    expect(out).not.toMatch(/Maya|Ravi|King|555|realty|x\.com/);
    expect(out).toContain("[CUSTOMER_NAME]");
    expect(out).toContain("[AGENT_NAME]");
  });
});

describe("toTurns and toExamples", () => {
  it("joins back-to-back messages and makes one example per answered customer turn", () => {
    const { lines } = parseConversation(IPHONE);
    const turns = toTurns(lines, "Ravi Patel");
    expect(turns.map((t) => t.from)).toEqual(["customer", "agent", "customer", "agent"]);
    const examples = toExamples(turns);
    expect(examples).toHaveLength(2);
    expect(examples[0].context).toEqual([]);
    expect(examples[1].context).toHaveLength(2);
    expect(examples[1].reply).toContain("Call me on [PHONE]");
    expect(examples[1].reply).toContain("[EMAIL]");
    expect(examples[1].reply).toContain("[LINK]");
    expect(JSON.stringify(examples)).not.toMatch(/Maya|Ravi|555|realty/);
  });

  it("makes no example from an agent who speaks first", () => {
    expect(toExamples([{ from: "agent", text: "Hi" }, { from: "customer", text: "Hey" }])).toEqual([]);
  });
});
