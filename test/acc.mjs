import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/programa/382", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const opts = await p.evaluate(() => {
  const sel = [...document.querySelectorAll("select.select")].find((s) => [...s.options].some((o) => o.textContent?.includes("Convocatoria")));
  return sel ? [...sel.options].map((o) => o.textContent) : null;
});
console.log("tipo:", JSON.stringify(opts));
await b.close();
