import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://imagineventures.tech/", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => ({
  title: document.title,
  forms: document.querySelectorAll("form").length,
  inputs: [...document.querySelectorAll("input,textarea,select")].map((e) => e.getAttribute("placeholder") || e.type || e.tagName).slice(0, 8),
  links: [...document.querySelectorAll("a[href]")].map((a) => ({ t: (a.innerText || "").trim().slice(0, 35), h: a.href })).filter((x) => x.t).slice(0, 25),
}));
console.log(JSON.stringify(info, null, 1));
await b.close();
