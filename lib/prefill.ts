import type { ElementHandle, Page } from "playwright";

export interface FillValue {
  label: string;
  aliases?: string[];
  value: string;
}

const STOP = new Set(
  "de la el los las un una y o que en para con por del al se es son como mas más sobre entre desde hasta cual cuales quien quienes su sus tu tus nuestro nuestra the a an of to for with and or in on at is are be your you we our".split(" ")
);

function tokens(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function same(a: string, b: string) {
  return a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
}

function score(labelTokens: string[], candidate: string) {
  const c = tokens(candidate);
  if (!c.length || !labelTokens.length) return 0;
  let hit = 0;
  for (const w of c) if (labelTokens.some((l) => same(l, w))) hit++;
  return hit / Math.max(c.length, 1) / Math.max(1, Math.min(2, c.length)) + (hit ? 0.15 : 0);
}

/** Every text that could be the label of a field, most specific first. */
async function labelCandidates(page: Page, handle: ElementHandle<Element>): Promise<string[]> {
  return page.evaluate((el) => {
    const node = el as HTMLElement;
    const out: string[] = [];
    const push = (t?: string | null) => {
      const s = (t ?? "").replace(/\s+/g, " ").trim();
      if (s && s.length < 140 && !out.includes(s)) out.push(s);
    };

    push(node.getAttribute("aria-label"));

    const labelledBy = node.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) push(document.getElementById(id)?.textContent);
    }

    const id = node.getAttribute("id");
    if (id) push(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent);

    push(node.closest("label")?.textContent);

    const prev = node.previousElementSibling as HTMLElement | null;
    if (prev && !prev.querySelector("input,textarea,select")) push(prev.textContent);

    // Many sites (this one included) put the label as loose text in the wrapper.
    let parent: HTMLElement | null = node.parentElement;
    for (let i = 0; i < 4 && parent; i++) {
      const text = (parent.innerText || "").trim();
      if (text && text.length < 90) {
        push(text);
        break;
      }
      parent = parent.parentElement;
    }

    push(node.getAttribute("placeholder"));
    return out;
  }, handle);
}

/**
 * Fills every field it can confidently match. Never submits, never guesses.
 */
export async function fillForm(page: Page, values: FillValue[]): Promise<{ filled: number; skipped: string[] }> {
  // tsx/esbuild injects a __name() helper into named functions; when a callback
  // is serialised into the browser that helper doesn't exist. Harmless shim.
  await page.evaluate("window.__name = window.__name || function (f) { return f };");
  const handles = await page.$$(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select'
  );

  let filled = 0;
  const skipped: string[] = [];

  for (const h of handles) {
    try {
      if (!(await h.isVisible())) continue;

      const candidates = await labelCandidates(page, h);
      if (!candidates.length) {
        skipped.push("(campo sin etiqueta)");
        continue;
      }

      let best: { value: FillValue; s: number } | null = null;
      for (const cand of candidates) {
        const lt = tokens(cand);
        if (!lt.length) continue;
        for (const v of values) {
          for (const key of [v.label, ...(v.aliases ?? [])]) {
            const s = score(lt, key);
            if (!best || s > best.s) best = { value: v, s };
          }
        }
      }

      if (!best || best.s < 0.5) {
        skipped.push(candidates[0].slice(0, 60));
        continue;
      }

      const tag = await h.evaluate((el) => el.tagName.toLowerCase());
      if (tag === "select") {
        skipped.push(`${candidates[0].slice(0, 50)} (select)`);
        continue;
      }

      await h.fill(best.value.value);
      filled++;
      if (process.env.PREFILL_DEBUG === "1") {
        console.log(`  ✓ ${candidates[0].slice(0, 40)} → ${best.value.label} (${best.s.toFixed(2)})`);
      }
    } catch (e) {
      if (process.env.PREFILL_DEBUG === "1") console.log("fill err:", (e as Error).message.slice(0, 120));
    }
  }

  return { filled, skipped };
}
