import type { Page } from "playwright";

export interface FillAnswer {
  question: string;
  answer: string;
}

const STOP = new Set(
  "de la el los las un una y o que en para con por del al se es son como mas más sobre entre desde hasta cual cuales quien quienes su sus tu tus nuestro nuestra".split(" ")
);

function tokens(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function score(label: string, question: string) {
  const l = new Set(tokens(label));
  const q = tokens(question);
  if (!q.length) return 0;
  let hit = 0;
  for (const w of q) if (l.has(w)) hit++;
  return hit / q.length;
}

/** Reads the visible label of a form field, across the usual DOM patterns. */
async function fieldLabel(page: Page, handle: import("playwright").ElementHandle<Element>): Promise<string> {
  return page.evaluate((el) => {
    const node = el as HTMLElement;
    const parts: string[] = [];
    const aria = node.getAttribute("aria-label");
    if (aria) parts.push(aria);

    const labelledBy = node.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const ref = document.getElementById(id);
        if (ref?.textContent) parts.push(ref.textContent);
      }
    }

    const placeholder = node.getAttribute("placeholder");
    if (placeholder) parts.push(placeholder);

    const id = node.getAttribute("id");
    if (id) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lab?.textContent) parts.push(lab.textContent);
    }

    const closestLabel = node.closest("label");
    if (closestLabel?.textContent) parts.push(closestLabel.textContent);

    // Google Forms: the question lives a few levels above the input.
    let parent: HTMLElement | null = node.parentElement;
    for (let i = 0; i < 6 && parent; i++) {
      const header = parent.querySelector('[role="heading"], .M7eMe, [data-params] > div');
      if (header?.textContent) {
        parts.push(header.textContent);
        break;
      }
      parent = parent.parentElement;
    }

    return parts.join(" ").replace(/\s+/g, " ").trim();
  }, handle);
}

/**
 * Fills every field it can match to a draft answer. Never clicks submit and
 * never touches a field it isn't confident about.
 */
export async function fillForm(page: Page, answers: FillAnswer[]): Promise<{ filled: number; skipped: string[] }> {
  const handles = await page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select');
  let filled = 0;
  const skipped: string[] = [];

  for (const h of handles) {
    try {
      const visible = await h.isVisible();
      if (!visible) continue;

      const label = await fieldLabel(page, h);
      if (!label) {
        skipped.push("(campo sin etiqueta)");
        continue;
      }

      let best: { answer: FillAnswer; s: number } | null = null;
      for (const a of answers) {
        const s = score(label, a.question);
        if (!best || s > best.s) best = { answer: a, s };
      }

      if (!best || best.s < 0.34) {
        skipped.push(label.slice(0, 60));
        continue;
      }

      const tag = await h.evaluate((el) => el.tagName.toLowerCase());
      if (tag === "select") {
        skipped.push(`${label.slice(0, 50)} (select)`);
        continue;
      }

      await h.fill(best.answer.answer);
      filled++;
    } catch {
      /* field not fillable, move on */
    }
  }

  return { filled, skipped };
}
