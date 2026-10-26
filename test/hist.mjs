import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const card = [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial"));
  return {
    card: !!card,
    events: [...(card?.querySelectorAll("li") || [])].map((li) => li.innerText.replace(/\n/g, " ").slice(0, 90)),
    badge: [...document.querySelectorAll(".badge")].map((b) => b.textContent?.trim()).find((t) => /Postulación/.test(t || "")),
  };
});
console.log(JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
await b.close();
