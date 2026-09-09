/**
 * task (sixth-pass audit, finding #2): sendEmail() built the raw RFC822
 * message by joining header lines with "\r\n" and interpolating
 * params.subject/to/inReplyTo directly, with nothing stripping an
 * embedded CRLF out of those values first. Lead.name has no such
 * stripping anywhere in the ingestion path (cleanedText only trims/caps),
 * and sendFollowUpToLead's own default subject
 * (`Following up on your inquiry, ${lead.name.split(" ")[0]}`) reproduces
 * a crafted name verbatim when it has no space before the first embedded
 * CRLF — so a fully unauthenticated embed-form submission could plant a
 * name like "X\r\nBcc:attacker@evil.com" that later breaks out into a
 * real, honored Bcc header on any email sent to that lead.
 */
import { describe, it, expect } from "vitest";
import { sanitizeHeaderValue } from "@/lib/integrations/gmail";

describe("sanitizeHeaderValue", () => {
  it("strips an embedded CRLF that would otherwise inject a new header", () => {
    const malicious = "X\r\nBcc:attacker@evil.com\r\nX-i:1";
    const sanitized = sanitizeHeaderValue(malicious);
    expect(sanitized).not.toMatch(/\r|\n/);
    expect(sanitized).not.toMatch(/^Bcc:/m); // no line in the result starts a Bcc header
  });

  it("strips a bare LF or CR alone, not just the CRLF pair", () => {
    expect(sanitizeHeaderValue("a\nBcc:x@evil.com")).not.toMatch(/[\r\n]/);
    expect(sanitizeHeaderValue("a\rBcc:x@evil.com")).not.toMatch(/[\r\n]/);
  });

  it("strips other control characters, not just CR/LF", () => {
    expect(sanitizeHeaderValue("a\x00\x0bb")).toBe("a b");
  });

  it("leaves an ordinary subject/name completely unchanged", () => {
    expect(sanitizeHeaderValue("Following up on your inquiry, Jamie")).toBe("Following up on your inquiry, Jamie");
    expect(sanitizeHeaderValue("Re: Your roof estimate")).toBe("Re: Your roof estimate");
  });

  it("trims incidental leading/trailing whitespace left after stripping", () => {
    expect(sanitizeHeaderValue("  Jamie Rivera  ")).toBe("Jamie Rivera");
  });
});
