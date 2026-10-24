/**
 * Opens the program's form with its persistent profile so the user can log in
 * once (Google, LinkedIn, etc.). The session stays in data/browser-profile/p<id>
 * and is reused by the question reader and the prefill.
 *
 *   npx tsx scripts/open-form.ts <programId>
 */
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../lib/db";

const programId = Number(process.argv[2]);
if (!programId) {
  console.error("Falta el id del programa");
  process.exit(1);
}

const db = getDb();
const program = db
  .prepare("SELECT id, applies_url, contact_url, url FROM programs WHERE id = ?")
  .get(programId) as { id: number; applies_url: string | null; contact_url: string | null; url: string } | undefined;

const url = program?.applies_url || program?.contact_url || program?.url;
if (!program || !url) {
  console.error("No hay URL para abrir");
  process.exit(1);
}

(async () => {
  const { chromium } = await import("playwright");

  const fallbacks = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];
  const executablePath = fallbacks.find((p) => fs.existsSync(p));

  const profileDir = path.join(process.cwd(), "data", "browser-profile", `p${programId}`);
  fs.mkdirSync(profileDir, { recursive: true });

  try {
    const target = fs.readlinkSync(path.join(profileDir, "SingletonLock"));
    const pid = Number(String(target).split("-").pop());
    let alive = false;
    if (pid) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
    }
    if (!alive) {
      for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
        fs.rmSync(path.join(profileDir, f), { force: true });
      }
    }
  } catch {
    /* sin lock */
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    executablePath,
    viewport: { width: 1100, height: 800 },
    args: ["--no-first-run", "--no-default-browser-check"],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => {});

  fs.appendFileSync(
    path.join(process.cwd(), "data", "prefill.log"),
    `[${new Date().toISOString()}] open-form #${programId}: ${url}\n`
  );

  await new Promise<void>((resolve) => context.on("close", () => resolve()));
})().catch((e) => {
  console.error("open-form falló:", e);
  process.exit(1);
});
