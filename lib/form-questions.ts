/** Opens an application form and reads its actual questions, in order. */
import { cdpPort, isCdpUp, profileDirFor } from "./cdp";

const SKIP = /^(first name|last name|full name|name|e-?mails?|age|phone|mobile|city|country|company|organization|organisation|website|url|linkedin|twitter|github|portfolio|orgs?\b|schools?\b|the email|drag ?& ?drop|upload|resume|cv\b|how did you hear)/i;

export type FormReadResult =
  | { status: "ok"; questions: string[] }
  | { status: "login" }
  | { status: "empty" }
  | { status: "error"; message: string };

/** Forms redirect (forms.gle → accounts.google.com); retry when the context dies. */
async function safeEval<T>(page: import("playwright").Page, fn: () => T, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      last = e;
      if (!/context was destroyed|navigat|Target closed/i.test(String((e as Error).message))) throw e;
      await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
  throw last;
}

async function readPage(page: import("playwright").Page): Promise<FormReadResult> {
  // tsx/esbuild injects a __name() helper that doesn't exist in the page.
  // The page may navigate mid-flight; the init script already covers that.
  await page.evaluate("window.__name = window.__name || function (f) { return f };").catch(() => {});
  await page.waitForTimeout(2500);

  const title = await page.title().catch(() => "");
  let host = "";
  try {
    host = new URL(page.url()).hostname;
  } catch {
    /* ignore */
  }

  const probe = await safeEval(page, () => ({
    email: document.querySelectorAll('input[type="email"]').length,
    items: document.querySelectorAll('[role="listitem"]').length,
    text: document.body.innerText.slice(0, 400),
  }));

  const looksLikeLogin =
    host.includes("accounts.google.com") ||
    /(sign in|iniciar sesión|inicia sesión|acceder|request access|solicitar acceso|pedir acceso|necesitás permiso|you need permission)/i.test(
      `${title} ${probe.text}`
    ) ||
    (probe.email > 0 && probe.items === 0);

  if (looksLikeLogin) return { status: "login" };

  const questions = await safeEval(page, () => {
    const out: string[] = [];
    const fields = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea'
    );

    for (const el of Array.from(fields)) {
      const node = el as HTMLElement;
      const tag = node.tagName.toLowerCase();
      const type = (node.getAttribute("type") || "").toLowerCase();
      if (["file", "url", "tel", "number", "checkbox", "radio", "submit"].includes(type)) continue;

      const candidates: string[] = [];
      const push = (t?: string | null) => {
        const s = (t ?? "").replace(/\s+/g, " ").trim();
        if (s && s.length < 220) candidates.push(s);
      };

      push(node.getAttribute("aria-label"));

      const labelledBy = node.getAttribute("aria-labelledby");
      if (labelledBy) {
        for (const id of labelledBy.split(/\s+/)) {
          const ref = document.getElementById(id);
          if (ref?.textContent) push(ref.textContent);
        }
      }

      const id = node.getAttribute("id");
      if (id) push(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent);
      push(node.closest("label")?.textContent);
      push(node.getAttribute("placeholder"));

      const item = node.closest('[role="listitem"]');
      if (item) {
        const heading = item.querySelector('[role="heading"], .M7eMe');
        if (heading?.textContent) push(heading.textContent);
      }

      let parent: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 4 && parent; i++) {
        const text = (parent.innerText || "").trim();
        if (text && text.length < 220) {
          push(text);
          break;
        }
        parent = parent.parentElement;
      }

      const best = candidates.sort((a, b) => b.length - a.length)[0];
      const minLen = tag === "textarea" ? 5 : 13;
      if (!best || best.length < minLen) continue;
      if (tag !== "textarea" && /(url|link|video|adjunt|archiv|file|portfolio|github|linkedin)/i.test(best)) continue;

      const looksLikeQuestion = tag === "textarea" || best.includes("?") || best.length > 45;
      if (!looksLikeQuestion) continue;

      if (!out.includes(best)) out.push(best);
    }
    return out;
  });

  const clean = questions
    .filter((q) => !SKIP.test(q.trim()))
    .filter((q) => !/(nunca envíes contraseñas|never submit passwords|se enviará una copia|borrar formulario|google forms|formularios de google)/i.test(q))
    .slice(0, 20);
  return clean.length ? { status: "ok", questions: clean } : { status: "empty" };
}

export async function extractFormQuestions(url: string, programId?: number): Promise<FormReadResult> {
  const { chromium } = await import("playwright");

  // Preferred path: the normal browser the user logged into (CDP).
  if (programId) {
    const port = cdpPort(programId);
    if (await isCdpUp(port)) {
      let browser;
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const context = browser.contexts()[0] ?? (await browser.newContext());
        const page = await context.newPage();
        // Survives redirects (forms.gle → accounts.google.com).
        await page.addInitScript({
          content: "window.__name = window.__name || function (f) { return f };",
        });
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
          return await readPage(page);
        } finally {
          await page.close().catch(() => {});
        }
      } catch (e) {
        return { status: "error", message: (e as Error).message.slice(0, 160) };
      }
      // Never close a browser we didn't launch.
    }
  }

  const fs = await import("node:fs");
  const fallbacks = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];
  const executablePath = fallbacks.find((p) => fs.existsSync(p));

  const profileDir = programId ? profileDirFor(programId) : undefined;
  let context;
  try {
    const dir = profileDir ?? (await fs.promises.mkdtemp("/tmp/mehmiro-"));
    context = await chromium.launchPersistentContext(dir, { headless: true, executablePath });
  } catch {
    return { status: "error", message: "No se pudo abrir el navegador para leer el formulario" };
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.addInitScript({
      content: "window.__name = window.__name || function (f) { return f };",
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
    return await readPage(page);
  } catch (e) {
    return { status: "error", message: (e as Error).message.slice(0, 160) };
  } finally {
    await context.close().catch(() => {});
  }
}
