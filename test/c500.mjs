import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://127.0.0.1:9318");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.addInitScript({ content: "window.__name = window.__name || function (f) { return f };" });
await p.goto("https://latam.aplica.500.co/es/startups", { waitUntil: "domcontentloaded", timeout: 40000 });
await p.waitForTimeout(3500);
const info = await p.evaluate(() => ({
  url: location.href.slice(0, 80),
  title: document.title,
  inputs: document.querySelectorAll("input,textarea,select").length,
  text: document.body.innerText.slice(0, 300).replace(/\n+/g, " | "),
}));
console.log(JSON.stringify(info, null, 1));
await p.close();
process.exit(0);
