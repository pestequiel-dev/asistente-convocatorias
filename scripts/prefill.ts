/**
 * Opens the real application form in a visible browser, fills what it can match
 * to the generated draft, and leaves the window open. It never submits.
 *
 *   npx tsx scripts/prefill.ts <programId>
 */
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../lib/db";
import { fillForm } from "../lib/prefill";

const programId = Number(process.argv[2]);
if (!programId) {
  console.error("Falta el id del programa");
  process.exit(1);
}

const db = getDb();
const program = db.prepare("SELECT * FROM programs WHERE id = ?").get(programId) as
  | { id: number; title: string | null; applies_url: string | null; contact_url: string | null }
  | undefined;

const draft = db
  .prepare("SELECT content FROM application_drafts WHERE program_id = ? ORDER BY id DESC LIMIT 1")
  .get(programId) as { content: string } | undefined;

const url = program?.applies_url || program?.contact_url;
if (!program || !url || !draft) {
  console.error("Falta la URL del formulario o el borrador");
  process.exit(1);
}

const answers = JSON.parse(draft.content) as { question: string; answer: string }[];

(async () => {
  const { chromium } = await import("playwright");

  const fallbacks = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];
  const executablePath = fallbacks.find((p) => fs.existsSync(p));

  const profileDir = path.join(process.cwd(), "data", "browser-profile");
  fs.mkdirSync(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.PREFILL_HEADLESS === "1",
    executablePath,
    viewport: { width: 1360, height: 940 },
    args: ["--no-first-run", "--no-default-browser-check"],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);

  const { filled, skipped } = await fillForm(page, answers);
  const summary = `prefill #${programId}: ${filled} campos completados, ${skipped.length} sin match`;
  fs.appendFileSync(path.join(process.cwd(), "data", "prefill.log"), `[${new Date().toISOString()}] ${summary}\n`);
  console.log(summary);

  if (process.env.PREFILL_HEADLESS === "1") {
    await page.screenshot({ path: path.join(process.cwd(), "data", "prefill.png"), fullPage: true });
    await context.close();
    process.exit(0);
  }

  // Keep the window open until the user closes it: they review and submit.
  await new Promise<void>((resolve) => {
    context.on("close", () => resolve());
  });
})().catch((e) => {
  console.error("prefill falló:", e);
  process.exit(1);
});
