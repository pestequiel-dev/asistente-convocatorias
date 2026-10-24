import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
await p.goto("http://127.0.0.1:3100/programa/355", { waitUntil: "networkidle" });
await p.waitForTimeout(1600);

const before = await p.evaluate(() => ({
  chips: document.querySelectorAll(".gap-chip").length,
  itemsWithGap: document.querySelectorAll(".draft-item.has-gap").length,
  banner: document.body.innerText.match(/\d+ datos? sin completar/)?.[0],
  completarButtons: [...document.querySelectorAll(".banner button")].filter((b) => /Completar/.test(b.textContent || "")).length,
}));

await p.getByRole("button", { name: /^Completar$/ }).first().click();
await p.waitForTimeout(600);
const after = await p.evaluate(() => {
  const el = document.activeElement;
  return {
    tag: el?.tagName,
    isTextarea: el?.tagName === "TEXTAREA",
    selLen: el && "selectionEnd" in el ? (el.selectionEnd - el.selectionStart) : null,
    selText: el && "value" in el ? el.value.slice(el.selectionStart, el.selectionEnd) : null,
  };
});

console.log("antes:", JSON.stringify(before));
console.log("después del click:", JSON.stringify(after), "errors:", errors.length ? errors : "none");
await b.close();
