import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: vp, permissions: ["clipboard-read", "clipboard-write"] });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);

  // no link in clipboard
  await p.evaluate(() => navigator.clipboard.writeText("solo texto sin link"));
  await p.getByRole("button", { name: /Pegar link/ }).click();
  await p.waitForTimeout(300);
  const empty = await p.evaluate(() => ({
    val: document.querySelector("#qa-url")?.value,
    wobble: document.querySelector(".qa-field")?.className.includes("is-wobbling"),
    overflow: document.body.scrollWidth - window.innerWidth,
  }));

  // escape closes
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  const closed = await p.evaluate(() => !document.querySelector('[role="dialog"]'));

  // focus trap: tab cycles inside
  await p.evaluate(() => navigator.clipboard.writeText("https://example.com/x"));
  await p.getByRole("button", { name: /Pegar link/ }).click();
  await p.waitForTimeout(300);
  for (let i = 0; i < 6; i++) await p.keyboard.press("Tab");
  const trap = await p.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));

  console.log(vp.width, JSON.stringify({ empty: empty.val, wobble: empty.wobble, overflow: empty.overflow, closed, trapInside: trap }), "errors:", errors.length ? errors : "none");
  await ctx.close();
}
await b.close();
