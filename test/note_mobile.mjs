import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:3100/programa/3", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
await p.getByRole("button", { name: /Aportar el dato/ }).first().click();
await p.waitForTimeout(400);
const r = await p.evaluate(() => ({
  overflow: document.body.scrollWidth - window.innerWidth,
  textareaW: Math.round(document.querySelector(".crit-form textarea")?.getBoundingClientRect().width || 0),
  btnVisible: !!document.querySelector(".crit-form button"),
}));
console.log(JSON.stringify(r));
await b.close();
