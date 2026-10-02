/**
 * One definition of "the loser of a create race" for every claim-by-insert
 * (backlog b040). Six files carried their own copy; one of them required
 * Prisma's error class, which an extension-wrapped client need not throw.
 */
import { describe, it, expect } from "vitest";
import { isUniqueViolation } from "@/lib/uniqueViolation";

describe("isUniqueViolation", () => {
  it("recognises P2002 whether it is Prisma's class or a plain object carrying the code", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(new Error("connection reset"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});
