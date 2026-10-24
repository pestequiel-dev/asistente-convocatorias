import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://docs.google.com/forms/d/e/1FAIpQLSftNb1fTk3VW3gttVSUrvPcWmDgk3nPSUJMgqN_MTsURy1ffg/viewform", { waitUntil: "domcontentloaded", timeout: 40000 });
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  const items = [...document.querySelectorAll('[role="listitem"]')].slice(0, 5).map((it) => ({
    heading: it.querySelector('[role="heading"]')?.textContent?.trim().slice(0, 90),
    m7: it.querySelector('.M7eMe')?.textContent?.trim().slice(0, 90),
    inputs: [...it.querySelectorAll("input,textarea")].map((el) => ({
      type: el.getAttribute("type"),
      labelledby: el.getAttribute("aria-labelledby"),
      label: el.getAttribute("aria-label"),
      ph: el.getAttribute("placeholder"),
    })),
  }));
  return { title: document.title, items, inputs: document.querySelectorAll("input,textarea").length };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2000));
await b.close();
