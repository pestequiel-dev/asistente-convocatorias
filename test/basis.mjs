import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://basisfellowship.org/apply", { waitUntil: "domcontentloaded", timeout: 40000 }).catch(e => console.log("goto:", e.message.slice(0,80)));
await p.waitForTimeout(3000);
const info = await p.evaluate(() => ({
  url: location.href,
  title: document.title,
  forms: document.querySelectorAll("form").length,
  fields: [...document.querySelectorAll("input,textarea,select")].slice(0, 12).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute("type"),
    name: el.getAttribute("name"),
    aria: el.getAttribute("aria-label"),
    ph: el.getAttribute("placeholder"),
  })),
  text: document.body.innerText.slice(0, 300).replace(/\n+/g, " | "),
}));
console.log(JSON.stringify(info, null, 1));
await b.close();
