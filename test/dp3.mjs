import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
await p.goto("http://127.0.0.1:3100/programa/358", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({
  rec: document.querySelector(".rec-title")?.textContent,
  body: document.querySelector(".rec-body")?.textContent?.slice(0, 130),
  chips: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).filter((t) => /Elegib|Aplicada|En revis/i.test(t || "")),
  crits: [...document.querySelectorAll(".criterion")].map((c) => c.innerText.replace(/\n+/g, " | ").slice(0, 70)),
}));
console.log(JSON.stringify(r, null, 1));
await b.close();
