import { describe, it, expect } from "vitest";
import {
  businessValue,
  fromLine,
  normalizeWebsite,
  pageText,
  pagesWorthReading,
  postsText,
  readLine,
  readSiteNote,
  setupReadLine,
  siteName,
  sourceOf,
} from "@/lib/siteRead";
import { parseTellDraft, siteAfterOwnLines, withSources, type PlaybackRow } from "@/lib/tellFollowUp";

describe("normalizeWebsite: what owners type (A-328)", () => {
  it("adds https to a bare name and keeps the path", () => {
    expect(normalizeWebsite("mysite.ca")).toBe("https://mysite.ca/");
    expect(normalizeWebsite(" www.mysite.ca/about ")).toBe("https://www.mysite.ca/about");
    expect(normalizeWebsite("http://mysite.ca#top")).toBe("http://mysite.ca/");
  });
  it("refuses anything that isn't a public web address", () => {
    for (const bad of ["", "my site", "localhost", "ftp://mysite.ca", "javascript:alert(1)", "https://user:pw@mysite.ca", "mysite", ".ca", "x".repeat(201) + ".ca"]) {
      expect(normalizeWebsite(bad)).toBeNull();
    }
  });
  it("names the site as people say it", () => {
    expect(siteName("https://www.mysite.ca/about")).toBe("mysite.ca");
  });
});

describe("pageText: a page as a visitor reads it", () => {
  const html = `<html><head><title>Bright Homes | Realtor</title><meta name="description" content="Buying and selling in Mississauga"><style>.x{}</style></head>
    <body><nav>Home</nav><script>var secret = 1;</script><h1>Sell with us</h1><p>Commission is 2.5% &amp; covers photos.</p>
    <p>Weekdays 10&nbsp;am to 7 pm</p><nav>Home</nav><!-- hidden --></body></html>`;
  it("keeps the title, description and words, drops scripts, styles and comments", () => {
    const t = pageText(html);
    expect(t).toContain("Bright Homes | Realtor");
    expect(t).toContain("Buying and selling in Mississauga");
    expect(t).toContain("Commission is 2.5% & covers photos.");
    expect(t).toContain("Weekdays 10 am to 7 pm");
    expect(t).not.toContain("secret");
    expect(t).not.toContain(".x{}");
    expect(t).not.toContain("hidden");
  });
  it("costs no more on a hostile page: thousands of unclosed tags are read in linear time", () => {
    const half = 256 * 1024;
    for (const piece of ["<script", "<!--", "<a href='x", "<title", "<meta name='description' content='", "<p", "&amp"]) {
      const html = "<p>Open weekdays</p>" + piece.repeat(Math.ceil(half / piece.length));
      const started = performance.now();
      pageText(html);
      pagesWorthReading(html, "https://mysite.ca/");
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });
  it("still reads what's before a block left open", () => {
    expect(pageText("<p>Open weekdays</p><script>never closed")).toBe("Open weekdays");
  });
  it("says a repeated line once", () => {
    expect(pageText(html).split("\n").filter((l) => l === "Home")).toHaveLength(1);
  });
});

describe("pagesWorthReading: only the same site, only pages customers ask about", () => {
  const html = `<a href="/about-us">About</a><a href="https://www.mysite.ca/services">Services</a><a href="https://other.ca/pricing">Other</a>
    <a href="/brochure.pdf">PDF</a><a href="mailto:a@b.ca">Mail</a><a href="/blog/post-1">Blog</a><a href="/contact?x=1">Contact</a><a href="/">Home</a>`;
  it("keeps same-site pages by what their address says, best first", () => {
    expect(pagesWorthReading(html, "https://mysite.ca/")).toEqual([
      "https://www.mysite.ca/services",
      "https://mysite.ca/about-us",
      "https://mysite.ca/contact",
    ]);
  });
  it("never more than asked", () => {
    expect(pagesWorthReading(html, "https://mysite.ca/", 1)).toHaveLength(1);
  });
});

describe("what may stand as a fact, and where it came from", () => {
  it("drops a person's handle or an email address", () => {
    expect(businessValue("Congrats @maria on your new home")).toBe(false);
    expect(businessValue("Email us at hello@mysite.ca")).toBe(false);
    expect(businessValue("Weekdays 10 am to 7 pm")).toBe(true);
  });
  it("says website when the words are on the site, else Instagram", () => {
    expect(sourceOf("10 am to 7 pm", "Weekdays 10  am to 7 pm")).toBe("website");
    expect(sourceOf("English and Punjabi", "Weekdays")).toBe("instagram");
  });
  it("reads the bio first, then the newest posts", () => {
    expect(postsText("Realtor in Brampton", ["Just sold!", "", "Open house Sunday"])).toBe("Realtor in Brampton\nJust sold!\nOpen house Sunday");
  });
});

describe("the lines on screen", () => {
  const note = { url: "https://www.mysite.ca/", pages: ["a", "b", "c", "d", "e", "f"], posts: 30 };
  it("after reading: what was read and how many are left", () => {
    expect(readLine(note, 6, 9, 3)).toBe("Read 6 pages of mysite.ca and your last 30 Instagram posts. They answered 6 of the 9 questions, so 3 are left. You check all of it at the end.");
    expect(readLine({ url: null, pages: [], posts: 1 }, 1, 9, 1)).toBe("Read your last 1 Instagram post. It answered 1 of the 9 questions, so 1 is left. You check all of it at the end.");
    expect(readLine(note, 0, 9, 9)).toContain("It didn't answer any of the questions");
    expect(readLine(note, 9, 9, 0)).toContain("nothing left to ask");
  });
  it("on setup's waiting screen: what it saves the owner, no count of what's left", () => {
    expect(setupReadLine(note, 6)).toBe("Read 6 pages of mysite.ca and your last 30 Instagram posts. That's 6 questions FollowUp won't need to ask you. You check what it found before it's ever used.");
    expect(setupReadLine({ url: "https://mysite.ca/", pages: ["a"], posts: 0 }, 1)).toContain("That's 1 question FollowUp");
    expect(setupReadLine(note, 0)).toContain("It didn't answer FollowUp's questions, so it asks you later.");
  });
  it("on the play-back: where it all came from", () => {
    expect(fromLine(note, 3)).toBe("From mysite.ca (6 pages), 30 Instagram posts and your 3 answers");
    expect(fromLine({ url: "https://mysite.ca/", pages: ["a"], posts: 0 }, 0)).toBe("From mysite.ca (1 page)");
  });
});

describe("the read kept with the meeting's draft", () => {
  it("is checked again when it comes back from the database", () => {
    expect(readSiteNote({ url: "mysite.ca", pages: ["https://mysite.ca/"], posts: 99, from: { hours: "website", x: "email" } })).toEqual({
      url: "https://mysite.ca/",
      pages: ["https://mysite.ca/"],
      posts: 30,
      from: { hours: "website" },
    });
    expect(readSiteNote({ url: "not a site", posts: 0 })).toBeNull();
    expect(parseTellDraft({ rows: [{ label: "Hours", value: "9 to 6" }], site: { url: "mysite.ca", pages: [], posts: 0, from: { hours: "website" } } }).site?.from).toEqual({ hours: "website" });
  });
  it("marks each new line with where it came from, and the owner's own lines as said", () => {
    const rows: PlaybackRow[] = [
      { label: "Hours", value: "9 to 6", fresh: true },
      { label: "Payment", value: "Half up front", fresh: true },
      { label: "Prices", value: "From $950", fresh: false },
    ];
    const marked = withSources(rows, { url: "https://mysite.ca/", pages: [], posts: 0, from: { hours: "website" } });
    expect(marked.map((r) => r.from)).toEqual(["website", "said", undefined]);
    // Nothing read: no sources at all, the play-back as it was before A-328.
    expect(withSources(rows, null)).toEqual(rows);
  });
  it("a line the owner answers since is theirs, not the website's", () => {
    const site = { url: "https://mysite.ca/", pages: [], posts: 0, from: { hours: "website" as const, languages: "instagram" as const } };
    expect(siteAfterOwnLines(site, [{ label: "Hours", value: "Mon to Fri" }])?.from).toEqual({ languages: "instagram" });
    expect(siteAfterOwnLines(undefined, [{ label: "Hours", value: "x" }])).toBeUndefined();
  });
});
