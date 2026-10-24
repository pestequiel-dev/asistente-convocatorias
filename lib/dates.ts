const MONTHS_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const MONTHS_EN: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const MONTHS_SHORT: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
};

export interface ParsedDate {
  iso: string;
  precision: "day" | "minute";
  assumedYear: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Argentina has no DST; dates are interpreted in Buenos Aires time (UTC-3). */
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function build(y: number, m: number, d: number, hh = 23, mm = 59, precision: "day" | "minute" = "day"): ParsedDate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const naive = new Date(Date.UTC(y, m - 1, d, hh, mm));
  if (naive.getUTCMonth() !== m - 1 || naive.getUTCDate() !== d) return null;
  return { iso: new Date(naive.getTime() + TZ_OFFSET_MS).toISOString(), precision, assumedYear: false };
}

function timePart(s: string): { hh: number; mm: number; found: boolean } {
  const m = s.match(/(\d{1,2})[:.h](\d{2})/);
  if (!m) {
    const h = s.match(/\b(\d{1,2})\s*(?:hs?|horas?)\b/i);
    if (h) return { hh: Math.min(23, Number(h[1])), mm: 0, found: true };
    return { hh: 23, mm: 59, found: false };
  }
  return { hh: Math.min(23, Number(m[1])), mm: Math.min(59, Number(m[2])), found: true };
}

/**
 * Parse a Spanish/English date string. Returns null when nothing reliable is found.
 * Dates without a year assume the current year, unless that lands far in the past,
 * in which case the next year is assumed and flagged.
 */
export function parseDate(raw: string | null | undefined, today = new Date()): ParsedDate | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;

  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    const hasTime = hh !== undefined;
    const r = build(Number(y), Number(m), Number(d), hasTime ? Number(hh) : 23, hasTime ? Number(mm) : 59, hasTime ? "minute" : "day");
    if (r) return r;
  }

  const t = timePart(s);
  const precision = t.found ? "minute" : "day";

  // 30/11/2025, 30-11-2025, 30.11.2025
  const numeric = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (numeric) {
    let [, d, m, y] = numeric;
    let year = Number(y);
    if (year < 100) year += 2000;
    // Heuristic: if first number > 12 it must be the day; otherwise assume dd/mm (AR)
    let day = Number(d), month = Number(m);
    if (day <= 12 && month > 12) { day = Number(m); month = Number(d); }
    const r = build(year, month, day, t.hh, t.mm, precision);
    if (r) return r;
  }

  // 30 de noviembre de 2025 / 30 de noviembre
  const textual = s.match(/\b(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)(?:\s*(?:de|del|,)?\s*(\d{4}))?/);
  if (textual) {
    const [, d, monthName, y] = textual;
    const month = MONTHS_ES[monthName] ?? MONTHS_EN[monthName];
    if (month) {
      return finishYear(Number(d), month, y ? Number(y) : null, t, precision, today);
    }
  }

  // noviembre 30, 2025 / 30 nov 2025
  const textual2 = s.match(/\b([a-záéíóúñ]{3,})\s*(\d{1,2})(?:\s*,?\s*(\d{4}))?/);
  if (textual2) {
    const [, monthName, d, y] = textual2;
    const month = MONTHS_ES[monthName] ?? MONTHS_SHORT[monthName] ?? MONTHS_EN[monthName];
    if (month) {
      return finishYear(Number(d), month, y ? Number(y) : null, t, precision, today);
    }
  }

  return null;
}

function finishYear(
  d: number,
  month: number,
  y: number | null,
  t: { hh: number; mm: number; found: boolean },
  precision: "day" | "minute",
  today: Date
): ParsedDate | null {
  if (y) {
    const r = build(y, month, d, t.hh, t.mm, precision);
    return r ? { ...r, assumedYear: false } : null;
  }
  const r = build(today.getUTCFullYear(), month, d, t.hh, t.mm, precision);
  if (!r) return null;
  const diffDays = (new Date(r.iso).getTime() - today.getTime()) / 86_400_000;
  if (diffDays < -45) {
    const next = build(today.getUTCFullYear() + 1, month, d, t.hh, t.mm, precision);
    return next ? { ...next, assumedYear: true } : { ...r, assumedYear: true };
  }
  return { ...r, assumedYear: true };
}

/**
 * Find the most likely deadline sentence. Only sentences with a *parseable* date
 * are considered, and explicit closing wording beats a passing mention of
 * "convocatoria" (which often contains a year but is not a deadline).
 */
export function findDeadlineSnippet(text: string): string | null {
  const sentences = text.split(/(?<=[.!?\n])\s+/).filter((s) => s.length < 400 && /\d/.test(s));
  const strong = /(cierran?|cierre|deadline|fecha l[ií]mite|plazo|hasta el|vence|finaliza|\bdeadline\b)/i;
  const weak = /(postulaci[oó]n|convocatoria|aplicaci[oó]n|inscripci[oó]n|postular)/i;

  let best: string | null = null;
  let bestScore = -1;
  for (const raw of sentences) {
    const s = raw.trim();
    const parsed = parseDate(s);
    if (!parsed) continue;
    let score = 1;
    if (strong.test(s)) score += 4;
    if (weak.test(s)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export function formatCountdown(iso: string | null): { text: string; tone: "red" | "amber" | "green" | "muted" } {
  if (!iso) return { text: "sin fecha", tone: "muted" };
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (ms < 0) return { text: "cerrada", tone: "muted" };
  if (days <= 3) return { text: days <= 0 ? "hoy" : `${days} d`, tone: "red" };
  if (days <= 10) return { text: `${days} d`, tone: "amber" };
  return { text: `${days} d`, tone: "green" };
}

/**
 * Heuristic deadline picker for a snippet that may contain several dates
 * (e.g. "12 de agosto — apertura ... 18 de septiembre — cierre").
 * Chooses the date closest to an explicit closing keyword.
 */
export function parseDeadline(snippet: string): ParsedDate | null {
  const dateRe = /\d{1,2}\s*(?:de\s+)?[a-záéíóúñ]{3,}(?:\s*(?:de|del|,)?\s*\d{4})?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi;
  const closingRe = /(cierre|cierran|cierra|deadline|fecha l[ií]mite|plazo|vence|finaliza|hasta el)/gi;
  const dates: { index: number; parsed: ParsedDate }[] = [];
  for (const m of snippet.matchAll(dateRe)) {
    const parsed = parseDate(m[0]);
    if (parsed) dates.push({ index: m.index ?? 0, parsed });
  }
  if (!dates.length) return null;
  if (dates.length === 1) return dates[0].parsed;

  const closingSpots: number[] = [];
  for (const m of snippet.matchAll(closingRe)) closingSpots.push(m.index ?? 0);
  if (!closingSpots.length) return null;

  let best = dates[0].parsed;
  let bestDist = Infinity;
  for (const d of dates) {
    for (const spot of closingSpots) {
      const dist = Math.abs(d.index - spot);
      if (dist < bestDist) {
        bestDist = dist;
        best = d.parsed;
      }
    }
  }
  return best;
}
