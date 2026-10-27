/** Opens an application form and reads its actual questions, in order. */
import { cdpPort, isCdpUp, profileDirFor } from "./cdp";

const SKIP = /^(first name|last name|full name|name|e-?mails?|age|phone|mobile|city|country|company|organization|organisation|website|url|linkedin|twitter|github|portfolio|orgs?\b|schools?\b|the email|drag ?& ?drop|upload|resume|cv\b|how did you hear)/i;

// Factual fields that belong to the profile, not to an essay answer.
const DATA = /(ventas|revenue|monto|amount|tama[ñn]o (de )?ronda|round size|valorizaci|valuation|fecha|date|capital|cantidad de|number of|whatsapp|tel[eé]fono|pa[ií]s( origen)?|origen startup|sitio web|website|nombre de tu startup|founders?|mail|e-?mail)/i;

export type FormReadResult =
  | { status: "ok"; questions: string[]; pageText?: string }
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

async function readPage(page: import("playwright").Page, depth = 0): Promise<FormReadResult> {
  // tsx/esbuild injects a __name() helper that doesn't exist in the page.
  // The page may navigate mid-flight; the init script already covers that.
  await page.evaluate("window.__name = window.__name || function (f) { return f };").catch(() => {});
  await page.waitForTimeout(3500);

  const title = await page.title().catch(() => "");
  let host = "";
  try {
    host = new URL(page.url()).hostname;
  } catch {
    /* ignore */
  }

  const probe = await safeEval(page, () => ({
    email: document.querySelectorAll('input[type="email"]').length,
    password: document.querySelectorAll('input[type="password"]').length,
    text: document.body.innerText.slice(0, 400),
  }));

  // A password field is the real signal: a form with an email input is not a
  // login page (Airtable forms have one and were being misdetected).
  const looksLikeLogin =
    host.includes("accounts.google.com") ||
    /\/(auth|signin|sign-in|login|session)\b/i.test(page.url()) ||
    /(sign in|iniciar sesión|inicia sesión|acceder|request access|solicitar acceso|pedir acceso|necesitás permiso|you need permission)/i.test(
      `${title} ${probe.text}`
    ) ||
    probe.password > 0;

  if (looksLikeLogin) return { status: "login" };

  const questions = await safeEval(page, () => {
    const out: string[] = [];
    const fields = new Set<Element>([
      ...document.querySelectorAll(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea'
      ),
      ...document.querySelectorAll('[role="textbox"], div[contenteditable="true"], div[contenteditable="plaintext-only"]'),
    ]);

    for (const el of Array.from(fields)) {
      if ((el.className || "").toString().includes("ql-clipboard")) continue;
      const node = el as HTMLElement;
      const tag = node.tagName.toLowerCase();
      const type = (node.getAttribute("type") || "").toLowerCase();
      const isLongText = tag === "textarea" || node.getAttribute("role") === "textbox";
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

      const item = node.closest('[role="listitem"]');
      if (item) {
        const heading = item.querySelector('[role="heading"], .M7eMe');
        if (heading?.textContent) push(heading.textContent);
      }

      // Airtable: the field label is a <label> inside the field box.
      const box = node.closest(".sharedFormField");
      if (box) {
        const label = box.querySelector("label.title, label");
        if (label?.textContent) push(label.textContent);
      }

      // Placeholders are examples ("1. xyz@email.com - CEO"), never the question.
      push(node.getAttribute("placeholder"));

      let parent: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 6 && parent; i++) {
        const text = (parent.innerText || "").trim();
        if (text) {
          // Keep the first line: it is the question, not the help text.
          const first = text.split("\n")[0].trim();
          if (first.length >= 4 && first.length < 140) push(first);
          break;
        }
        parent = parent.parentElement;
      }

      // Priority order beats length: the label, not the example text.
      const best = candidates.find((c) => {
        if (c.length < 8) return false;
        if (!isLongText && /(url|link|video|adjunt|archiv|file|portfolio|github|linkedin)/i.test(c)) return false;
        return true;
      });
      if (!best) continue;
      // Only long-answer fields are questions; the rest is profile data.
      const looksLikeQuestion = isLongText || best.includes("?") || best.length > 45;
      if (!looksLikeQuestion) continue;

      if (!out.includes(best)) out.push(best);
    }
    return out;
  });

  let clean = questions
    .filter((q) => !SKIP.test(q.trim()))
    .filter((q) => !/(nunca envíes contraseñas|never submit passwords|se enviará una copia|borrar formulario|google forms|formularios de google)/i.test(q))
    .filter((q) => !DATA.test(q))
    .slice(0, 20);

  // A form embedded in an iframe (Tally/Typeform) can't be read from the page.
  if (!clean.length && depth < 2) {
    const frameSrc = await safeEval(page, () => {
      const frames = [...document.querySelectorAll("iframe[src]")].map((f) => (f as HTMLIFrameElement).src);
      return frames.find((u) => /(form\.|forms\.|typeform|tally|jotform|airtable|docs\.google\.com\/forms)/i.test(u)) ?? null;
    }).catch(() => null);
    if (frameSrc) {
      await page.goto(frameSrc, { waitUntil: "domcontentloaded", timeout: 35_000 }).catch(() => {});
      return readPage(page, depth + 1);
    }
  }

  // A landing page ("APLICA AQUÍ") is not the form: follow its button once.
  if (!clean.length && depth < 2) {
    const href = await safeEval(page, () => {
      const links = [...document.querySelectorAll("a[href]")];
      const hit = links.find((a) => /(aplica|apply|postul|inscrib|comenzar|start)/i.test(a.textContent || ""));
      return hit ? (hit as HTMLAnchorElement).href : null;
    }).catch(() => null);
    if (href && href.startsWith("http")) {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 35_000 }).catch(() => {});
      return readPage(page, depth + 1);
    }
  }

  if (!clean.length) return { status: "empty" };
  const pageText = await safeEval(page, () => document.body.innerText.slice(0, 1800).replace(/\n{2,}/g, "\n"))
    .catch(() => "");
  return { status: "ok", questions: clean, pageText };
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

        // If the user logged in there and navigated to the form, that tab is the
        // real destination — the stored URL may be just the platform root.
        let target = url;
        try {
          const host = new URL(url).hostname;
          const candidate = context
            .pages()
            .map((pg) => pg.url())
            .find((u) => {
              try {
                return new URL(u).hostname === host && !/(signin|sign-in|login|auth|register|signup)/i.test(u);
              } catch {
                return false;
              }
            });
          if (candidate) target = candidate;
        } catch {
          /* keep the stored url */
        }

        const page = await context.newPage();
        // Survives redirects (forms.gle → accounts.google.com).
        await page.addInitScript({
          content: "window.__name = window.__name || function (f) { return f };",
        });
        try {
          await page.goto(target, { waitUntil: "domcontentloaded", timeout: 35_000 });
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
    // A locked profile (another window open) must not block the read.
    try {
      const dir = await fs.promises.mkdtemp("/tmp/mehmiro-");
      context = await chromium.launchPersistentContext(dir, { headless: true, executablePath });
    } catch (e) {
      return { status: "error", message: (e as Error).message.slice(0, 140) };
    }
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
