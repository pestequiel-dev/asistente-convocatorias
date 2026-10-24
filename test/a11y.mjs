import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const read = async () => p.evaluate(() => ({
  month: getComputedStyle(document.querySelector(".tl-month")).fontSize,
  title: getComputedStyle(document.querySelector(".tl-title")).fontSize,
  day: getComputedStyle(document.querySelector(".tl-day")).fontSize,
}));
console.log("base:", JSON.stringify(await read()));
await p.getByRole("button", { name: "Texto muy grande" }).click();
await p.waitForTimeout(300);
console.log("A++ :", JSON.stringify(await read()));
// keyboard focus visibility
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
const focus = await p.evaluate(() => {
  const el = document.activeElement;
  return el ? { tag: el.tagName, outline: getComputedStyle(el).outlineWidth, aria: el.getAttribute("aria-label") } : null;
});
console.log("focus:", JSON.stringify(focus));
await b.close();
