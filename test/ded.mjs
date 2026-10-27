import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
await p.goto("http://127.0.0.1:3100/perfil", { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const r = await p.evaluate(() => [...document.querySelectorAll("label")].filter((l) => /Dedicaci/.test(l.textContent || "")).map((l) => {
  const sel = l.parentElement?.querySelector("select");
  return { label: l.textContent?.trim(), value: sel?.value, options: sel ? [...sel.options].map(o => o.textContent).slice(0,4) : null };
}));
console.log(JSON.stringify(r));
await b.close();
