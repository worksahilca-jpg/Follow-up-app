/**
 * Audit 2026-09-16 L-3 (fixed 2026-09-26): routes echoed `err.message`
 * from whatever they caught — Prisma errors with the query and host,
 * OpenAI errors with the organisation id, Stripe errors quoting the key.
 * publicErrorMessage keeps our own sentences and replaces the rest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { publicErrorMessage } from "@/lib/publicError";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("publicErrorMessage", () => {
  it("passes our own short, user-facing message through unchanged", () => {
    expect(publicErrorMessage(new Error("That email couldn't be found in Gmail anymore."), "fallback")).toBe(
      "That email couldn't be found in Gmail anymore."
    );
  });

  it.each([
    ["a Prisma error", Object.assign(new Error("Invalid `prisma.lead.findMany()` invocation: Can't reach database server at `db.internal:5432`"), { name: "PrismaClientInitializationError" })],
    ["a Prisma known-request error", Object.assign(new Error("Unique constraint failed"), { name: "PrismaClientKnownRequestError", code: "P2002", clientVersion: "6.19.3" })],
    ["an OpenAI rate-limit error", new Error("429 Rate limit reached for gpt-4o-mini in organization org-AbCdEf123456 on tokens per min")],
    ["an SDK error carrying its HTTP response", Object.assign(new Error("Request failed"), { headers: {}, request_id: "req_1" })],
    ["a Stripe key error", new Error("Invalid API Key provided: sk_live_****************1234")],
    ["a network error", new Error("connect ECONNREFUSED 10.0.0.5:443")],
    ["a multi-line dump", new Error("Something failed\n    at handler (/var/task/.next/server/app.js:1:2)")],
    ["an overlong message", new Error("x".repeat(400))],
  ])("replaces %s with the fallback", (_label, err) => {
    expect(publicErrorMessage(err, "Couldn't do that — try again.")).toBe("Couldn't do that — try again.");
  });

  it("logs the original server-side when it hides it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("boom"), { name: "PrismaClientUnknownRequestError" });
    publicErrorMessage(err, "fallback", "leads/[id]/regenerate");
    expect(spy).toHaveBeenCalledWith("leads/[id]/regenerate:", err);
  });

  it("uses the fallback for a non-Error throw", () => {
    expect(publicErrorMessage("a string", "fallback")).toBe("fallback");
    expect(publicErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
