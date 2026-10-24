import { chatJson, llmConfig } from "./llm";
import { parseDate, parseDeadline, findDeadlineSnippet } from "./dates";
import type { CrawledPage } from "./crawler";
import type { Profile } from "./types";

export interface ExtractionDate {
  label: string;
  kind: "closing" | "opening" | "event" | "other";
  date_iso: string | null;
  raw: string | null;
  timezone: string | null;
  url: string | null;
  quote: string | null;
}

export interface ExtractionCriterion {
  text: string;
  category: string;
  url: string | null;
  quote: string | null;
}

export interface Extraction {
  title: string | null;
  organization: string | null;
  type: string | null;
  scope: string | null;
  sector_focus: string | null;
  stage_focus: string | null;
  equity: string | null;
  funding: string | null;
  duration: string | null;
  modality: string | null;
  language: string | null;
  applies_url: string | null;
  form_platform: string | null;
  docs_required: string[];
  contact: string | null;
  summary: string | null;
  closing: ExtractionDate | null;
  opening: ExtractionDate | null;
  dates: ExtractionDate[];
  criteria: ExtractionCriterion[];
  confidence: number;
}

const SYSTEM = `Sos un analista experto en convocatorias, aceleradoras, fondos y premios para startups de América Latina.
Tu trabajo es leer páginas web y PDFs de una convocatoria y devolver un JSON estructurado, en español.

REGLAS INNEGOCIABLES:
1. Solo usás información que aparece literalmente en las fuentes. Si un dato no está, devolvés null. NUNCA inventás, NUNCA inferís por conocimiento general.
2. Cada dato relevante lleva "url" (la fuente exacta) y "quote" (una cita textual copiada de esa fuente, máximo 300 caracteres). La cita tiene que existir palabra por palabra en el texto.
3. Las fechas van en ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ). Si no hay hora, usá 23:59 en la timezone indicada; si no hay timezone, usá "America/Argentina/Buenos_Aires" solo si el texto sugiere Argentina, si no null.
4. "criteria" son SOLO requisitos de elegibilidad explícitos y verificables (quién puede postular, constitución legal, país, facturación, etapa, equipo, sector, edad, etc.). No agregues criterios obvios ni deducidos. Un criterio por concepto, redactado de forma atómica.
5. "applies_url" es el link real al formulario de postulación (Typeform, Google Forms, Airtable, etc.), no la home.
6. Si hay varias fechas, cargalas todas en "dates" y marcá la de cierre de postulaciones con kind "closing".

CATEGORÍAS válidas para criteria: "geografia", "legal", "etapa", "sector", "ingresos", "equipo", "producto", "idioma", "otro".

TIPOS válidos para "type": "aceleradora", "premio", "fondo", "concurso", "otro".

Devolvés SOLO el JSON, sin markdown ni explicación.

No incluyas como criterio las frases que aclaran que algo NO se exige ("no se requiere…", "no es necesario…"): no son requisitos.`;

export interface ProfileDoc {
  label: string;
  url: string;
  content: string | null;
}

function docsBlock(docs: ProfileDoc[] | undefined, maxChars = 5000) {
  if (!docs?.length) return "";
  const parts: string[] = [];
  let used = 0;
  for (const d of docs) {
    if (!d.content) continue;
    const budget = maxChars - used;
    if (budget < 200) break;
    const chunk = d.content.slice(0, Math.min(1600, budget));
    parts.push(`— ${d.label} (${d.url}):\n${chunk}`);
    used += chunk.length;
  }
  return parts.length
    ? `\n\nDOCUMENTOS DE CONTEXTO DE LA STARTUP (aportados por el fundador, tratalos como verdad):\n${parts.join("\n\n")}`
    : "";
}

function schemaPrompt(profile: Profile, docs?: ProfileDoc[]) {
  return `Devolvé un objeto JSON con exactamente esta forma:

{
  "title": string|null,
  "organization": string|null,
  "type": "aceleradora"|"premio"|"fondo"|"concurso"|"otro"|null,
  "scope": string|null,
  "sector_focus": string|null,
  "stage_focus": string|null,
  "equity": string|null,
  "funding": string|null,
  "duration": string|null,
  "modality": string|null,
  "language": string|null,
  "applies_url": string|null,
  "form_platform": string|null,
  "docs_required": string[],
  "contact": string|null,
  "summary": string|null,
  "closing": {"label": string, "kind": "closing", "date_iso": string|null, "raw": string|null, "timezone": string|null, "url": string, "quote": string}|null,
  "opening": {"label": string, "kind": "opening", "date_iso": string|null, "raw": string|null, "timezone": string|null, "url": string, "quote": string}|null,
  "dates": [{"label": string, "kind": "closing"|"opening"|"event"|"other", "date_iso": string|null, "raw": string|null, "timezone": string|null, "url": string, "quote": string}],
  "criteria": [{"text": string, "category": "geografia"|"legal"|"etapa"|"sector"|"ingresos"|"equipo"|"producto"|"idioma"|"otro", "url": string, "quote": string}],
  "confidence": number
}

"summary" debe ser un resumen de 2-4 frases sobre qué ofrece el programa, en español neutro.
"funding" describe el monto o beneficios (ej: "USD 50.000 por equity", "premio de USD 10.000 sin equity", "sin financiamiento, solo mentoría").
"equity" indica si pide participación (ej: "No", "Sí, 7%", "No especificado").
"confidence" es tu confianza global de 0 a 1 sobre la extracción.

Contexto de la startup que va a postular (solo como referencia, no lo mezcles con la convocatoria):
${JSON.stringify(profile)}${docsBlock(docs)}`;
}

export function buildSources(pages: CrawledPage[], maxChars = 60000) {
  const scored = [...pages].sort((a, b) => {
    const w = (p: CrawledPage) =>
      (/bases|condiciones|reglamento|terminos|términos|guidelines|rules/i.test(p.url) ? 3 : 0) +
      (/postul|aplic|apply|formulario|inscri/i.test(p.url) ? 2 : 0) +
      (p.kind === "pdf" ? 2 : 0);
    return w(b) - w(a);
  });

  const chunks: string[] = [];
  let used = 0;
  for (const [i, p] of scored.entries()) {
    const header = `\n\n=== FUENTE ${i + 1} (${p.kind.toUpperCase()}) ${p.url}\nTÍTULO: ${p.title}\n---\n`;
    const budget = maxChars - used - header.length;
    if (budget < 800) break;
    const body = p.text.slice(0, budget);
    chunks.push(header + body);
    used += header.length + body.length;
  }
  return chunks.join("");
}

/** "No se requiere X" is a relief, not a requirement. */
function isNonRequirement(text: string) {
  return /^\s*(no\s+(se\s+)?(requiere|es\s+necesario|hace\s+falta|se\s+exige|se\s+necesita|es\s+obligatorio)|no\s+hay\s+que)/i.test(text);
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== "null" && t.toLowerCase() !== "no especificado" ? t : null;
}

function normalizeDateObj(v: unknown, fallbackUrl?: string): ExtractionDate | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const raw = str(o.raw);
  const dateIso = str(o.date_iso);
  let iso = dateIso;
  if (iso) {
    const parsed = new Date(iso);
    if (isNaN(parsed.getTime())) iso = null;
    else iso = parsed.toISOString();
  }
  if (!iso && raw) {
    const p = parseDate(raw);
    iso = p?.iso ?? null;
  }
  if (!raw && !iso) return null;
  return {
    label: str(o.label) || (str(o.kind) === "closing" ? "Cierre de postulación" : "Fecha"),
    kind: (["closing", "opening", "event", "other"].includes(String(o.kind)) ? o.kind : "other") as ExtractionDate["kind"],
    date_iso: iso,
    raw,
    timezone: str(o.timezone),
    url: str(o.url) || fallbackUrl || null,
    quote: str(o.quote),
  };
}

function normalizeList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : str((x as Record<string, unknown>)?.name))).filter((x): x is string => !!x && x.trim().length > 0).slice(0, 25);
}

export function normalizeExtraction(raw: Record<string, unknown>, fallbackUrl: string): Extraction {
  const criteria = Array.isArray(raw.criteria)
    ? (raw.criteria as Record<string, unknown>[])
        .map((c) => ({
          text: str(c.text) || "",
          category: str(c.category) || "otro",
          url: str(c.url) || fallbackUrl,
          quote: str(c.quote),
        }))
        .filter((c) => c.text.length > 3 && !isNonRequirement(c.text))
        .slice(0, 40)
    : [];

  const dates = Array.isArray(raw.dates)
    ? (raw.dates as unknown[]).map((d) => normalizeDateObj(d, fallbackUrl)).filter((d): d is ExtractionDate => !!d).slice(0, 25)
    : [];

  const closing = normalizeDateObj(raw.closing, fallbackUrl) ?? dates.find((d) => d.kind === "closing") ?? null;
  const opening = normalizeDateObj(raw.opening, fallbackUrl) ?? dates.find((d) => d.kind === "opening") ?? null;

  const conf = typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.6;

  return {
    title: str(raw.title),
    organization: str(raw.organization),
    type: str(raw.type),
    scope: str(raw.scope),
    sector_focus: str(raw.sector_focus),
    stage_focus: str(raw.stage_focus),
    equity: str(raw.equity),
    funding: str(raw.funding),
    duration: str(raw.duration),
    modality: str(raw.modality),
    language: str(raw.language),
    applies_url: str(raw.applies_url),
    form_platform: str(raw.form_platform),
    docs_required: normalizeList(raw.docs_required),
    contact: str(raw.contact),
    summary: str(raw.summary),
    closing,
    opening,
    dates,
    criteria,
    confidence: conf,
  };
}

const FORM_PATTERNS: { re: RegExp; name: string }[] = [
  { re: /typeform\.com/i, name: "Typeform" },
  { re: /forms\.gle|docs\.google\.com\/forms/i, name: "Google Forms" },
  { re: /airtable\.com/i, name: "Airtable" },
  { re: /jotform/i, name: "Jotform" },
  { re: /f6s\.com/i, name: "F6S" },
  { re: /younoodle/i, name: "YouNoodle" },
  { re: /tally\.so/i, name: "Tally" },
  { re: /lu\.ma|luma\.com/i, name: "Luma" },
  { re: /surveymonkey/i, name: "SurveyMonkey" },
  { re: /notion\.site/i, name: "Notion" },
];

export function detectPlatform(url: string | null): string | null {
  if (!url) return null;
  return FORM_PATTERNS.find((p) => p.re.test(url))?.name ?? null;
}

export async function extractWithLlm(
  pages: CrawledPage[],
  profile: Profile,
  formCandidates: string[],
  startUrl: string,
  docs?: ProfileDoc[]
): Promise<{ extraction: Extraction; tokens: number }> {
  const sources = buildSources(pages);
  const user = `${schemaPrompt(profile, docs)}

Links de formularios detectados automáticamente durante el rastreo (usá uno si corresponde): ${JSON.stringify(formCandidates.slice(0, 8))}
URL de partida: ${startUrl}

FUENTES:
${sources}`;

  const { json, tokens } = await chatJson<Record<string, unknown>>(SYSTEM, user, { maxTokens: 7000 });
  const extraction = normalizeExtraction(json, startUrl);
  if (!extraction.applies_url && formCandidates[0]) extraction.applies_url = formCandidates[0];
  if (!extraction.form_platform) extraction.form_platform = detectPlatform(extraction.applies_url);
  return { extraction, tokens };
}

/* ------------------------------------------------------------------ */
/* Heuristic fallback: works with no API key, lower quality but honest */
/* ------------------------------------------------------------------ */

const CATEGORY_RULES: { category: string; re: RegExp }[] = [
  { category: "producto", re: /(producto en producci[oó]n|mvp validado|producto funcionando|prototipo|plataforma propia|tecnolog[ií]a propia|propiedad intelectual)/i },
  { category: "legal", re: /(constituid|personer[ií]a|sociedad|empresa formal|estatuto|inscript|registr|cuit|rut|raz[oó]n social)/i },
  { category: "ingresos", re: /(facturaci[oó]n|ingresos|ventas|revenue|mrr|arr)/i },
  { category: "equipo", re: /(equipo|socios|fundadores|founders|full[- ]time|dedicaci[oó]n|integrantes)/i },
  { category: "etapa", re: /(pre[- ]?seed|\bseed\b|serie a|etapa temprana|early stage|antig[uü]edad)/i },
  { category: "sector", re: /(sector|industria|rubro|agtech|fintech|edtech|healthtech|tecnolog)/i },
  { category: "geografia", re: /(pa[ií]s|argentina|chile|m[eé]xico|colombia|brasil|per[uú]|uruguay|regi[oó]n|resid|radicad|domicilio|latinoam[eé]rica|iberoam)/i },
  { category: "idioma", re: /(idioma|ingl[eé]s|espa[ñn]ol|english|spanish)/i },
];


/** Pick the money figure that describes the offer, not the revenue cap. */
function pickMoney(text: string): string | null {
  const re = /(?:USD|U\$S|\$|EUR|€)\s?[\d.,]{3,}|[\d.,]{3,}\s?(?:USD|d[oó]lares|euros)/gi;
  const positive = /(premio|inversi[oó]n|financia|aporta|monto|beneficio|capital semilla|grant|otorga|entrega)/i;
  const negative = /(no debe superar|no superar|facturaci[oó]n|ingresos|ventas|l[ií]mite|tope|m[aá]ximo|recaudad)/i;

  let best: { value: string; score: number } | null = null;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    const ctx = text.slice(Math.max(0, idx - 110), idx + 110);
    let score = 0;
    if (positive.test(ctx)) score += 3;
    if (negative.test(ctx)) score -= 4;
    if (!best || score > best.score) best = { value: m[0].trim(), score };
  }
  return best && best.score > -4 ? best.value : null;
}

function classify(text: string): string {
  for (const r of CATEGORY_RULES) if (r.re.test(text)) return r.category;
  return "otro";
}

export function extractHeuristic(
  pages: CrawledPage[],
  formCandidates: string[],
  startUrl: string
): Extraction {
  const all = pages.map((p) => p.text).join("\n\n");
  const main = pages[0];

  const title =
    pages.map((p) => p.title).find((t) => t && t.length > 4 && !/^(home|inicio)$/i.test(t)) ?? main?.title ?? null;

  const applyUrl =
    formCandidates[0] ??
    (all.match(/https?:\/\/[^\s"'<>)\]]*(typeform|forms\.gle|forms\.office|airtable|jotform|f6s|younoodle|tally)[^\s"'<>)\]]*/i)?.[0] ?? null);

  const snippet = findDeadlineSnippet(pages.map((p) => p.text).join("\n")) ;
  let closing: ExtractionDate | null = null;
  const closingSource = pages.find((p) => snippet && p.text.includes(snippet));
  if (snippet) {
    const parsed = parseDeadline(snippet) ?? parseDate(snippet);
    if (parsed) {
      closing = {
        label: "Cierre de postulación",
        kind: "closing",
        date_iso: parsed.iso,
        raw: snippet.slice(0, 200),
        timezone: "America/Argentina/Buenos_Aires",
        url: closingSource?.url ?? startUrl,
        quote: snippet.slice(0, 300),
      };
    }
  }

  const sentences = all
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 320);

  const critRe =
    /(podr[aá]n postular|pueden postular|requisitos|deber[aá]n|\bdebe\b|elegibles|exclusivamente|solo podr[aá]n|dirigid[oa] a|qui[eé]nes pueden|no podr[aá]n|en etapa|con menos de|con al menos|antig[uü]edad|no superar|no debe|m[ií]nimo|m[aá]ximo|estar constituid|tener un producto|dedicaci[oó]n)/i;
  const seenC = new Set<string>();
  const criteria: ExtractionCriterion[] = [];
  for (const s of sentences) {
    if (!critRe.test(s)) continue;
    if (isNonRequirement(s)) continue;
    if (/cookie|newsletter|suscrib|privacidad/i.test(s)) continue;
    // Skip headings and fragments that are not actual requirements.
    if (s.split(/\s+/).length < 7) continue;
    if (s.length < 45 && /[?：:]$/.test(s)) continue;
    const key = s.toLowerCase().slice(0, 80);
    if (seenC.has(key)) continue;
    seenC.add(key);
    const src = pages.find((p) => p.text.includes(s));
    criteria.push({ text: s.slice(0, 240), category: classify(s), url: src?.url ?? startUrl, quote: s.slice(0, 300) });
    if (criteria.length >= 10) break;
  }

  const typeText = all.toLowerCase();
  const type = /premio|award|prize/.test(typeText)
    ? "premio"
    : /aceleradora|accelerator|aceleraci[oó]n|incubadora/.test(typeText)
    ? "aceleradora"
    : /concurso|competencia|challenge|hackat[oó]n/.test(typeText)
    ? "concurso"
    : /\bfondo\b|\bfund\b|capital semilla|grant/.test(typeText)
    ? "fondo"
    : "otro";

  const money = pickMoney(all);

  const docs: string[] = [];
  const docMap: [RegExp, string][] = [
    [/pitch\s*deck|presentaci[oó]n/i, "Pitch deck"],
    [/video/i, "Video"],
    [/carta| carta de/i, "Carta de recomendación"],
    [/presupuesto|budget/i, "Presupuesto"],
    [/cv|curr[ií]culum/i, "CV del equipo"],
    [/estados? financieros?|financials?/i, "Estados financieros"],
  ];
  for (const [re, label] of docMap) if (re.test(all) && !docs.includes(label)) docs.push(label);

  return {
    title,
    organization: null,
    type,
    scope: null,
    sector_focus: null,
    stage_focus: null,
    equity: null,
    funding: money,
    duration: null,
    modality: /virtual|online|remot/i.test(all) ? "Virtual" : /presencial/i.test(all) ? "Presencial" : null,
    language: /ingl[eé]s/.test(all) ? "Inglés" : "Español",
    applies_url: applyUrl,
    form_platform: detectPlatform(applyUrl),
    docs_required: docs,
    contact: all.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null,
    summary:
      (main?.text ?? "")
        .split(/(?<=[.!?])\s+|\n+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 80 && !/^(inicio|home|men[uú])/i.test(x))
        .slice(0, 2)
        .join(" ")
        .slice(0, 600) || null,
    closing,
    opening: null,
    dates: closing ? [closing] : [],
    criteria,
    confidence: 0.35,
  };
}

/** Downgrade confidence when a quote is not actually present in the cited source. */
export function validateCitations(ex: Extraction, pages: CrawledPage[]) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[“”"'’]/g, "").trim();
  const corpus = pages.map((p) => norm(p.text)).join("\n");
  let checked = 0;
  let bad = 0;

  for (const c of ex.criteria) {
    if (!c.quote) continue;
    checked++;
    if (!corpus.includes(norm(c.quote).slice(0, 120))) {
      bad++;
      c.quote = null;
    }
  }
  if (ex.closing?.quote) {
    checked++;
    if (!corpus.includes(norm(ex.closing.quote).slice(0, 120))) {
      bad++;
      ex.closing.quote = null;
      ex.closing.date_iso = null;
    }
  }
  if (checked > 0 && bad / checked > 0.4) ex.confidence = Math.min(ex.confidence, 0.4);
  return ex;
}

export async function extract(
  pages: CrawledPage[],
  profile: Profile,
  formCandidates: string[],
  startUrl: string,
  docs?: ProfileDoc[]
): Promise<{ extraction: Extraction; tokens: number; mode: "llm" | "heuristic"; warning?: string }> {
  const hasLlm = !!llmConfig();
  if (hasLlm) {
    try {
      const { extraction, tokens } = await extractWithLlm(pages, profile, formCandidates, startUrl, docs);
      detectPlatform(extraction.applies_url);
      return { extraction: validateCitations(extraction, pages), tokens, mode: "llm" };
    } catch (e) {
      const msg = (e as Error).message;
      return {
        extraction: extractHeuristic(pages, formCandidates, startUrl),
        tokens: 0,
        mode: "heuristic",
        warning: `Falló DeepSeek (${msg}). Se usó el análisis heurístico.`,
      };
    }
  }
  return {
    extraction: extractHeuristic(pages, formCandidates, startUrl),
    tokens: 0,
    mode: "heuristic",
    warning: "No hay API key de DeepSeek: análisis heurístico (menos preciso). Configurala en Ajustes.",
  };
}
