/**
 * Opens the real application form in a visible browser, fills what it can match
 * to the generated draft, and leaves the window open. It never submits.
 *
 *   npx tsx scripts/prefill.ts <programId>
 */
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../lib/db";
import { cdpPort, isCdpUp } from "../lib/cdp";
import { fillForm, type FillValue } from "../lib/prefill";

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

const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Record<string, string>;

// Personal/company facts: many forms ask for these before the essay questions.
const facts: FillValue[] = [
  { label: "nombre", aliases: ["first name", "given name", "founder"], value: profile.founder_name || "" },
  { label: "apellido", aliases: ["last name", "surname", "family name"], value: profile.founder_last || "" },
  { label: "email", aliases: ["e-mail", "correo", "mail"], value: profile.email || "" },
  { label: "ciudad", aliases: ["city", "town", "location"], value: profile.city || "" },
  { label: "pais", aliases: ["country", "nation"], value: profile.country || "" },
  { label: "empresa", aliases: ["company", "startup", "organization", "organisation"], value: profile.name || "" },
  { label: "sitio web", aliases: ["website", "web", "url", "site"], value: profile.url || "" },
  { label: "linkedin", aliases: ["linkedin", "social", "profile"], value: profile.linkedin || "" },
  { label: "telefono", aliases: ["phone", "mobile", "whatsapp", "teléfono"], value: profile.phone || "" },
  { label: "rol", aliases: ["role", "title", "position", "cargo", "puesto"], value: profile.role || "" },
  { label: "industria", aliases: ["industry", "sector", "vertical"], value: profile.sector || "" },
  { label: "tecnologia", aliases: ["technology", "tech", "stack"], value: profile.tech_stack || "" },
  { label: "deck", aliases: ["deck", "pitch", "presentation"], value: profile.deck_url || "" },
  { label: "ronda", aliases: ["raising", "round", "ask", "investment", "levanta", "ronda"], value: profile.round_details || "" },
].filter((f) => f.value);

const values: FillValue[] = [
  ...facts,
  ...answers.map((a) => ({ label: a.question, value: a.answer })),
];

(async () => {
  const { chromium } = await import("playwright");

  const fallbacks = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];
  const executablePath = fallbacks.find((p) => fs.existsSync(p));

  // One profile per program: a shared directory gets locked by the first browser.
  const profileDir = path.join(process.cwd(), "data", "browser-profile", `p${programId}`);
  fs.mkdirSync(profileDir, { recursive: true });

  // Chromium leaves a SingletonLock behind if it dies. If the owner process is
  // gone, the lock is stale and blocks every future launch.
  try {
    const lockFile = path.join(profileDir, "SingletonLock");
    const target = fs.readlinkSync(lockFile);
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
      fs.rmSync(lockFile, { force: true });
      fs.rmSync(path.join(profileDir, "SingletonSocket"), { force: true });
      fs.rmSync(path.join(profileDir, "SingletonCookie"), { force: true });
      console.log("lock viejo eliminado");
    }
  } catch {
    /* no lock */
  }

  // If the user logged in through the CDP window, reuse that live browser.
  const port = cdpPort(programId);
  let useCdp = await isCdpUp(port);

  // A window left open without CDP blocks the profile; close it, it's ours.
  if (!useCdp) {
    try {
      const target = fs.readlinkSync(path.join(profileDir, "SingletonLock"));
      const pid = Number(String(target).split("-").pop());
      if (pid) {
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGTERM");
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          /* ya estaba muerto */
        }
      }
      for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
        fs.rmSync(path.join(profileDir, f), { force: true });
      }
    } catch {
      /* sin lock */
    }
  }
  const context = useCdp
    ? (await chromium.connectOverCDP(`http://127.0.0.1:${port}`)).contexts()[0]
    : await chromium.launchPersistentContext(profileDir, {
    headless: process.env.PREFILL_HEADLESS === "1",
    executablePath,
    viewport: { width: 1360, height: 940 },
    // Google refuses to sign in when it detects automation. These remove the
    // obvious signals; it is still their call.
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      // Keeps the window attachable, so a second click reuses it instead of
      // colliding with the profile lock.
      `--remote-debugging-port=${port}`,
    ],
  });

  await context.addInitScript({
    content:
      "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });" +
      "window.chrome = window.chrome || { runtime: {} };",
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.addInitScript({ content: "window.__name = window.__name || function (f) { return f };" });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);

  const { filled, skipped } = await fillForm(page, values);
  const summary = `prefill #${programId}: ${filled} campos completados, ${skipped.length} sin match · ${skipped.slice(0, 6).join(" | ")}`;
  fs.appendFileSync(path.join(process.cwd(), "data", "prefill.log"), `[${new Date().toISOString()}] ${summary}\n`);
  console.log(summary);

  if (process.env.PREFILL_HEADLESS === "1") {
    await page.screenshot({ path: path.join(process.cwd(), "data", "prefill.png"), fullPage: true });
    if (!useCdp) await context.close();
    process.exit(0);
  }

  // Keep the window open until the user closes it: they review and submit.
  await new Promise<void>((resolve) => {
    context.on("close", () => resolve());
  });
})().catch((e) => {
  const msg = `prefill #${programId} FALLÓ: ${(e as Error).message.slice(0, 400)}`;
  fs.appendFileSync(path.join(process.cwd(), "data", "prefill.log"), `[${new Date().toISOString()}] ${msg}\n`);
  console.error(msg);
  process.exit(1);
});
