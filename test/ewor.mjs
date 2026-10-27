import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://www.ewor.com/apply?sl=SM&sc=SM&ssc=LinkedIn&sm=General", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
await p.waitForTimeout(4000);
console.log(JSON.stringify(await p.evaluate(() => ({
  url: location.href.slice(0, 80),
  title: document.title,
  inputs: document.querySelectorAll("input,textarea").length,
  text: document.body.innerText.slice(0, 200).replace(/\n+/g, " | "),
})), null, 1));
await b.close();
