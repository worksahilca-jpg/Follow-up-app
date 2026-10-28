import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/types";
import {
  anotherTimeText,
  asksToCancel,
  asksToMeet,
  asksToMove,
  bookedCardWords,
  bookedText,
  cancelAckText,
  cancelledBuzz,
  cancelledCardWords,
  keepText,
  moveOfferText,
  movedText,
  ownerCancelText,
  ownerChangeText,
  pickedCardWords,
  reofferText,
  carriesOffer,
  chooseTwo,
  confirmLabel,
  lastOurs,
  offerButtons,
  offerText,
  offerTimesPromptBlock,
  pickAck,
  pickedBuzz,
  pickedLines,
  readOfferedTimes,
  readPick,
  sayTime,
  sayTimes,
  wantedDay,
  whatFor,
} from "@/lib/bookingTimes";

// Wednesday, Oct 28 2026, 10:00 in Toronto (EDT).
const NOW = new Date("2026-10-28T14:00:00.000Z");
const TZ = "America/Toronto";
const THU_10 = "2026-10-29T14:00:00.000Z";
const THU_1030 = "2026-10-29T14:30:00.000Z";
const THU_11 = "2026-10-29T15:00:00.000Z";
const FRI_13 = "2026-10-30T17:00:00.000Z";
const FRI_14 = "2026-10-30T18:00:00.000Z";
const NEXT_FRI_1130 = "2026-11-06T16:30:00.000Z"; // EST by then
const SLOTS = [THU_10, THU_1030, THU_11, FRI_13, FRI_14];
const OFFER = { at: [THU_10, FRI_13], said: ["tomorrow at 10 am", "Friday at 1 pm"] };

const m = (direction: "inbound" | "outbound", body: string, trigger: string | null = null): Message =>
  ({ id: `m-${body.length}-${direction}`, direction, body, date: "2026-10-28T13:00:00.000Z", trigger } as unknown as Message);

describe("asksToMeet", () => {
  it("reads a request to see a home on a day", () => {
    expect(asksToMeet([m("outbound", "Hi Raj, happy to help."), m("inbound", "Can we see 42 Elm St this Saturday?")])).toBe(true);
  });
  it("reads a request for a call with a question mark", () => {
    expect(asksToMeet([m("inbound", "Could we hop on a quick call?")])).toBe(true);
  });
  it("is not a question about the listing, a thanks, or a no", () => {
    expect(asksToMeet([m("inbound", "Is it still available?")])).toBe(false);
    expect(asksToMeet([m("inbound", "Thanks for the info!")])).toBe(false);
    expect(asksToMeet([m("inbound", "No thanks, not interested in seeing it")])).toBe(false);
    expect(asksToMeet([m("inbound", "What's the price?")])).toBe(false);
  });
  it("only reads the customer's newest message", () => {
    expect(asksToMeet([m("inbound", "Can we see it Saturday?"), m("outbound", "Sure, which day?")])).toBe(false);
  });
});

describe("wantedDay", () => {
  it("reads a weekday, tomorrow, today and the weekend", () => {
    expect(wantedDay("Saturday works", NOW, TZ)).toBe(6);
    expect(wantedDay("maybe fri?", NOW, TZ)).toBe(5);
    expect(wantedDay("tomorrow?", NOW, TZ)).toBe(4);
    expect(wantedDay("today if possible", NOW, TZ)).toBe(3);
    expect(wantedDay("this weekend", NOW, TZ)).toBe(6);
    expect(wantedDay("whenever", NOW, TZ)).toBeNull();
  });
});

describe("chooseTwo", () => {
  it("picks a whole hour from mid-morning on the first day and early afternoon on the next", () => {
    expect(chooseTwo(SLOTS, { timeZone: TZ, now: NOW })).toEqual([THU_10, FRI_13]);
  });
  it("honours the day they asked for, then takes the other day", () => {
    expect(chooseTwo(SLOTS, { timeZone: TZ, now: NOW, wantDay: 5 })).toEqual([FRI_13, THU_10]);
  });
  it("skips times already offered or picked", () => {
    expect(chooseTwo(SLOTS, { timeZone: TZ, now: NOW, avoid: [THU_10, FRI_13] })).toEqual([THU_11, FRI_14]);
  });
  it("offers one time when only one day is open, and nothing when none is", () => {
    expect(chooseTwo([THU_10, THU_11], { timeZone: TZ, now: NOW })).toEqual([THU_10]);
    expect(chooseTwo([], { timeZone: TZ, now: NOW })).toBeNull();
  });
});

describe("saying a time", () => {
  it("says tomorrow, the weekday, or the date a week out", () => {
    expect(sayTime(THU_10, TZ, NOW)).toBe("tomorrow at 10 am");
    expect(sayTime(FRI_13, TZ, NOW)).toBe("Friday at 1 pm");
    expect(sayTime(NEXT_FRI_1130, TZ, NOW)).toBe("Friday, Nov 6 at 11:30 am");
    expect(sayTime("2026-10-28T19:30:00.000Z", TZ, NOW)).toBe("today at 3:30 pm");
  });
  it("joins two with or, and writes the fixed sentences", () => {
    expect(sayTimes(OFFER.said)).toBe("tomorrow at 10 am or Friday at 1 pm");
    expect(offerText(OFFER.said)).toBe("I can do tomorrow at 10 am or Friday at 1 pm. Which works for you?");
    expect(offerText(["Friday at 1 pm"])).toBe("I can do Friday at 1 pm. Does that work for you?");
    expect(anotherTimeText(OFFER.said)).toMatch(/^Sorry, that one doesn't work on my side after all\. I can do tomorrow at 10 am or Friday at 1 pm\./);
    expect(pickAck()).toBe("Great. Let me confirm that and get right back to you.");
    expect(bookedText(FRI_13, TZ, "42 Elm St, Oakville")).toBe("Booked: Friday, Oct 30 at 1 pm, 42 Elm St, Oakville. See you then.");
    expect(bookedText(FRI_13, TZ, null)).toBe("Booked: Friday, Oct 30 at 1 pm. See you then.");
  });
  it("keeps DM buttons under Meta's 20 characters", () => {
    expect(offerButtons(OFFER, TZ, NOW)).toEqual(["Tomorrow 10 am", "Fri 1 pm"]);
    for (const b of offerButtons({ at: [NEXT_FRI_1130, "2026-11-07T19:30:00.000Z"], said: ["", ""] }, TZ, NOW)) expect(b.length).toBeLessThanOrEqual(20);
  });
  it("writes the owner's card and buzz words", () => {
    expect(confirmLabel(FRI_13, TZ, NOW)).toBe("Friday 1 PM");
    expect(confirmLabel(THU_10, TZ, NOW)).toBe("Tomorrow 10 AM");
    expect(pickedLines(FRI_13, TZ, NOW)).toEqual({ day: "Friday, Oct 30", time: "1:00 PM" });
    expect(pickedLines(THU_1030, TZ, NOW)).toEqual({ day: "Tomorrow, Oct 29", time: "10:30 AM" });
    expect(pickedBuzz("Raj", "Friday at 1 pm")).toEqual({ title: "Raj picked a time", body: "Raj wants Friday at 1 pm. Tap to confirm." });
  });
  it("gives the email writer both times and one job", () => {
    const block = offerTimesPromptBlock(OFFER.said);
    expect(block).toContain("tomorrow at 10 am or Friday at 1 pm");
    expect(block).toMatch(/never say anything is booked/i);
    expect(offerTimesPromptBlock(null)).toBe("");
  });
});

describe("carriesOffer", () => {
  it("is true of FollowUp's own offer and of a writer's draft that kept both times", () => {
    expect(carriesOffer(offerText(OFFER.said), OFFER, TZ, NOW)).toBe(true);
    expect(carriesOffer("Hi Raj, I'd love to show you 42 Elm St. I could do tomorrow at 10:00 am or Friday at 1:00 pm. Which suits you?", OFFER, TZ, NOW)).toBe(true);
  });
  it("is false when a time was dropped or changed", () => {
    expect(carriesOffer("Sure, happy to show you around!", OFFER, TZ, NOW)).toBe(false);
    expect(carriesOffer("I can do tomorrow at 10 am. Which works?", OFFER, TZ, NOW)).toBe(false);
    expect(carriesOffer("I can do tomorrow at 10 am or Friday at 3 pm.", OFFER, TZ, NOW)).toBe(false);
  });
  it("finds the last real message FollowUp or the owner sent, past an instant acknowledgement", () => {
    const thread = [m("inbound", "hi"), m("outbound", offerText(OFFER.said)), m("inbound", "ok"), m("outbound", "Got it, one moment.", "instant_ack")];
    expect(lastOurs(thread)?.body).toBe(offerText(OFFER.said));
  });
});

describe("readPick", () => {
  it("reads a day, a time, a button, and an ordinal", () => {
    expect(readPick("Thursday works for us.", OFFER, TZ, NOW)).toBe(0);
    expect(readPick("tomorrow at 10 is good", OFFER, TZ, NOW)).toBe(0);
    expect(readPick("Friday at 1 works", OFFER, TZ, NOW)).toBe(1);
    expect(readPick("Fri 1 pm", OFFER, TZ, NOW)).toBe(1);
    expect(readPick("1 pm works", OFFER, TZ, NOW)).toBe(1);
    expect(readPick("The second one please", OFFER, TZ, NOW)).toBe(1);
    expect(readPick("the first one", OFFER, TZ, NOW)).toBe(0);
    expect(readPick("Either is fine", OFFER, TZ, NOW)).toBe(0);
  });
  it("reads nothing from neither, from a thanks, from a bare number, or from a new ask", () => {
    expect(readPick("Neither works for me, sorry", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("Thanks!", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("10 works", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("Can we do 10 am Friday instead?", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("10 am Saturday?", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("Thursday or Friday both fine", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("Friday at 1 am", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("Can't do Thursday", OFFER, TZ, NOW)).toBeNull();
    expect(readPick("Yes, no problem, Thursday", OFFER, TZ, NOW)).toBe(0);
  });
  it("reads a yes when only one time was offered", () => {
    const one = { at: [FRI_13], said: ["Friday at 1 pm"] };
    expect(readPick("Sure, that works", one, TZ, NOW)).toBe(0);
    expect(readPick("Can't do Friday", one, TZ, NOW)).toBeNull();
  });
});

describe("whatFor and readOfferedTimes", () => {
  it("names the meeting from the words used", () => {
    expect(whatFor([m("inbound", "Can we see 42 Elm St this Saturday?"), m("outbound", offerText(OFFER.said))])).toBe("Viewing");
    expect(whatFor([m("inbound", "Could we hop on a quick call?"), m("outbound", offerText(OFFER.said))])).toBe("Call");
    expect(whatFor([m("inbound", "Could you come by and give us a number?"), m("outbound", offerText(OFFER.said))])).toBe("Home visit");
  });
  it("reads only a well-formed stored offer", () => {
    expect(readOfferedTimes({ at: [THU_10, FRI_13], said: ["a", "b"], offeredAt: "x" })).toEqual({ at: [THU_10, FRI_13], said: ["a", "b"], offeredAt: "x" });
    expect(readOfferedTimes({ at: ["nope"], said: ["a"] })).toBeNull();
    expect(readOfferedTimes({ at: [THU_10], said: [] })).toBeNull();
    expect(readOfferedTimes(null)).toBeNull();
    expect(readOfferedTimes("x")).toBeNull();
  });
});

describe("change or cancel in the chat (part 2)", () => {
  const SAT = "2026-10-31T15:00:00.000Z"; // Saturday 11 am Toronto, the booked time
  const move = (t: string) => asksToMove(t, SAT, TZ, NOW);
  const cancel = (t: string) => asksToCancel(t, SAT, TZ, NOW);

  it("reads a request to move the booked time", () => {
    expect(move("Can we reschedule? Something came up.")).toBe(true);
    expect(move("Could we move it to Sunday?")).toBe(true);
    expect(move("Can't make Saturday, is Sunday possible?")).toBe(true);
    expect(move("I can't make it Saturday after all")).toBe(true);
    expect(move("Cancel Saturday, can we do Monday instead?")).toBe(true);
    expect(move("Is there a different time that works?")).toBe(true);
    expect(move("can we do 2 pm instead of 11?")).toBe(true);
  });
  it("reads a cancel that asks for nothing else", () => {
    expect(cancel("I need to cancel Saturday, sorry")).toBe(true);
    expect(cancel("Something came up, I have to cancel")).toBe(true);
    expect(cancel("We changed our mind, no need for the viewing")).toBe(true);
    expect(cancel("Let's call it off for now")).toBe(true);
  });
  it("never reads both, and leaves a real no to the no safety net", () => {
    expect(move("I need to cancel Saturday, sorry")).toBe(false);
    expect(cancel("Can't make Saturday, is Sunday possible?")).toBe(false);
    expect(cancel("Cancel Saturday, can we do Monday instead?")).toBe(false);
    expect(cancel("Cancel it, we're not interested anymore")).toBe(false);
    expect(move("Cancel it, we're not interested anymore")).toBe(false);
    expect(cancel("Please stop messaging me")).toBe(false);
  });
  it("reads nothing into an ordinary message", () => {
    expect(move("See you Saturday at 11!")).toBe(false);
    expect(cancel("See you Saturday at 11!")).toBe(false);
    expect(move("What should I bring?")).toBe(false);
    expect(cancel("Thanks, looking forward to it")).toBe(false);
  });
  it("says the fixed words", () => {
    expect(moveOfferText(["Sunday at 11 am", "Monday at 1 pm"])).toBe("Sure, let's find another time. I can do Sunday at 11 am or Monday at 1 pm. Which works for you?");
    expect(movedText("2026-11-01T16:00:00.000Z", TZ, "42 Elm St, Oakville")).toBe("Moved: Sunday, Nov 1 at 11 am, 42 Elm St, Oakville. See you then.");
    expect(keepText("Saturday at 11 am", "Sunday at 11 am")).toBe("Sorry, Sunday at 11 am doesn't work on my side after all. Can you still make Saturday at 11 am? If not, tell me and I'll find another time.");
    expect(cancelAckText("Saturday at 11 am")).toBe("No problem, I've taken Saturday at 11 am off the calendar. Whenever you'd like to set up another time, just let me know.");
    expect(ownerChangeText("Saturday at 11 am", ["Sunday at 11 am", "Monday at 1 pm"])).toBe("Sorry, something came up on my side and I can't do Saturday at 11 am anymore. I can do Sunday at 11 am or Monday at 1 pm. Which works for you?");
    expect(ownerCancelText("Saturday at 11 am")).toBe("Sorry, I have to cancel Saturday at 11 am. I'll get back to you about another time.");
    expect(reofferText(["Sunday at 11 am"])).toBe("If it helps, I can do Sunday at 11 am. Does that work for you?");
    expect(cancelledBuzz("Raj", "Saturday at 11 am")).toEqual({ title: "Raj cancelled", body: "Raj cancelled Saturday at 11 am. Offer another time?" });
    expect(pickedBuzz("Raj", "Sunday at 11 am", "Saturday at 11 am")).toEqual({ title: "Raj wants to move", body: "Raj wants Sunday at 11 am instead of Saturday at 11 am. Tap to confirm." });
    expect(offerTimesPromptBlock(["Sunday at 11 am", "Monday at 1 pm"], true)).toContain("THEY WANT TO MOVE THE TIME THEY HAD BOOKED");
  });
  it("words the cards: a move carries the old time, booked and cancelled carry theirs", () => {
    const conversation = [m("inbound", "Can we see 42 Elm St this Saturday?"), m("outbound", offerText(OFFER.said))];
    const moved = pickedCardWords({ name: "Raj Mehta", conversation, pickedTime: "2026-11-01T16:00:00.000Z", upcomingBooking: { id: "b1", at: SAT } }, TZ, NOW);
    expect(moved).toMatchObject({ first: "Raj", what: "Viewing", label: "Sunday 11 AM", from: { said: "Saturday at 11 am", label: "Saturday 11 AM" } });
    expect(pickedCardWords({ name: "Raj Mehta", conversation, pickedTime: "2026-11-01T16:00:00.000Z" }, TZ, NOW)?.from).toBeNull();
    const booked = bookedCardWords({ name: "Raj Mehta", conversation, upcomingBooking: { id: "b1", at: SAT } }, TZ, NOW);
    expect(booked).toMatchObject({ id: "b1", first: "Raj", what: "Viewing", day: "Saturday, Oct 31", time: "11:00 AM", said: "Saturday at 11 am", label: "Saturday 11 AM" });
    expect(bookedCardWords({ name: "Raj Mehta", conversation, upcomingBooking: { id: "b0", at: "2026-10-20T15:00:00.000Z" } }, TZ, NOW)).toBeNull();
    expect(bookedCardWords({ name: "Raj Mehta", conversation }, TZ, NOW)).toBeNull();
    expect(cancelledCardWords({ name: "Raj Mehta", conversation, cancelledBooking: { id: "b1", at: SAT } }, TZ, NOW)).toEqual({ id: "b1", first: "Raj", said: "Saturday at 11 am" });
    expect(cancelledCardWords({ name: "Raj Mehta", conversation }, TZ, NOW)).toBeNull();
  });
});
