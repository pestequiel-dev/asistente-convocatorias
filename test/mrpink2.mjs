import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const r = await p.evaluate(() => ({
  links: [...document.querySelectorAll("a[href]")].map((a) => ({ t: a.textContent?.trim().slice(0, 30), h: a.getAttribute("href")?.slice(0, 45) })).filter((l) => /mrpink|contact/i.test(l.h + l.t)),
  cards: [...document.querySelectorAll(".card-title, .panel-head h2")].map((e) => e.textContent?.trim()),
}));
console.log(JSON.stringify(r, null, 1));
await b.close();
