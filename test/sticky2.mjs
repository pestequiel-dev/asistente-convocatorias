import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 700 } });
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(600);
await p.addStyleTag({ content: `.timeline.is-fill { overflow: visible !important; }` });
await p.evaluate(() => { document.querySelector(".tl-scroll").scrollTop = 260; });
await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const sc = document.querySelector(".tl-scroll");
  return {
    contTop: Math.round(sc.getBoundingClientRect().top),
    monthsTop: [...document.querySelectorAll(".tl-month")].map((m) => Math.round(m.getBoundingClientRect().top)),
  };
});
console.log("with overflow visible:", JSON.stringify(r));
await b.close();
