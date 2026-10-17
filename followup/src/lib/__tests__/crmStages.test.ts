/**
 * "When they book a meeting, move them to" (A-275): FollowUp moves a booked customer to the owner's chosen stage in
 * their CRM, on record, and picks the stage that reads like a meeting until the owner chooses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ conn: vi.fn(), write: vi.fn(), listStages: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { crmConnection: { findUnique: h.conn } } }));
vi.mock("@/lib/crm/writes", () => ({ writeToCrm: h.write }));

import { meetingStage, moveBookedLead, readStageWrite, stageWriteText, bookedStage } from "@/lib/crm/stages";
import { describeWrite } from "@/lib/crm/record";
import { followUpBossClient } from "@/lib/crm/followupboss";
import { hubspotClient } from "@/lib/crm/hubspot";
import { goHighLevelClient, packGhlKey } from "@/lib/crm/gohighlevel";
import { CRM_PROVIDERS } from "@/lib/crm";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("the stage that reads like a meeting", () => {
  it("is picked from the owner's own names", () => {
    expect(meetingStage([{ id: "Lead", name: "Lead" }, { id: "Appointment Set", name: "Appointment Set" }])?.name).toBe("Appointment Set");
    expect(meetingStage([{ id: "a", name: "New" }, { id: "b", name: "Showing booked" }])?.id).toBe("b");
    expect(meetingStage([{ id: "a", name: "New" }, { id: "b", name: "Hot" }])).toBeNull();
  });

  it("the owner's choice wins; \"Don't move them\" is none", async () => {
    const base = { provider: "followupboss", apiKey: "k" };
    expect(await bookedStage({ ...base, bookedStage: "Hot", bookedStageLabel: "Hot" })).toEqual({ id: "Hot", name: "Hot" });
    expect(await bookedStage({ ...base, bookedStage: "", bookedStageLabel: null })).toBeNull();
  });
});

describe("a stage write", () => {
  it("keeps where they go, and reads in the record as a move", () => {
    const text = stageWriteText({ stageId: "p1:s2", label: "Appointment Set", name: "Priya Shah" });
    expect(readStageWrite(text)).toEqual({ stageId: "p1:s2", label: "Appointment Set", name: "Priya Shah" });
    expect(readStageWrite("not json")).toBeNull();
    expect(describeWrite("stage", text, "Priya Shah")).toEqual({ title: "Moved Priya Shah to Appointment Set", quote: null });
  });
});

describe("after a booking", () => {
  const lead = { id: "lead1", businessId: "biz1", name: "Priya Shah", crmProvider: "followupboss", crmId: "77" };

  it("moves them to the owner's chosen stage, on record", async () => {
    h.conn.mockResolvedValue({ provider: "followupboss", apiKey: "k", bookedStage: "Appointment Set", bookedStageLabel: "Appointment Set" });
    await moveBookedLead(lead);
    expect(h.write).toHaveBeenCalledWith(expect.objectContaining({ kind: "stage", provider: "followupboss", crmId: "77" }));
    expect(readStageWrite(h.write.mock.calls[0][0].text)).toEqual({ stageId: "Appointment Set", label: "Appointment Set", name: "Priya Shah" });
  });

  it("not chosen yet: the stage that reads like a meeting", async () => {
    h.conn.mockResolvedValue({ provider: "followupboss", apiKey: "k", bookedStage: null, bookedStageLabel: null });
    const spy = vi.spyOn(CRM_PROVIDERS.followupboss.client, "listStages").mockResolvedValue([{ id: "Lead", name: "Lead" }, { id: "Appt", name: "Appointment" }]);
    await moveBookedLead(lead);
    expect(readStageWrite(h.write.mock.calls[0][0].text)?.stageId).toBe("Appt");
    spy.mockRestore();
  });

  it("\"Don't move them\", another CRM, or none: nothing is written", async () => {
    h.conn.mockResolvedValue({ provider: "followupboss", apiKey: "k", bookedStage: "", bookedStageLabel: null });
    await moveBookedLead(lead);
    h.conn.mockResolvedValue({ provider: "hubspot", apiKey: "k", bookedStage: "x", bookedStageLabel: "x" });
    await moveBookedLead(lead);
    await moveBookedLead({ ...lead, crmProvider: null, crmId: null });
    expect(h.write).not.toHaveBeenCalled();
  });
});

describe("each CRM's stages", () => {
  it("Follow Up Boss: lists by name, moves the person by name", async () => {
    fetchMock.mockResolvedValueOnce(json({ stages: [{ id: 1, name: "Lead" }, { id: 2, name: "Appointment Set" }] }));
    expect(await followUpBossClient.listStages("key")).toEqual([{ id: "Lead", name: "Lead" }, { id: "Appointment Set", name: "Appointment Set" }]);
    fetchMock.mockResolvedValueOnce(json({}));
    expect(await followUpBossClient.moveToStage("key", "77", "Appointment Set", "Priya")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.followupboss.com/v1/people/77");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ stage: "Appointment Set" });
  });

  it("HubSpot: the lead status options, set on the contact", async () => {
    fetchMock.mockResolvedValueOnce(json({ options: [{ label: "New", value: "NEW" }, { label: "Old", value: "OLD", hidden: true }, { label: "Connected", value: "CONNECTED" }] }));
    expect(await hubspotClient.listStages("tok")).toEqual([{ id: "NEW", name: "New" }, { id: "CONNECTED", name: "Connected" }]);
    fetchMock.mockResolvedValueOnce(json({}));
    await hubspotClient.moveToStage("tok", "9", "CONNECTED", "Priya");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/9");
    expect(JSON.parse(init.body)).toEqual({ properties: { hs_lead_status: "CONNECTED" } });
  });

  it("GoHighLevel: pipeline stages; their opportunity moves, or one is made", async () => {
    const KEY = packGhlKey("loc123ABC", "pit-0000-1111-2222");
    fetchMock.mockResolvedValueOnce(json({ pipelines: [{ id: "p1", name: "Buyers", stages: [{ id: "s1", name: "New" }, { id: "s2", name: "Appointment booked" }] }] }));
    expect(await goHighLevelClient.listStages(KEY)).toEqual([{ id: "p1:s1", name: "New" }, { id: "p1:s2", name: "Appointment booked" }]);

    fetchMock.mockResolvedValueOnce(json({ opportunities: [{ id: "opp9" }] })).mockResolvedValueOnce(json({}));
    expect(await goHighLevelClient.moveToStage(KEY, "c1", "p1:s2", "Priya Shah")).toEqual({ ok: true });
    expect(fetchMock.mock.calls[2][0]).toBe("https://services.leadconnectorhq.com/opportunities/opp9");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ pipelineId: "p1", pipelineStageId: "s2" });

    fetchMock.mockResolvedValueOnce(json({ opportunities: [] })).mockResolvedValueOnce(json({}));
    await goHighLevelClient.moveToStage(KEY, "c1", "p1:s2", "Priya Shah");
    expect(fetchMock.mock.calls[4][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toMatchObject({ pipelineId: "p1", pipelineStageId: "s2", contactId: "c1", name: "Priya Shah", status: "open" });
  });

  it("a CRM that can't say lists nothing", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    expect(await followUpBossClient.listStages("key")).toEqual([]);
    expect(await hubspotClient.listStages("tok")).toEqual([]);
  });
});
