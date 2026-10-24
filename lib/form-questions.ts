/** Opens an application form and reads its actual questions, in order. */

const SKIP = /^(first name|last name|full name|name|e-?mails?|age|phone|mobile|city|country|company|organization|organisation|website|url|linkedin|twitter|github|portfolio|orgs?\b|schools?\b|the email|drag ?& ?drop|upload|resume|cv\b|how did you hear)/i;

export type FormReadResult =
  | { status: "ok"; questions: string[] }
  | { status: "login" }
  | { status: "empty" }
  | { status: "error"; message: string };

export async function extractFormQuestions(url: string, profileDir?: string): Promise<FormReadResult> {
  const { chromium } = await import("playwright");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const fallbacks = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];
  const executablePath = fallbacks.find((p) => fs.existsSync(p));

  let context;
  try {
    context = profileDir
      ? await chromium.launchPersistentContext(profileDir, { headless: true, executablePath })
      : await chromium.launch({ headless: true, executablePath }).then(async (b) => {
          const ctx = await b.newContext();
          (ctx as unknown as { __browser?: unknown }).__browser = b;
          return ctx;
        });
  } catch (e) {
    // A locked profile must not block the draft: fall back to a clean context.
    if (profileDir) return extractFormQuestions(url);
    return { status: "error", message: (e as Error).message.slice(0, 160) };
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.waitForTimeout(2500);

    const title = await page.title();
    const host = (() => {
      try {
        return new URL(page.url()).hostname;
      } catch {
        return "";
      }
    })();

    // Google shows its own login page (accounts.google.com) or a "request
    // access" screen when the form isn't public.
    const probe = await page.evaluate(() => ({
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

    const questions = await page.evaluate(() => {
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

        // Google Forms points at the question via aria-labelledby.
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

        // Google Forms: the question block is the closest role=listitem.
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

    const clean = questions.filter((q) => !SKIP.test(q.trim())).slice(0, 20);
    return clean.length ? { status: "ok", questions: clean } : { status: "empty" };
  } catch (e) {
    return { status: "error", message: (e as Error).message.slice(0, 160) };
  } finally {
    await context.close().catch(() => {});
    const b = (context as unknown as { __browser?: { close: () => Promise<void> } }).__browser;
    if (b) await b.close().catch(() => {});
    void path;
  }
}
