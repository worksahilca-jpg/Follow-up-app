/**
 * The shared request-validation helper every API route with a JSON body
 * now goes through (see src/lib/validation.ts) — one mechanism, so these
 * guarantees hold everywhere at once: a malformed body never reaches
 * route logic, and the failure is always a clean 400 with a readable
 * message, never a raw parse error or a 500 from downstream code
 * assuming a shape that was never actually there.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseJsonBody, parseObject, cleanedText } from "@/lib/validation";

function fakeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function fakeInvalidJsonRequest(): Request {
  return { json: async () => { throw new SyntaxError("Unexpected token"); } } as unknown as Request;
}

describe("parseJsonBody", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().optional() });

  it("returns the parsed, typed data for a valid body", async () => {
    const result = await parseJsonBody(fakeRequest({ name: "Priya", age: 30 }), schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: "Priya", age: 30 });
  });

  it("fails closed with a 400 when the body isn't valid JSON at all", async () => {
    const result = await parseJsonBody(fakeInvalidJsonRequest(), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = await result.response.json();
      expect(json.success).toBe(false);
      expect(typeof json.message).toBe("string");
    }
  });

  it("rejects a missing required field with a readable message naming it", async () => {
    const result = await parseJsonBody(fakeRequest({}), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const json = await result.response.json();
      expect(json.message).toMatch(/name/);
    }
  });

  it("rejects a wrongly-typed field instead of silently coercing it", async () => {
    const result = await parseJsonBody(fakeRequest({ name: "Priya", age: "thirty" }), schema);
    expect(result.ok).toBe(false);
  });

  it("rejects a body that isn't an object at all", async () => {
    const result = await parseJsonBody(fakeRequest("just a string"), schema);
    expect(result.ok).toBe(false);
  });
});

describe("parseObject", () => {
  it("validates a plain object the same way, for the form-encoded/JSON dual-parse routes", () => {
    const schema = z.object({ email: z.string() });
    const ok = parseObject({ email: "a@b.com" }, schema);
    expect(ok.ok).toBe(true);

    const bad = parseObject({ email: 5 }, schema);
    expect(bad.ok).toBe(false);
  });
});

describe("cleanedText", () => {
  const schema = z.object({ note: cleanedText(10) });

  it("trims and caps a real string instead of rejecting an overlong one", () => {
    const result = schema.parse({ note: "   this is way too long to keep   " });
    expect(result.note).toBe("this is wa");
  });

  it("degrades a non-string value to an empty string rather than failing", () => {
    expect(schema.parse({ note: 12345 }).note).toBe("");
    expect(schema.parse({ note: { nested: true } }).note).toBe("");
    expect(schema.parse({}).note).toBe("");
  });
});
