import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
await p.goto("http://127.0.0.1:3100/programa/289", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  chips: [...document.querySelectorAll(".page-head .badge")].map((b) => b.textContent?.trim()).filter((t) => /Elegib|Descart|No eleg/i.test(t || "")),
  crit: [...document.querySelectorAll(".criterion")].map((c) => c.innerText.replace(/\n+/g, " | ").slice(0, 70)),
}))));
await b.close();
