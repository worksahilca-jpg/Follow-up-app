// The robot tester: clicks through a LOCAL copy of FollowUp like an owner
// would, and reports anything broken. Never points at production.
//
// Run from followup/ with the local env loaded and `next dev -p 3111` up:
//   node scripts/robot/robot.mjs
// See scripts/robot/README.md.
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { writeFileSync } from "node:fs";

const BASE = process.env.ROBOT_BASE_URL ?? "http://localhost:3111";
const PLAYWRIGHT = process.env.ROBOT_PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROME = process.env.ROBOT_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = process.env.ROBOT_OUT ?? "robot-report.json";

if (!process.env.DATABASE_URL?.includes("localhost")) throw new Error("refusing: the robot only runs against a local database");
if (!/^http:\/\/localhost[:/]/.test(BASE)) throw new Error("refusing: the robot only runs against localhost");

const { chromium } = await import(PLAYWRIGHT);
const prisma = new PrismaClient();
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 300) });

// --- A fresh fake business for every run -----------------------------------
const stamp = Date.now();
const biz = await prisma.business.create({
  data: { name: `Robot Realty ${stamp}`, industry: "Real estate", onboarded: true, subscriptionStatus: "beta", tier: "pro" },
});
const ownerEmail = `robot-owner-${stamp}@example.com`;
const owner = await prisma.user.create({ data: { email: ownerEmail, name: "Robot Owner", businessId: biz.id, role: "ADMIN" } });
const cookie = await encode({
  token: { email: ownerEmail, name: "Robot Owner", sub: owner.id, userId: owner.id, businessId: biz.id, checkedAt: Date.now(), authTime: Date.now() },
  secret: process.env.NEXTAUTH_SECRET,
  maxAge: 3600,
});

// --- 1. A customer writes in through the website form ----------------------
const customerEmail = `robot-customer-${stamp}@example.com`;
try {
  const res = await fetch(`${BASE}/api/embed/${biz.id}/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hp: "", name: "Maya Robot", email: customerEmail, phone: "", message: "Hi, is the 2-bedroom on Maple Street still available? Could I see it this week?" }),
  });
  const body = await res.json().catch(() => ({}));
  check("Website form accepts a customer", res.ok && body.success, `HTTP ${res.status}`);
} catch (err) {
  check("Website form accepts a customer", false, err.message);
}
const lead = await prisma.lead.findFirst({ where: { businessId: biz.id, email: customerEmail } });
check("The customer is saved as a lead", lead, lead ? "" : "no lead row");

// --- 2. The owner's screens, desktop and phone -----------------------------
const PAGES = [
  ["Today", "/dashboard"],
  ["Inbox", "/inbox"],
  ["Customers", "/leads"],
  ["Coming up", "/coming-up"],
  ["Waiting", "/waiting"],
  ["Activity", "/activity"],
  ["Settings", "/settings"],
  ["Settings: Email", "/settings#email"],
  ["Settings: Website form", "/settings#website"],
  ["Settings: Instagram and Facebook", "/settings#social"],
  ["Settings: Replies and check-ins", "/settings#replies"],
  ["Settings: Your business", "/settings#business"],
  ["Settings: Team", "/settings#team"],
  ["Settings: Your plan", "/settings#billing"],
  ["Settings: Your data", "/settings#data"],
];
if (lead) PAGES.push(["Customer page", `/leads/${lead.id}`]);

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
for (const [label, width] of [["desktop", 1280], ["phone", 390]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies([{ name: "next-auth.session-token", value: cookie, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  for (const [name, path] of PAGES) {
    const errors = [];
    const onError = (err) => errors.push(`page error: ${err.message}`);
    const onResponse = (r) => { if (r.status() >= 500 && r.url().startsWith(BASE)) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); };
    page.on("pageerror", onError);
    page.on("response", onResponse);
    try {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
      await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(800);
      const landed = new URL(page.url()).pathname;
      if (landed.startsWith("/signin")) errors.push("bounced to sign-in");
      if (res && res.status() >= 400) errors.push(`HTTP ${res.status()}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) errors.push(`page scrolls sideways by ${overflow}px`);
      const text = await page.evaluate(() => document.body.innerText);
      if (/Application error|Unhandled Runtime Error|Something went wrong/i.test(text)) errors.push("error screen shown");
      // Today lists a new customer once a reply is drafted, and the robot runs
      // with AI keys blank, so the Customers list is where they must show up.
      if (name === "Customers" && lead && !text.includes("Maya")) errors.push("the new customer isn't in Customers");
      if (name === "Settings: Your business" && !text.includes("Your business")) errors.push('"Your business" title missing');
      if (name === "Settings: Your plan" && !text.includes("Founding tester")) errors.push('"Founding tester" card missing');
    } catch (err) {
      errors.push(err.message.split("\n")[0]);
    }
    page.off("pageerror", onError);
    page.off("response", onResponse);
    check(`${name} (${label})`, errors.length === 0, errors.join("; "));
  }
  await ctx.close();
}
await browser.close();

// --- Tidy up this run's fake business --------------------------------------
await prisma.$transaction(async (tx) => {
  const leads = await tx.lead.findMany({ where: { businessId: biz.id }, select: { id: true } });
  const ids = leads.map((l) => l.id);
  const convs = await tx.conversation.findMany({ where: { leadId: { in: ids } }, select: { id: true } });
  await tx.message.deleteMany({ where: { conversationId: { in: convs.map((c) => c.id) } } });
  await tx.conversation.deleteMany({ where: { leadId: { in: ids } } });
}).catch(() => {});
await prisma.$disconnect();

const failed = results.filter((r) => !r.ok);
const report = { ranAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, failures: failed, results };
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`robot: ${report.passed} passed, ${report.failed} failed`);
for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
process.exit(failed.length ? 1 : 0);
