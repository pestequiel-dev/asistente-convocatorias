/** Opens an application form and reads its actual questions, in order. */

// Fields the profile already answers: no essay needed there.
const SKIP = /^(first name|last name|full name|name|e-?mails?|age|phone|mobile|city|country|company|organization|organisation|website|url|linkedin|twitter|github|portfolio|orgs?\b|schools?\b|the email|drag ?& ?drop|upload|resume|cv\b|how did you hear)/i;

export async function extractFormQuestions(url: string): Promise<string[]> {
  const { chromium } = await import("playwright");
  const fs = await import("node:fs");

  const fallbacks = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];
  const executablePath = fallbacks.find((p) => fs.existsSync(p));

  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ locale: "en-US" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.waitForTimeout(2500);

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
          if (s && s.length < 200) candidates.push(s);
        };

        push(node.getAttribute("aria-label"));
        const id = node.getAttribute("id");
        if (id) push(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent);
        push(node.closest("label")?.textContent);
        push(node.getAttribute("placeholder"));

        let parent: HTMLElement | null = node.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
          const text = (parent.innerText || "").trim();
          if (text && text.length < 200) {
            push(text);
            break;
          }
          parent = parent.parentElement;
        }

        // Prefer the longest candidate: it is usually the full question.
        const best = candidates.sort((a, b) => b.length - a.length)[0];
        const minLen = tag === "textarea" ? 5 : 13;
        if (!best || best.length < minLen) continue;

        // URL / file fields are data, not questions.
        if (tag !== "textarea" && /(url|link|video|adjunt|archiv|file|portfolio|github|linkedin)/i.test(best)) continue;

        // Only long-answer fields are actual questions; "Nombre" or "Ciudad" are
        // data the profile already provides.
        const looksLikeQuestion = tag === "textarea" || best.includes("?") || best.length > 45;
        if (!looksLikeQuestion) continue;

        if (!out.includes(best)) out.push(best);
      }
      return out;
    });

    return questions.filter((q) => !SKIP.test(q.trim())).slice(0, 20);
  } catch {
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}
