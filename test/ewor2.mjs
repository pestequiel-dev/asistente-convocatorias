import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage();
await p.goto("https://www.ewor.com/apply?sl=SM&sc=SM&ssc=LinkedIn&sm=General", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
await p.waitForTimeout(4000);
console.log(JSON.stringify(await p.evaluate(() => {
  const links = [...document.querySelectorAll("a[href],button")].map((e) => ({
    tag: e.tagName.toLowerCase(),
    text: (e.textContent || "").trim().slice(0, 40),
    href: e.getAttribute("href"),
  })).filter((x) => /apply|become|start|empez/i.test(x.text + (x.href || "")));
  const iframes = [...document.querySelectorAll("iframe")].map((f) => f.src.slice(0, 80));
  return { links: links.slice(0, 8), iframes };
}), null, 1));
await b.close();
