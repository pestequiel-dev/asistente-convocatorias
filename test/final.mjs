import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const p = await b.newPage({ viewport: vp });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  const tl = await p.evaluate(() => ({
    months: [...document.querySelectorAll(".tl-month")].map((e) => e.textContent?.trim()),
    items: document.querySelectorAll(".tl-item").length,
    overflow: document.body.scrollWidth - window.innerWidth,
  }));
  // switch to table
  await p.getByRole("button", { name: /Tabla/ }).click();
  await p.waitForTimeout(400);
  const tbl = await p.evaluate(() => ({
    rows: document.querySelectorAll("table.table tbody tr").length,
    overflow: document.body.scrollWidth - window.innerWidth,
  }));
  console.log(vp.width, "timeline:", JSON.stringify(tl), "table:", JSON.stringify(tbl), "errors:", errors.length ? errors : "none");
  await p.close();
}
await b.close();
