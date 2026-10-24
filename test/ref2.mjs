import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const id of [28, 20]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await p.goto(`http://127.0.0.1:3100/programa/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({
    title: document.querySelector("h1")?.textContent?.slice(0, 50),
    card: document.querySelector(".detail-grid")?.innerText.slice(0, 260).replace(/\n+/g, " | "),
  }));
  console.log(id, JSON.stringify(r), "errors:", errors.length ? errors : "none");
  await p.close();
}
await b.close();
