import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const p = await b.newPage({ viewport: vp });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const info = await p.evaluate(() => {
    const months = [...document.querySelectorAll(".tl-month")].map((e) => e.textContent?.trim());
    const days = [...document.querySelectorAll(".tl-day")].map((e) => e.textContent?.trim());
    const monthEl = document.querySelector(".tl-month");
    const cs = monthEl ? getComputedStyle(monthEl) : null;
    const titleEl = document.querySelector(".tl-title");
    const ts = titleEl ? getComputedStyle(titleEl) : null;
    return {
      months, days,
      monthFont: cs ? `${cs.fontSize} / weight ${cs.fontWeight}` : null,
      titleFont: ts ? `${ts.fontSize} / weight ${ts.fontWeight}` : null,
      overflow: document.body.scrollWidth - window.innerWidth,
      order: [...document.querySelectorAll(".tl-item .tl-title")].map((e) => e.textContent?.trim()),
    };
  });
  console.log(JSON.stringify(vp.width), JSON.stringify(info, null, 1), "errors:", errors.length ? errors : "none");
  await p.close();
}
await b.close();
