import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(500);

// 1) submit a real link
await p.evaluate(() => navigator.clipboard.writeText("http://127.0.0.1:8899/evento.html"));
await p.getByRole("button", { name: /Pegar link/ }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: /^Analizar$/ }).click();
await p.waitForTimeout(1500);
const afterSubmit = await p.evaluate(() => ({ url: location.pathname, modal: !!document.querySelector('[role="dialog"]') }));

// 2) go back and reopen the modal
await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.evaluate(() => navigator.clipboard.writeText(""));
await p.getByRole("button", { name: /Pegar link/ }).click();
await p.waitForTimeout(400);
const reopened = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Analizar|Analizando/.test(b.textContent || ""));
  return { text: btn?.textContent?.trim(), disabled: btn?.disabled, value: document.querySelector("#qa-url")?.value };
});
console.log("afterSubmit:", JSON.stringify(afterSubmit));
console.log("reopened:", JSON.stringify(reopened));
await b.close();
