import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const path of ["/", "/resumen"]) {
  await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({
    nav: [...document.querySelectorAll(".nav-item")].map((e) => ({ t: e.textContent?.trim(), active: e.className.includes("active") })),
    h1: document.querySelector("h1")?.textContent,
  }));
  console.log(path, JSON.stringify(r));
}
await b.close();
