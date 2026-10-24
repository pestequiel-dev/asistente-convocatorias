import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/49", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const card = await p.evaluate(() => ({
  hasCard: document.body.innerText.includes("Email de contacto"),
  to: document.body.innerText.match(/say@hi\.vc/)?.[0],
}));
await p.getByRole("button", { name: /Preparar email/ }).click();
await p.waitForTimeout(25000);
const r = await p.evaluate(() => ({
  subject: document.querySelector('input.input')?.value?.slice(0, 80),
  body: document.querySelector('textarea.textarea')?.value?.slice(0, 220),
  mailto: !!document.querySelector('a[href^="mailto:say@hi.vc"]'),
}));
console.log(JSON.stringify({ ...card, ...r, errors: errors.length ? errors : "none" }, null, 1));
await b.close();
