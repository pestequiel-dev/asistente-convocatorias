import { chromium } from "playwright";
import fs from "node:fs";
const exe = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const browser = await chromium.launch({ headless: true, executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const path of ["/", "/programa/1", "/nueva", "/perfil", "/ajustes"]) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 200)));
  await page.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const body = document.body;
    return {
      hOverflow: body.scrollWidth - window.innerWidth,
      title: document.querySelector("h1")?.textContent?.trim(),
      sidebar: !!document.querySelector(".sidebar"),
      mainWidth: Math.round(document.querySelector(".main")?.getBoundingClientRect().width || 0),
      text: body.innerText.slice(0, 220).replace(/\n/g, " | "),
    };
  });
  console.log(path, JSON.stringify(info), "errors:", errors.length ? errors : "none");
  await page.close();
}
await browser.close();
