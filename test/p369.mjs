import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
await p.goto("http://127.0.0.1:3100/programa/369", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  body: document.querySelector(".rec-body")?.textContent?.slice(0, 120),
  chips: [...document.querySelectorAll(".page-head .badge")].map((b) => b.textContent?.trim()).filter((t) => /Elegib|Faltan|No eleg/i.test(t || "")),
}))));
await b.close();
