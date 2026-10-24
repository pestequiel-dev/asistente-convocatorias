import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 700 } });
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
const before = await p.evaluate(() => {
  const sc = document.querySelector(".tl-scroll");
  const m = document.querySelector(".tl-month");
  return { scrollTop: sc.scrollTop, monthTop: Math.round(m.getBoundingClientRect().top), contTop: Math.round(sc.getBoundingClientRect().top), scrollable: sc.scrollHeight > sc.clientHeight };
});
await p.evaluate(() => { document.querySelector(".tl-scroll").scrollTop = 260; });
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  const sc = document.querySelector(".tl-scroll");
  const months = [...document.querySelectorAll(".tl-month")].map((m) => Math.round(m.getBoundingClientRect().top));
  return { scrollTop: sc.scrollTop, monthsTop: months, contTop: Math.round(sc.getBoundingClientRect().top) };
});
console.log("before", JSON.stringify(before));
console.log("after ", JSON.stringify(after));
await b.close();
