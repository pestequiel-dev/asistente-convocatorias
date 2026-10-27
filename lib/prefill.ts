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
  // Un prefijo corto ("link") no debe arrastrar "linkedin".
  // Prefijos de 5+: "link" (4) ya no arrastra "linkedin".
  return a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a)));
}

/** How much of the candidate (a question) is covered by what the field says. */
function score(labelTokens: string[], candidate: string) {
  const c = tokens(candidate);
  if (!c.length || !labelTokens.length) return 0;
  let hit = 0;
  for (const w of c) if (labelTokens.some((l) => same(l, w))) hit++;
  const coverage = hit / c.length;
  return coverage + (coverage === 1 && c.length >= 2 ? 0.1 : 0);
}



/** Every text that could be the label of a field, most specific first. */
async function labelCandidates(page: Page, handle: ElementHandle<Element>): Promise<string[]> {
  return page.evaluate((el) => {
    const node = el as HTMLElement;
    const out: string[] = [];
    // Google Forms labels every input with "Tu respuesta"; it says nothing.
    const generic = /^(tu respuesta|your answer|respuesta|respuesta breve|respuesta larga|short answer|long answer|type your answer|escribe tu respuesta|respuesta corta)$/i;
    const push = (t?: string | null) => {
      const s = (t ?? "").replace(/\s+/g, " ").trim();
      if (!s || s.length >= 140 || out.includes(s) || generic.test(s)) return;
      out.push(s);
    };

    push(node.getAttribute("aria-label"));

    const labelledBy = node.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) push(document.getElementById(id)?.textContent);
    }

    const id = node.getAttribute("id");
    if (id) push(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent);

    push(node.closest("label")?.textContent);

    // Airtable: the label lives in the field box, not next to the editor.
    const box = node.closest(".sharedFormField");
    if (box) {
      const label = box.querySelector("label.title, label");
      if (label?.textContent) push(label.textContent);
      // Rich-text fields have no <label>: the title is the first child.
      const first = box.firstElementChild?.textContent?.trim();
      if (first) push(first);
    }

    // Google Forms: the question is the heading of the list item.
    const item = node.closest('[role="listitem"]');
    if (item) {
      const heading = item.querySelector('[role="heading"], .M7eMe');
      if (heading?.textContent) push(heading.textContent);
    }

    const prev = node.previousElementSibling as HTMLElement | null;
    if (prev && !prev.querySelector("input,textarea,select")) push(prev.textContent);

    // Many sites (this one included) put the label as loose text in the wrapper.
    let parent: HTMLElement | null = node.parentElement;
    for (let i = 0; i < 4 && parent; i++) {
      const text = (parent.innerText || "").trim();
      if (text && text.length < 180) {
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
export async function fillForm(
  page: Page,
  values: FillValue[],
  opts: { dryRun?: boolean } = {}
): Promise<{ filled: number; skipped: string[]; matches: { label: string; value: string; score: number }[] }> {
  // tsx/esbuild injects a __name() helper into named functions; when a callback
  // is serialised into the browser that helper doesn't exist. Harmless shim.
  await page.evaluate("window.__name = window.__name || function (f) { return f };");
  const handles = await page.$$(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [role="textbox"]:not(.ql-clipboard), div[contenteditable="true"]:not(.ql-clipboard)'
  );

  let filled = 0;
  const skipped: string[] = [];
  const matches: { label: string; value: string; score: number }[] = [];

  for (const h of handles) {
    try {
      if (!(await h.isVisible())) continue;

      const candidates = await labelCandidates(page, h);
      if (!candidates.length) {
        skipped.push("(campo sin etiqueta)");
        continue;
      }

      let best: { value: FillValue; s: number } | null = null;
      // Solo las etiquetas más específicas: un ancestro compartido puede
      // contener el título de otro campo y robarle el valor.
      for (const cand of candidates.slice(0, 2)) {
        const lt = tokens(cand);
        if (!lt.length) continue;
        const candNorm = cand.toLowerCase();
        for (const v of values) {
          for (const key of [v.label, ...(v.aliases ?? [])]) {
            let s = score(lt, key);
            // "Linkedin URL" must beat "website" (whose alias "url" also fits).
            const keyNorm = key.toLowerCase().trim();
            // Longer keys are more specific: "linkedin" beats the generic "url".
            if (keyNorm.length > 2 && candNorm.includes(keyNorm)) s += 0.03 * keyNorm.length;
            if (!best || s > best.s) best = { value: v, s };
          }
        }
      }

      // Un campo de GitHub no se completa con LinkedIn: no tenemos ese dato.
      if (best && /github|gitlab/i.test(candidates[0]) && !/github|gitlab/i.test(best.value.label)) {
        skipped.push(candidates[0].slice(0, 60));
        continue;
      }

      if (!best || best.s < 0.75) {
        skipped.push(candidates[0].slice(0, 60));
        continue;
      }

      const tag = await h.evaluate((el) => el.tagName.toLowerCase());
      if (tag === "select") {
        skipped.push(`${candidates[0].slice(0, 50)} (select)`);
        continue;
      }

      matches.push({ label: candidates[0].slice(0, 70), value: best.value.label, score: Number(best.s.toFixed(2)) });
      if (opts.dryRun) continue;
      await h.fill(best.value.value);
      filled++;
      if (process.env.PREFILL_DEBUG === "1") {
        console.log(`  ✓ ${candidates[0].slice(0, 40)} → ${best.value.label} (${best.s.toFixed(2)})`);
      }
    } catch (e) {
      if (process.env.PREFILL_DEBUG === "1") console.log("fill err:", (e as Error).message.slice(0, 120));
    }
  }

  return { filled, skipped, matches };
}
