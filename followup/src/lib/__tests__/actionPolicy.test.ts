/**
 * The written list of what FollowUp may do and who has to allow it (src/lib/actionPolicy.ts, milestone 1). These
 * tests hold the brief's promises: nothing a customer sees goes out alone while every reply waits; booking never goes
 * out alone in any mode; stopping is never blocked; a more trusting mode never adds a step, and never skips one the
 * list keeps for the owner; and every place FollowUp sends by itself obeys the owner's "ask me first".
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import {
  ACTION_POLICY,
  ALWAYS_CHECKED,
  ASSISTANT_ACTIONS,
  AUTOMATIC_SENDERS,
  needsOwner,
  operatingModeOf,
  OPERATING_MODES,
} from "@/lib/actionPolicy";

const root = join(__dirname, "..", "..", "..");

describe("the three ways of working", () => {
  it("holding every reply is draft only, whatever else is on", () => {
    expect(operatingModeOf({ holdAllForApproval: true, autonomousAllowed: false })).toBe("draft_only");
    expect(operatingModeOf({ holdAllForApproval: true, autonomousAllowed: true })).toBe("draft_only");
  });

  it("sending by itself is assisted automation, and Auto allowed on top of it is controlled autonomy", () => {
    expect(operatingModeOf({ holdAllForApproval: false, autonomousAllowed: false })).toBe("assisted_automation");
    expect(operatingModeOf({ holdAllForApproval: false, autonomousAllowed: true })).toBe("controlled_autonomy");
  });
});

describe("the action list", () => {
  it("covers every action in the brief, each with a rule for every mode", () => {
    expect(Object.keys(ACTION_POLICY).sort()).toEqual([...ASSISTANT_ACTIONS].sort());
    for (const action of ASSISTANT_ACTIONS) {
      for (const mode of OPERATING_MODES) expect(["alone", "owner_ok"]).toContain(ACTION_POLICY[action].permission[mode]);
    }
  });

  it("while every reply waits, nothing a customer would see goes out alone", () => {
    for (const action of ASSISTANT_ACTIONS) {
      if (ACTION_POLICY[action].customerSees) expect(needsOwner(action, "draft_only"), action).toBe(true);
    }
  });

  it("offering, confirming and creating a booking wait for the owner in every mode", () => {
    for (const action of ["OFFER_APPOINTMENT", "CONFIRM_BOOKING", "CREATE_BOOKING"] as const) {
      for (const mode of OPERATING_MODES) expect(needsOwner(action, mode), `${action} in ${mode}`).toBe(true);
    }
  });

  it("stopping, waiting, telling the owner and handing over never wait for anyone", () => {
    for (const action of ["STOP_AUTOMATION", "WAIT_FOR_CUSTOMER", "NOTIFY_OWNER", "ESCALATE_TO_HUMAN"] as const) {
      for (const mode of OPERATING_MODES) expect(needsOwner(action, mode), `${action} in ${mode}`).toBe(false);
      expect(ACTION_POLICY[action].customerSees).toBe(false);
    }
  });

  it("a more trusting mode never adds a step the owner didn't have before", () => {
    for (const action of ASSISTANT_ACTIONS) {
      const [draft, assisted, autonomy] = OPERATING_MODES.map((m) => needsOwner(action, m));
      if (!draft) expect(assisted, action).toBe(false);
      if (!assisted) expect(autonomy, action).toBe(false);
    }
  });

  it("names the checks no mode relaxes, each with the code that enforces it, and that code exists", () => {
    expect(ALWAYS_CHECKED.map((c) => c.id)).toEqual(["opt_out", "never_twice", "send_caps", "real_person", "pause"]);
    for (const check of ALWAYS_CHECKED) {
      for (const file of check.where.match(/src\/lib\/[\w./]+\.ts/g) ?? []) expect(() => statSync(join(root, file)), file).not.toThrow();
    }
  });

  it("every 'today' it names points at code that exists", () => {
    for (const action of ASSISTANT_ACTIONS) {
      for (const file of ACTION_POLICY[action].today?.match(/src\/lib\/[\w./]+\.ts/g) ?? []) {
        expect(() => statSync(join(root, file)), `${action}: ${file}`).not.toThrow();
      }
    }
  });
});

/** Every non-test .ts file under src/lib. */
function libFiles(dir = join(root, "src", "lib")): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : libFiles(full);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [full] : [];
  });
}

/** Files with a sendFollowUpToLead( call whose options say automated: true. */
function automaticSendersInCode(): string[] {
  const found: string[] = [];
  for (const file of libFiles()) {
    const text = readFileSync(file, "utf8");
    const calls = text.split("sendFollowUpToLead(").slice(1);
    // The options object follows the call within a few lines; stop at the next call.
    if (calls.some((after) => /automated:\s*true/.test(after.slice(0, 600)))) found.push(relative(root, file));
  }
  return found.sort();
}

describe("every place FollowUp sends by itself", () => {
  it("is on the written list, and the list has nothing that no longer sends", () => {
    expect(automaticSendersInCode()).toEqual(AUTOMATIC_SENDERS.map((s) => s.file).sort());
  });

  it("obeys the owner's 'ask me before every message', unless the owner approved that batch itself", () => {
    for (const sender of AUTOMATIC_SENDERS) {
      if (sender.ownerApprovedBatch) continue;
      const text = readFileSync(join(root, sender.file), "utf8");
      expect(text, `${sender.file} must read Business.holdAllForApproval`).toMatch(/holdAllForApproval/);
    }
  });
});
