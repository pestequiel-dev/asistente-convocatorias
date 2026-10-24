import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: vp });
  await ctx.addInitScript(() => localStorage.setItem("fs", "1.45"));
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const fab = document.querySelector(".qa-fab").getBoundingClientRect();
    const sc = document.querySelector(".tl-scroll");
    return {
      bodyOverflow: document.documentElement.scrollHeight - window.innerHeight,
      overflowX: document.body.scrollWidth - window.innerWidth,
      fab: { w: Math.round(fab.width), right: Math.round(window.innerWidth - fab.right), bottom: Math.round(window.innerHeight - fab.bottom) },
      fabCoversContent: sc ? fab.top < sc.getBoundingClientRect().bottom : null,
    };
  });
  console.log(vp.width, JSON.stringify(r));
  await ctx.close();
}
await b.close();
