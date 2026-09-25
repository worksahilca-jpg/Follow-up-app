/**
 * WhatsApp on the owner's own number (Meta Cloud API, Coexistence) — what
 * happens to each kind of webhook change once the envelope is trusted.
 * Signature handling is metaWebhookSignature.test.ts's job; the durability
 * envelope is inboundWebhookDurability.test.ts's. This file pins the
 * processor (src/lib/inbound/whatsappCloud.ts):
 *
 *  1. a customer's message becomes a lead keyed on the same phone identity
 *     an SMS would use, is stored once (wamid), acknowledged and scored;
 *  2. STOP sets Lead.optedOutAt and gets no acknowledgement;
 *  3. the owner's reply from their phone (an echo) is a real outbound
 *     message, never a lead message;
 *  4. a delivery status lands on the outbound row, scoped to the business;
 *  5. the history sync captures recent threads and nothing else: no
 *     acknowledgement, no drafts, no source routing, and threads older
 *     than the cutoff are skipped;
 *  6. someone who is not a lead yet is judged before becoming one — the
 *     owner's own number carries their private life (2026-09-25). A chat
 *     set aside keeps its messages, is judged again when it says more,
 *     and becomes a lead with its history the moment it looks like work.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  businessFindUnique,
  leadUpdate,
  leadUpdateMany,
  leadFindFirst,
  leadCreate,
  messageUpdateMany,
  messageUpsert,
  filteredFindUnique,
  filteredUpsert,
  filteredDeleteMany,
} = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadUpdate: vi.fn(async () => ({})),
  leadUpdateMany: vi.fn(async () => ({ count: 1 })),
  leadFindFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
  leadCreate: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "lead-hist", ...args.data })),
  messageUpdateMany: vi.fn(async () => ({ count: 1 })),
  messageUpsert: vi.fn(async () => ({})),
  filteredFindUnique: vi.fn(async (): Promise<{ id: string; threadPayload: unknown } | null> => null),
  filteredUpsert: vi.fn(async () => ({})),
  filteredDeleteMany: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    lead: { update: leadUpdate, updateMany: leadUpdateMany, findFirst: leadFindFirst, create: leadCreate },
    message: { updateMany: messageUpdateMany, upsert: messageUpsert },
    filteredEmail: { findUnique: filteredFindUnique, upsert: filteredUpsert, deleteMany: filteredDeleteMany },
  },
}));

// The one judge every channel shares. Says "customer" unless a test says
// otherwise, so the flows above the gate run as they always did.
const { classifyAsProspect } = vi.hoisted(() => ({
  classifyAsProspect: vi.fn(async (): Promise<{ isProspect: boolean; reason: string }> => ({ isProspect: true, reason: "asks about work" })),
}));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect }));

// Per-chat re-judge cap (security pass 2026-09-25 F2): under it unless a test says otherwise.
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

const { findOrCreateLeadByPhone } = vi.hoisted(() => ({
  findOrCreateLeadByPhone: vi.fn(async () => ({ id: "lead-wa", name: "Priya", assignedToId: null })),
}));
vi.mock("@/lib/twilio", () => ({ findOrCreateLeadByPhone }));

const { createInboundMessageIfNew, captureDirectReply } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn(async () => true),
  captureDirectReply: vi.fn(async () => {}),
}));
vi.mock("@/lib/instagram", () => ({ createInboundMessageIfNew, captureDirectReply }));

const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
const { applySourceRouting } = vi.hoisted(() => ({ applySourceRouting: vi.fn(async () => {}) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv-wa" })) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));

import { HISTORY_IMPORT_MAX_AGE_DAYS, processWhatsAppCloudEnvelope, whatsappMessageContent } from "@/lib/inbound/whatsappCloud";

const PHONE_NUMBER_ID = "104567890123456";
const CUSTOMER = "14165550100";
const nowSeconds = () => String(Math.floor(Date.now() / 1000));

function envelope(field: string, value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [{ field, value: { messaging_product: "whatsapp", metadata: { display_phone_number: "+1 416-555-0199", phone_number_id: PHONE_NUMBER_ID }, ...value } }],
      },
    ],
  };
}

function customerText(text: string, id = "wamid.1") {
  return envelope("messages", {
    contacts: [{ profile: { name: "Priya" }, wa_id: CUSTOMER }],
    messages: [{ from: CUSTOMER, id, timestamp: nowSeconds(), type: "text", text: { body: text } }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // A paying business, so AI may run for it.
  businessFindUnique.mockResolvedValue({ id: "biz1", name: "Condo Co", industry: "real estate", tier: "pro", subscriptionStatus: "active" });
  createInboundMessageIfNew.mockResolvedValue(true);
  leadFindFirst.mockResolvedValue(null);
  filteredFindUnique.mockResolvedValue(null);
  tooManyRecentActions.mockResolvedValue(false);
  classifyAsProspect.mockResolvedValue({ isProspect: true, reason: "asks about work" });
});

describe("a customer's WhatsApp message", () => {
  it("becomes a lead on the phone identity, stored once, acknowledged and scored", async () => {
    await processWhatsAppCloudEnvelope(customerText("Hi, do you do kitchens?"));

    expect(businessFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { whatsappPhoneNumberId: PHONE_NUMBER_ID } }));
    // "+" + wa_id, with the profile name — one person, one lead, whether they SMS or WhatsApp.
    expect(findOrCreateLeadByPhone).toHaveBeenCalledWith("biz1", `+${CUSTOMER}`, "WhatsApp", "Priya");
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv-wa", "Hi, do you do kitchens?", expect.any(Date), "wamid.1");
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead-wa", expect.objectContaining({ channel: "whatsapp", inboundText: "Hi, do you do kitchens?" }));
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead-wa");
  });

  it("does nothing more for a redelivered message", async () => {
    createInboundMessageIfNew.mockResolvedValueOnce(false);
    await processWhatsAppCloudEnvelope(customerText("again", "wamid.dup"));
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("ignores a number no business here has connected", async () => {
    businessFindUnique.mockResolvedValueOnce(null);
    await processWhatsAppCloudEnvelope(customerText("hello"));
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
  });

  it("records STOP on the lead and sends no acknowledgement", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead-wa" });
    await processWhatsAppCloudEnvelope(customerText("STOP"));
    expect(leadUpdate).toHaveBeenCalledWith({ where: { id: "lead-wa" }, data: { optedOutAt: expect.any(Date) } });
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("stores a photo with no caption as a message but acknowledges only what they typed", async () => {
    await processWhatsAppCloudEnvelope(
      envelope("messages", {
        messages: [{ from: CUSTOMER, id: "wamid.img", timestamp: nowSeconds(), type: "image", image: { id: "m1", mime_type: "image/jpeg" } }],
      })
    );
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv-wa", "[Sent a image with no message text]", expect.any(Date), "wamid.img");
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead-wa", expect.objectContaining({ inboundText: "" }));
  });
});

describe("the owner's reply from their phone (echo)", () => {
  it("is captured as an outbound message, not treated as a lead message", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead-wa" });
    await processWhatsAppCloudEnvelope(
      envelope("smb_message_echoes", {
        message_echoes: [{ from: "14165550199", to: CUSTOMER, id: "wamid.echo", timestamp: nowSeconds(), type: "text", text: { body: "Yes we do — when suits?" } }],
      })
    );
    expect(captureDirectReply).toHaveBeenCalledWith("lead-wa", "whatsapp", "Yes we do — when suits?", "whatsapp_direct", "wamid.echo", expect.any(Date));
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });
});

describe("someone who isn't a lead yet (the owner's own number)", () => {
  const personal = { isProspect: false, reason: "Family chat about dinner plans" };
  const earlier = new Date(Date.now() - 60 * 60_000).toISOString();
  const keptThread = (messages: { id: string; direction: "inbound" | "outbound"; body: string; date: string }[]) => ({
    id: "filtered-1",
    threadPayload: { phone: `+${CUSTOMER}`, name: "Priya", messages },
  });

  it("is set aside when the chat is personal: no lead, no acknowledgement, no draft — but the message is kept", async () => {
    classifyAsProspect.mockResolvedValue(personal);
    await processWhatsAppCloudEnvelope(customerText("Dinner at 8 tonight?", "wamid.p1"));

    // Two looks before anything is set aside (stage 2 only on a no).
    expect(classifyAsProspect).toHaveBeenCalledTimes(2);
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
    expect(filteredUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId_threadId: { businessId: "biz1", threadId: `whatsapp:${CUSTOMER}` } },
        create: expect.objectContaining({
          provider: "whatsapp",
          senderPhone: `+${CUSTOMER}`,
          reason: personal.reason,
          threadPayload: expect.objectContaining({ messages: [expect.objectContaining({ id: "wamid.p1", direction: "inbound", body: "Dinner at 8 tonight?" })] }),
        }),
      })
    );
  });

  it("never judges a number that is already a lead", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead-wa" });
    await processWhatsAppCloudEnvelope(customerText("Any update on the quote?"));
    expect(classifyAsProspect).not.toHaveBeenCalled();
    expect(findOrCreateLeadByPhone).toHaveBeenCalled();
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead-wa");
  });

  it("becomes a lead, with the whole set-aside chat, the moment it turns into work", async () => {
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(customerText("Also, can you look at my basement?", "wamid.p2"));

    // Judged on the kept chat plus the new message, not the new message alone.
    const [thread] = classifyAsProspect.mock.calls[0] as unknown as [{ id: string }[]];
    expect(thread.map((m) => m.id)).toEqual(["wamid.p1", "wamid.p2"]);

    expect(findOrCreateLeadByPhone).toHaveBeenCalledWith("biz1", `+${CUSTOMER}`, "WhatsApp", "Priya");
    expect(messageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalId: "wamid.p1" }, create: expect.objectContaining({ direction: "inbound", body: "Happy Diwali!" }) })
    );
    expect(filteredDeleteMany).toHaveBeenCalledWith({ where: { id: "filtered-1", businessId: "biz1" } });
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv-wa", "Also, can you look at my basement?", expect.any(Date), "wamid.p2");
    expect(acknowledgeNewLead).toHaveBeenCalled();
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead-wa");
  });

  it("stays set aside, with the new message added, while it is still personal", async () => {
    classifyAsProspect.mockResolvedValue(personal);
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(customerText("Say hi to mom", "wamid.p2"));

    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(filteredDeleteMany).not.toHaveBeenCalled();
    expect(filteredUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          reason: personal.reason,
          threadPayload: expect.objectContaining({ messages: [expect.objectContaining({ id: "wamid.p1" }), expect.objectContaining({ id: "wamid.p2" })] }),
        }),
      })
    );
  });

  it("spends nothing on a redelivery of a message already set aside", async () => {
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(customerText("Happy Diwali!", "wamid.p1"));
    expect(classifyAsProspect).not.toHaveBeenCalled();
    expect(filteredUpsert).not.toHaveBeenCalled();
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
  });

  it("keeps a photo in a set-aside chat without judging it again", async () => {
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(
      envelope("messages", {
        messages: [{ from: CUSTOMER, id: "wamid.img2", timestamp: nowSeconds(), type: "image", image: { id: "m2", mime_type: "image/jpeg" } }],
      })
    );
    expect(classifyAsProspect).not.toHaveBeenCalled();
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(filteredUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ threadPayload: expect.objectContaining({ messages: [expect.anything(), expect.objectContaining({ id: "wamid.img2" })] }) }),
      })
    );
  });

  it("lets the message through when the judge fails — a lost customer is the worse mistake", async () => {
    classifyAsProspect.mockRejectedValue(new Error("OpenAI down"));
    await processWhatsAppCloudEnvelope(customerText("Hi, quote for a deck?"));
    expect(findOrCreateLeadByPhone).toHaveBeenCalled();
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead-wa");
    expect(filteredUpsert).not.toHaveBeenCalled();
  });

  it("looks again with the full read only, once, when a set-aside chat says more", async () => {
    classifyAsProspect.mockResolvedValue(personal);
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(customerText("Say hi to mom", "wamid.p2"));
    // Stage 1 re-reads an opening that already said no: skipped.
    expect(classifyAsProspect).toHaveBeenCalledTimes(1);
  });

  it("keeps the message but spends nothing once a chat passes its hourly cap", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(customerText("spam spam spam", "wamid.p9"));
    expect(tooManyRecentActions).toHaveBeenCalledWith("biz1", `whatsapp_rejudge:${CUSTOMER}`, expect.objectContaining({ windowMinutes: 60 }));
    expect(classifyAsProspect).not.toHaveBeenCalled();
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(filteredUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ threadPayload: expect.objectContaining({ messages: [expect.anything(), expect.objectContaining({ id: "wamid.p9" })] }) }) })
    );
  });

  it("spends no AI for a Free business (WhatsApp isn't on the Free plan): someone new is captured as before", async () => {
    businessFindUnique.mockResolvedValue({ id: "biz1", name: "Condo Co", industry: null, tier: "free", subscriptionStatus: null });
    await processWhatsAppCloudEnvelope(customerText("Dinner at 8?", "wamid.f1"));
    expect(classifyAsProspect).not.toHaveBeenCalled();
    expect(findOrCreateLeadByPhone).toHaveBeenCalled();
  });

  it("spends no AI for a lapsed business, and a set-aside chat stays set aside", async () => {
    businessFindUnique.mockResolvedValue({ id: "biz1", name: "Condo Co", industry: null, tier: "pro", subscriptionStatus: "canceled" });
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "Happy Diwali!", date: earlier }]));
    await processWhatsAppCloudEnvelope(customerText("Say hi to mom", "wamid.l2"));
    expect(classifyAsProspect).not.toHaveBeenCalled();
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(filteredUpsert).toHaveBeenCalled();
  });

  it("sets aside the owner's own message to someone new when it is personal", async () => {
    classifyAsProspect.mockResolvedValue(personal);
    await processWhatsAppCloudEnvelope(
      envelope("smb_message_echoes", {
        message_echoes: [{ from: "14165550199", to: CUSTOMER, id: "wamid.e1", timestamp: nowSeconds(), type: "text", text: { body: "Reached home, call you later" } }],
      })
    );
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(captureDirectReply).not.toHaveBeenCalled();
    expect(filteredUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ threadPayload: expect.objectContaining({ messages: [expect.objectContaining({ id: "wamid.e1", direction: "outbound" })] }) }),
      })
    );
  });

  it("makes a lead when the owner sends a set-aside contact a quote", async () => {
    filteredFindUnique.mockResolvedValue(keptThread([{ id: "wamid.p1", direction: "inbound", body: "hey", date: earlier }]));
    await processWhatsAppCloudEnvelope(
      envelope("smb_message_echoes", {
        message_echoes: [{ from: "14165550199", to: CUSTOMER, id: "wamid.e2", timestamp: nowSeconds(), type: "text", text: { body: "$2,400 for the deck, I can start Tuesday" } }],
      })
    );
    expect(findOrCreateLeadByPhone).toHaveBeenCalledWith("biz1", `+${CUSTOMER}`, "WhatsApp", undefined);
    expect(messageUpsert).toHaveBeenCalledWith(expect.objectContaining({ where: { externalId: "wamid.p1" } }));
    expect(filteredDeleteMany).toHaveBeenCalledWith({ where: { id: "filtered-1", businessId: "biz1" } });
    expect(captureDirectReply).toHaveBeenCalledWith("lead-wa", "whatsapp", "$2,400 for the deck, I can start Tuesday", "whatsapp_direct", "wamid.e2", expect.any(Date));
  });
});

describe("a delivery status", () => {
  it("lands on the outbound row, scoped to the business", async () => {
    await processWhatsAppCloudEnvelope(
      envelope("messages", {
        statuses: [{ id: "wamid.out1", status: "failed", timestamp: nowSeconds(), recipient_id: CUSTOMER, errors: [{ code: 131026, title: "Message undeliverable" }] }],
      })
    );
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { externalId: "wamid.out1", conversation: { lead: { businessId: "biz1" } } },
      data: expect.objectContaining({ deliveryStatus: "failed", deliveryErrorCode: "131026", deliveryErrorMessage: "Message undeliverable" }),
    });
  });
});

describe("the history sync", () => {
  const day = 24 * 60 * 60;
  const recent = Math.floor(Date.now() / 1000) - 2 * day;
  const stale = Math.floor(Date.now() / 1000) - (HISTORY_IMPORT_MAX_AGE_DAYS + 5) * day;

  it("captures a recent thread with the owner's messages marked as theirs, and wakes nothing up", async () => {
    await processWhatsAppCloudEnvelope(
      envelope("history", {
        contacts: [{ profile: { name: "Priya" }, wa_id: CUSTOMER }],
        history: [
          {
            metadata: { phase: 0, chunk_order: 1, progress: 100 },
            threads: [
              {
                id: CUSTOMER,
                messages: [
                  { from: CUSTOMER, id: "wamid.h1", timestamp: String(recent - 60), type: "text", text: { body: "Do you do kitchens?" } },
                  { from: "14165550199", id: "wamid.h2", timestamp: String(recent), type: "text", text: { body: "Yes — Tuesday?" } },
                ],
              },
            ],
          },
        ],
      })
    );

    expect(leadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessId: "biz1", phone: `+${CUSTOMER}`, name: "Priya", source: "WhatsApp", lastContacted: new Date(recent * 1000) }),
    });
    expect(messageUpsert).toHaveBeenCalledTimes(2);
    expect(messageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalId: "wamid.h1" }, create: expect.objectContaining({ direction: "inbound", body: "Do you do kitchens?" }) })
    );
    expect(messageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalId: "wamid.h2" }, create: expect.objectContaining({ direction: "outbound", source: "whatsapp_direct" }) })
    );
    // Capture only.
    expect(findOrCreateLeadByPhone).not.toHaveBeenCalled();
    expect(applySourceRouting).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("skips a thread whose newest message is older than the cutoff", async () => {
    await processWhatsAppCloudEnvelope(
      envelope("history", {
        history: [{ threads: [{ id: CUSTOMER, messages: [{ from: CUSTOMER, id: "wamid.old", timestamp: String(stale), type: "text", text: { body: "hi" } }] }] }],
      })
    );
    expect(leadCreate).not.toHaveBeenCalled();
    expect(messageUpsert).not.toHaveBeenCalled();
  });
});

describe("whatsappMessageContent", () => {
  it("reads text, buttons and interactive replies as the person's own words", () => {
    expect(whatsappMessageContent({ type: "text", text: { body: " hello " } })).toEqual({ body: "hello", ownWords: "hello" });
    expect(whatsappMessageContent({ type: "button", button: { text: "Yes please" } })).toEqual({ body: "Yes please", ownWords: "Yes please" });
    expect(whatsappMessageContent({ type: "interactive", interactive: { button_reply: { id: "a", title: "This week" } } })).toEqual({ body: "This week", ownWords: "This week" });
  });
  it("keeps a caption as their words and ignores reactions", () => {
    expect(whatsappMessageContent({ type: "image", image: { caption: "my roof" } })).toEqual({ body: "my roof", ownWords: "my roof" });
    expect(whatsappMessageContent({ type: "reaction", reaction: { emoji: "👍" } })).toBeNull();
  });
});
