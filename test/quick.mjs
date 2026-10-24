import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
const ctx = await b.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });

await p.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(600);

const fabVisible = await p.getByRole("button", { name: /Pegar link/ }).isVisible();

await p.evaluate(() => navigator.clipboard.writeText("Mirá esto https://tools-competition.org/apply ahora"));
await p.getByRole("button", { name: /Pegar link/ }).click();
await p.waitForTimeout(250);

const opened = await p.evaluate(() => {
  const f = document.querySelector(".qa-field");
  return {
    dialog: !!document.querySelector('[role="dialog"]'),
    value: document.querySelector("#qa-url")?.value,
    wobble: f?.className.includes("is-wobbling"),
    focused: document.activeElement?.id,
    glass: getComputedStyle(document.querySelector(".qa-modal")).backdropFilter,
  };
});
await p.waitForTimeout(1300);
const afterWobble = await p.evaluate(() => document.querySelector(".qa-field")?.className.includes("is-wobbling"));

// submit with mocked endpoint
await p.route("**/api/programs", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 999 }) }));
await p.getByRole("button", { name: /^Analizar$/ }).click();
await p.waitForTimeout(1200);
const navigated = p.url();

console.log("fab:", fabVisible);
console.log("opened:", JSON.stringify(opened));
console.log("wobble cleared:", !afterWobble);
console.log("navigated:", navigated);
console.log("errors:", errors.length ? errors : "none");
await b.close();
