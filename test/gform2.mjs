import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
for (const url of ["https://forms.gle/EsNhBebaveebpnh26", "https://docs.google.com/forms/d/e/1FAIpQLSftNb1fTk3VW3gttVSUrvPcWmDgk3nPSUJMgqN_MTsURy1ffg/viewform"]) {
  const p = await b.newPage();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const info = await p.evaluate(() => ({
    url: location.href,
    title: document.title,
    emailInputs: document.querySelectorAll('input[type="email"]').length,
    listitems: document.querySelectorAll('[role="listitem"]').length,
    allInputs: document.querySelectorAll("input,textarea").length,
    text: document.body.innerText.slice(0, 160).replace(/\n+/g, " | "),
  }));
  console.log(JSON.stringify(info));
  await p.close();
}
await b.close();
