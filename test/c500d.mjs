import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://127.0.0.1:9318");
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto("https://latam.aplica.500.co/", { waitUntil: "domcontentloaded", timeout: 40000 });
for (const ms of [3000, 6000]) {
  await p.waitForTimeout(ms);
  const i = await p.evaluate(() => ({
    url: location.href.slice(0, 70), title: document.title.slice(0, 60),
    inputs: document.querySelectorAll("input").length,
    text: document.body.innerText.slice(0, 140).replace(/\n+/g, " | "),
  }));
  console.log(ms, JSON.stringify(i));
}
await p.close();
process.exit(0);
