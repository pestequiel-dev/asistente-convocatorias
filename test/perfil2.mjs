import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const r = await p.evaluate(() => ({
  labels: [...document.querySelectorAll("label")].map((l) => l.textContent?.trim()).filter((t) => /deck|Ronda/i.test(t || "")),
  overflow: document.body.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(r), "errors:", errors.length ? errors : "none");
await b.close();
