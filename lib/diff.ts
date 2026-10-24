/**
 * Line-level snapshot diff. No dependencies: the goal is to spot what changed
 * on a competitor's landing (pricing, plans, features), not to be a perfect diff.
 */

const NOISE = /^(inicio|home|men[uú]|footer|newsletter|suscrib|aceptar|cookies|t[eé]rminos|privacidad)/i;

function lines(text: string) {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 25 && l.length < 300 && !NOISE.test(l));
}

function interesting(line: string) {
  return /(\$|usd|ars|eur|precio|plan|mes|año|anual|gratis|demo|nuevo|ahora|incluye|funci[oó]n|m[oó]dulo|ia\b|inteligencia artificial)/i.test(line);
}

export function diffSnapshots(prev: string, next: string): { added: string[]; removed: string[]; changed: boolean } {
  if (!prev.trim()) return { added: [], removed: [], changed: false };

  const prevLines = lines(prev);
  const nextLines = lines(next);
  const prevSet = new Set(prevLines);
  const nextSet = new Set(nextLines);

  const added = nextLines.filter((l) => !prevSet.has(l));
  const removed = prevLines.filter((l) => !nextSet.has(l));

  const rank = (arr: string[]) =>
    arr.sort((a, b) => Number(interesting(b)) - Number(interesting(a))).slice(0, 12);

  return { added: rank(added), removed: rank(removed), changed: added.length > 0 || removed.length > 0 };
}

export function formatDiff(d: { added: string[]; removed: string[]; changed: boolean }): string {
  if (!d.changed) return "";
  const parts: string[] = [];
  if (d.added.length) parts.push(`NUEVO:\n${d.added.map((l) => `+ ${l}`).join("\n")}`);
  if (d.removed.length) parts.push(`YA NO ESTÁ:\n${d.removed.map((l) => `- ${l}`).join("\n")}`);
  return parts.join("\n\n").slice(0, 3000);
}
