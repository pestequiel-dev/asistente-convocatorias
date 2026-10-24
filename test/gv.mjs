import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://www.globantventures.com/", { waitUntil: "domcontentloaded", timeout: 40000 });
await p.waitForTimeout(3500);
const info = await p.evaluate(() => {
  const forms = [...document.querySelectorAll("form")].map((f) => ({
    id: f.id || f.getAttribute("name") || "(sin id)",
    fields: [...f.querySelectorAll("input,textarea,select")].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type"),
      label: (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.closest("label")?.innerText || "").slice(0, 40),
      prev: (el.previousElementSibling?.innerText || "").slice(0, 40),
      parent: (el.parentElement?.innerText || "").slice(0, 40).replace(/\n/g, " "),
    })),
  })).filter((f) => f.fields.length > 0);
  return { anchor: document.querySelector("#postulate-form") ? "existe" : "no existe", forms };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2500));
await b.close();
