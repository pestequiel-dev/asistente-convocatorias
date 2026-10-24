import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const id of [3, 8, 2]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await p.goto(`http://127.0.0.1:3100/programa/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const rec = document.querySelector(".rec");
    return {
      order: [...document.querySelectorAll(".detail-grid > .stack h2")].map((e) => e.textContent?.trim()),
      tone: rec?.className,
      title: document.querySelector(".rec-title")?.textContent?.trim(),
      body: document.querySelector(".rec-body")?.textContent?.trim(),
      points: [...document.querySelectorAll(".rec-point-text")].map((e) => e.textContent?.slice(0, 80)),
      overflow: document.body.scrollWidth - window.innerWidth,
    };
  });
  console.log(`\n#${id}`, JSON.stringify(r, null, 1), "errors:", errors.length ? errors : "none");
  await p.close();
}
await b.close();
