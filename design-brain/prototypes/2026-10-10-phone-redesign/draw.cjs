const { chromium } = require("playwright"); const fs = require("fs");
// Usage: node draw.cjs <dir with session.cookie (a local sign-in, never production)>
const S = process.argv[2]; const OWNER = fs.readFileSync(`${S}/session.cookie`, "utf8").trim();
const screens = require("./screens.cjs");
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "next-auth.session-token", value: OWNER, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const p = await ctx.newPage(); await p.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  for (const [name, html] of Object.entries(screens)) {
    await p.evaluate((h) => { document.body.innerHTML = h; document.body.style.margin = "0"; }, html);
    await p.waitForTimeout(150);
    const over = await p.evaluate(() => { const ph = document.getElementById("phone"); return [...ph.querySelectorAll("*")].some((e) => e.getBoundingClientRect().right > 390.5); });
    await p.locator("#phone").screenshot({ path: `${S}/redesign/shots/${name}.png` });
    console.log(name, over ? "SOMETHING WIDER THAN THE PHONE" : "fits");
  }
  await b.close(); })();
