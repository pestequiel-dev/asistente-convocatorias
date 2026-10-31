import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
await p.goto("http://127.0.0.1:3100/programa/243", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
await p.selectOption("select.select", "negotiating");
await p.waitForTimeout(1800);
console.log(JSON.stringify(await p.evaluate(() => ({
  chip: [...document.querySelectorAll(".page-head .badge")].map((b) => b.textContent?.trim()).find((t) => /Negociac/i.test(t || "")),
  last: [...document.querySelectorAll(".card")].find((c) => c.innerText.includes("Historial"))?.querySelector("li")?.innerText.replace(/\n/g, " ").slice(0, 60),
}))));
await b.close();
