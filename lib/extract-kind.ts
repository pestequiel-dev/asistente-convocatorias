import type { CrawledPage } from "./crawler";
import { buildSources } from "./extract";
import { chatJson, llmConfig } from "./llm";
import { parseDate } from "./dates";

export interface EventExtraction {
  title: string | null;
  organizer: string | null;
  summary: string | null;
  event_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  format: string | null;
  cost: string | null;
  audience: string | null;
  registration_deadline: string | null;
  call_for_speakers: string | null;
  stand_opportunity: string | null;
  url: string | null;
  relevance_signals: string[];
  access_note?: string;
  confidence: number;
}

export interface CompetitorExtraction {
  company: string | null;
  product: string | null;
  summary: string | null;
  country: string | null;
  segment: string | null;
  target_customer: string | null;
  positioning: string | null;
  pricing: { plan: string; price: string; notes?: string }[];
  key_features: string[];
  strengths: string[];
  weaknesses: string[];
  url: string | null;
  confidence: number;
}

export interface InvestorExtraction {
  fund: string | null;
  country: string | null;
  geographies: string[];
  invests_latam: boolean | null;
  stages: string[];
  ticket: string | null;
  thesis: string | null;
  sector_focus: string[];
  portfolio: { name: string; url: string | null }[];
  url: string | null;
  confidence: number;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== "null" ? t : null;
}

function strList(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : str((x as Record<string, unknown>)?.name)))
    .filter((x): x is string => !!x && x.trim().length > 0)
    .slice(0, max);
}

function isoOrNull(v: unknown): string | null {
  const raw = str(v);
  if (!raw) return null;
  // A date without an explicit local time is a calendar date: anchor it at 23:59 ART
  // instead of midnight UTC, otherwise it renders one day earlier in Buenos Aires.
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00)?(?:\.000)?Z?)?$/);
  if (dateOnly) return parseDate(dateOnly[1])?.iso ?? null;
  const direct = new Date(raw);
  if (!isNaN(direct.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(raw)) return direct.toISOString();
  return parseDate(raw)?.iso ?? null;
}

const EVENT_SYSTEM = `Extraés datos de la página de un EVENTO (congreso, feria, webinar, jornada, hackathon, meetup) para que una startup decida si vale la pena participar.
Devolvés SOLO JSON, en español. Si un dato no está en las fuentes, devolvés null. No inventes.
Fechas en ISO 8601. "cost" describe la entrada (ej. "Gratis", "USD 50", "AR$ 30.000 early bird").`;

const COMPETITOR_SYSTEM = `Analizás la landing de un COMPETIDOR de una startup edtech de evaluación formativa con IA.
Devolvés SOLO JSON, en español, con lectura competitiva honesta. Si un dato no está en las fuentes, null. No inventes.
Sé concreto: precios tal cual aparecen, funcionalidades nombradas, y a quién le vende.`;

export async function extractEvent(pages: CrawledPage[], startUrl: string): Promise<EventExtraction> {
  const fallback = heuristicEvent(pages, startUrl);
  if (!llmConfig()) return fallback;

  const sources = buildSources(pages, 32000);
  try {
    const { json } = await chatJson<Record<string, unknown>>(
      EVENT_SYSTEM,
      `Devolvé exactamente:
{"title":string|null,"organizer":string|null,"summary":string|null,"event_date":string|null,"end_date":string|null,
"city":string|null,"country":string|null,"venue":string|null,"format":string|null,"cost":string|null,"audience":string|null,
"registration_deadline":string|null,"call_for_speakers":string|null,"stand_opportunity":string|null,
"url":string|null,"relevance_signals":string[],"confidence":number}

"relevance_signals" son hechos concretos que ayudan a decidir si el proyecto (ver perfil cargado: sector, propuesta y clientes) debería estar ahí.

FUENTES:
${sources}`,
      { maxTokens: 2000 }
    );
    return {
      title: str(json.title) ?? fallback.title,
      organizer: str(json.organizer),
      summary: str(json.summary),
      event_date: isoOrNull(json.event_date),
      end_date: isoOrNull(json.end_date),
      city: str(json.city),
      country: str(json.country) ?? inferCountry(str(json.city), pages.map((p) => p.text).join(" ")),
      venue: str(json.venue),
      format: str(json.format),
      cost: str(json.cost),
      audience: str(json.audience),
      registration_deadline: isoOrNull(json.registration_deadline),
      call_for_speakers: str(json.call_for_speakers),
      stand_opportunity: str(json.stand_opportunity),
      url: str(json.url) ?? startUrl,
      relevance_signals: strList(json.relevance_signals),
      confidence: typeof json.confidence === "number" ? json.confidence : 0.6,
    };
  } catch {
    return fallback;
  }
}

export async function extractCompetitor(pages: CrawledPage[], startUrl: string): Promise<CompetitorExtraction> {
  const fallback = heuristicCompetitor(pages, startUrl);
  if (!llmConfig()) return fallback;

  const sources = buildSources(pages, 32000);
  try {
    const { json } = await chatJson<Record<string, unknown>>(
      COMPETITOR_SYSTEM,
      `Devolvé exactamente:
{"company":string|null,"product":string|null,"summary":string|null,"country":string|null,"segment":string|null,
"target_customer":string|null,"positioning":string|null,
"pricing":[{"plan":string,"price":string,"notes":string}],"key_features":string[],
"strengths":string[],"weaknesses":string[],"url":string|null,"confidence":number}

Contexto: el proyecto se postula a convocatorias y eventos del ecosistema; el perfil cargado describe su sector, propuesta y clientes.

FUENTES:
${sources}`,
      { maxTokens: 2500 }
    );
    const pricing = Array.isArray(json.pricing)
      ? (json.pricing as Record<string, unknown>[])
          .map((p) => ({ plan: str(p.plan) || "Plan", price: str(p.price) || "", notes: str(p.notes) || "" }))
          .filter((p) => p.price)
          .slice(0, 10)
      : [];
    return {
      company: str(json.company) ?? fallback.company,
      product: str(json.product),
      summary: str(json.summary),
      country: str(json.country),
      segment: str(json.segment),
      target_customer: str(json.target_customer),
      positioning: str(json.positioning),
      pricing,
      key_features: strList(json.key_features, 15),
      strengths: strList(json.strengths, 8),
      weaknesses: strList(json.weaknesses, 8),
      url: str(json.url) ?? startUrl,
      confidence: typeof json.confidence === "number" ? json.confidence : 0.6,
    };
  } catch {
    return fallback;
  }
}

const INVESTOR_SYSTEM = `Analizás la página de un INVERSOR (fondo de VC, ángel, aceleradora con capital) para que una startup edtech de Argentina decida si vale la pena acercarse.
Devolvés SOLO JSON, en español. Si un dato no está, null. No inventes.
Clave: determinar si invierten en América Latina y en qué etapas/tickets.`;

export async function extractInvestor(pages: CrawledPage[], startUrl: string): Promise<InvestorExtraction> {
  const fallback = heuristicInvestor(pages, startUrl);
  if (!llmConfig()) return fallback;

  const sources = buildSources(pages, 30000);
  try {
    const { json } = await chatJson<Record<string, unknown>>(
      INVESTOR_SYSTEM,
      `Devolvé exactamente:
{"fund":string|null,"country":string|null,"geographies":string[],"invests_latam":true|false|null,
"stages":string[],"ticket":string|null,"thesis":string|null,"sector_focus":string[],
"portfolio":[{"name":string,"url":string|null}],"url":string|null,"confidence":number}

"geographies" son los países/regiones donde invierten. "invests_latam" es true si hay evidencia: geografía declarada, portfolio latinoamericano, o un dominio .br/.mx/.ar/.cl/.co/.pe/.uy con el sitio en portugués/español.
Ojo: distingúí dónde está el fondo de dónde invierte. Si solo sabés que está en Brasil, poné invests_latam=true con geographies=["Brasil"] y confianza media.
"ticket" con el rango tal cual aparece (ej. "USD 250k–1M").
"portfolio" son las empresas del portfolio que se nombran en el sitio. Poné "url" solo si el link aparece en las fuentes; si no, null.

FUENTES:
${sources}`,
      { maxTokens: 1800 }
    );
    return {
      fund: str(json.fund) ?? fallback.fund,
      country: str(json.country),
      geographies: strList(json.geographies, 12),
      invests_latam: typeof json.invests_latam === "boolean" ? json.invests_latam : fallback.invests_latam,
      stages: strList(json.stages, 8),
      ticket: str(json.ticket),
      thesis: str(json.thesis),
      sector_focus: strList(json.sector_focus, 10),
      portfolio: normalizePortfolio(json.portfolio, pages),
      url: str(json.url) ?? startUrl,
      confidence: typeof json.confidence === "number" ? json.confidence : 0.6,
    };
  } catch {
    return fallback;
  }
}

function heuristicInvestor(pages: CrawledPage[], startUrl: string): InvestorExtraction {
  const all = pages.map((p) => p.text).join("\n");
  const first = pages[0];
  const latam =
    /(latinoam[eé]rica|latin america|latam|am[eé]rica latina)/i.test(all) || latamTld(startUrl);
  const countries = [...all.matchAll(/\b(Argentina|Chile|M[eé]xico|Colombia|Brasil|Brazil|Per[uú]|Uruguay|Paraguay|Bolivia|Ecuador|Venezuela|Costa Rica|Panam[aá])\b/gi)]
    .map((m) => m[1])
    .slice(0, 8);
  const stages = ["pre-seed", "seed", "serie a", "series a", "growth"].filter((st) => new RegExp(st, "i").test(all));
  const ticket = all.match(/(?:USD|\$)\s?[\d.,]+\s?[kKmM]?(?:\s?(?:-|–|a)\s?(?:USD|\$)?\s?[\d.,]+\s?[kKmM]?)?/)?.[0] ?? null;

  return {
    fund: first?.title ?? null,
    country: null,
    geographies: countries,
    invests_latam: latam || countries.length > 0,
    stages,
    ticket,
    thesis: all.split(/(?<=[.!?])\s+/).find((x) => x.length > 80)?.slice(0, 300) ?? null,
    sector_focus: [],
    portfolio: [],
    url: startUrl,
    confidence: 0.35,
  };
}

/** Turns portfolio names into real links by matching anchors found while crawling. */
function normalizePortfolio(raw: unknown, pages: CrawledPage[]): { name: string; url: string | null }[] {
  const out: { name: string; url: string | null }[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const name = typeof item === "string" ? item : str((item as Record<string, unknown>)?.name);
      const url = typeof item === "string" ? null : str((item as Record<string, unknown>)?.url);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push({ name, url });
    }
  }

  // Fill missing URLs from the anchors we captured, preferring the company's own
  // site over the fund's blog posts or a LinkedIn page.
  const anchors = pages.flatMap((p) => p.links ?? []);
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/gi, "").replace(/\s+/g, " ").trim();
  let fundHost = "";
  try {
    fundHost = new URL(pages[0]?.url ?? "").hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }

  for (const item of out) {
    if (item.url) continue;
    const key = norm(item.name);
    if (!key) continue;

    let best: { url: string; score: number } | null = null;
    for (const a of anchors) {
      const anchor = norm(a.anchor);
      if (!anchor) continue;
      let score = 0;
      if (anchor === key) score += 50;
      else if (anchor.startsWith(key + " ")) score += 30;
      else if (anchor.includes(key)) score += 12;
      else continue;

      let host = "";
      try {
        host = new URL(a.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      // A link to the fund's own blog post is not a link to the company.
      if (host === fundHost) continue;
      score += 20;
      if (!/linkedin|twitter|x\.com|facebook|instagram|youtube/.test(host)) score += 10;
      if (/\/20\d\d\/|\/blog|\/noticias|\/news|\/content\//.test(a.url)) score -= 15;

      if (!best || score > best.score) best = { url: a.url, score };
    }
    if (best && best.score > 0) item.url = best.url;
  }

  return out.slice(0, 12);
}

/** How good a match is this investor for the project today. */
function latamTld(url: string | null): boolean {
  if (!url) return false;
  try {
    return /\.(br|mx|ar|cl|co|pe|uy|ec|py|bo|ve|cr|pa|do|gt|sv|hn|ni|cu)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function scoreInvestor(inv: InvestorExtraction): number {
  let score = 20;
  if (inv.invests_latam) score += 35;
  else if (latamTld(inv.url)) score += 20;
  else if (inv.geographies.length === 0) score += 5;
  const geo = `${inv.geographies.join(" ")} ${inv.country ?? ""}`.toLowerCase();
  if (/argentina/.test(geo)) score += 10;
  const thesis = `${inv.thesis ?? ""} ${inv.sector_focus.join(" ")}`.toLowerCase();
  if (/educaci|edtech|aprendizaje|learning|impact/.test(thesis)) score += 20;
  if (inv.stages.some((x) => /pre-?seed|seed|tempran/i.test(x))) score += 10;
  if (inv.ticket) score += 5;
  return Math.max(0, Math.min(100, score));
}

/* ------------------------------- heuristics ------------------------------- */

function firstMoney(text: string, ctx: RegExp): string | null {
  const re = /(?:USD|U\$S|AR\$|\$|EUR|€)\s?[\d.,]{2,}|[\d.,]{2,}\s?(?:USD|d[oó]lares|pesos|euros)/gi;
  for (const m of text.matchAll(re)) {
    const around = text.slice(Math.max(0, (m.index ?? 0) - 90), (m.index ?? 0) + 90);
    if (ctx.test(around)) return m[0].trim();
  }
  return null;
}

function heuristicEvent(pages: CrawledPage[], startUrl: string): EventExtraction {
  const all = pages.map((p) => p.text).join("\n");
  const first = pages[0];
  const sentences = all.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean);

  const dateSentence = sentences.find(
    (s) => /\d/.test(s) && /(fecha|cu[aá]ndo|se realiza|tendr[aá] lugar|del .* al|jornada|evento)/i.test(s) && s.length < 200
  );
  const eventDate = dateSentence ? parseDate(dateSentence)?.iso ?? null : null;

  const deadlineSentence = sentences.find(
    (s) => /\d/.test(s) && /(inscripci[oó]n|registro|acreditaci[oó]n|cierre)/i.test(s) && s.length < 200
  );
  const registrationDeadline = deadlineSentence ? parseDate(deadlineSentence)?.iso ?? null : null;

  const city =
    all.match(/\b(Buenos Aires|C[oó]rdoba|Rosario|Mendoza|Ciudad de M[eé]xico|CDMX|Santiago|Bogot[aá]|Lima|Montevideo|Madrid|Barcelona|S[aã]o Paulo)\b/i)?.[0] ??
    null;
  const format = /\bh[ií]brid[oa]\b/i.test(all) ? "Híbrido" : /\bvirtual|online\b/i.test(all) ? "Virtual" : /\bpresencial\b/i.test(all) ? "Presencial" : null;

  const cost = /\b(gratis|sin costo|entrada libre)\b/i.test(all)
    ? "Gratis"
    : firstMoney(all, /(entrada|inscripci[oó]n|ticket|precio|costo|early bird)/i);

  const cfs = sentences.find((s) => /call for (papers|speakers)|convocatoria a (disertantes|ponentes)|propuestas de charlas/i.test(s)) ?? null;
  const audience = sentences.find((s) => /(dirigido a|p[uú]blico|audiencia)/i.test(s) && s.length < 200) ?? null;

  const signals: string[] = [];
  if (/escuela|colegio|docente|educaci[oó]n|edtech/i.test(all)) signals.push("Menciona escuelas, docentes o educación.");
  if (cfs) signals.push("Tiene convocatoria abierta a disertantes.");
  if (/\bstand|expositor|sponsor|auspici/i.test(all)) signals.push("Ofrece stands o auspicios.");
  if (format === "Virtual") signals.push("Es virtual: costo de asistencia bajo.");

  return {
    title: first?.title ?? null,
    organizer: null,
    summary: sentences.filter((s) => s.length > 80).slice(0, 2).join(" ").slice(0, 500) || null,
    event_date: eventDate,
    end_date: null,
    city,
    country: inferCountry(city, all),
    venue: null,
    format,
    cost,
    audience,
    registration_deadline: registrationDeadline,
    call_for_speakers: cfs,
    stand_opportunity: /\bstand|expositor|sponsor/i.test(all) ? "Sí, hay espacios de exposición o auspicio." : null,
    url: startUrl,
    relevance_signals: signals,
    confidence: 0.35,
  };
}

function heuristicCompetitor(pages: CrawledPage[], startUrl: string): CompetitorExtraction {
  const all = pages.map((p) => p.text).join("\n");
  const first = pages[0];
  const lines = all.split("\n").map((l) => l.trim()).filter(Boolean);

  const pricing: { plan: string; price: string }[] = [];
  for (const l of lines) {
    if (/(\$|USD|ARS|EUR)\s?[\d.,]{2,}/i.test(l) && l.length < 140) {
      pricing.push({ plan: l.slice(0, 60), price: l.slice(0, 120) });
    }
    if (pricing.length >= 6) break;
  }

  const features = lines
    .filter((l) => l.length > 8 && l.length < 70 && /^[A-ZÁÉÍÓÚÑ]/.test(l) && !/[.!?]$/.test(l))
    .slice(0, 10);

  return {
    company: first?.title ?? null,
    product: null,
    summary: lines.filter((l) => l.length > 80).slice(0, 2).join(" ").slice(0, 500) || null,
    country: all.match(/\b(Argentina|Chile|M[eé]xico|Colombia|Brasil|Per[uú]|Uruguay|Espa[ñn]a|Estados Unidos)\b/i)?.[0] ?? null,
    segment: null,
    target_customer: /escuela|colegio|docente/i.test(all) ? "Escuelas y docentes" : null,
    positioning: null,
    pricing,
    key_features: features,
    strengths: [],
    weaknesses: [],
    url: startUrl,
    confidence: 0.3,
  };
}

/** Relevance for the project: does it make business sense to be there? */
const LATAM = [
  "argentina", "chile", "uruguay", "paraguay", "bolivia", "peru", "colombia", "ecuador",
  "venezuela", "mexico", "brasil", "brazil", "costa rica", "panama", "república dominicana",
  "guatemala", "honduras", "el salvador", "nicaragua", "cuba",
];

const CITY_COUNTRY: [RegExp, string][] = [
  [/ciudad de m[eé]xico|cdmx|guadalajara|monterrey|puebla|quer[eé]taro/i, "México"],
  [/buenos aires|c[oó]rdoba|rosario|mendoza|tigre|la plata|san isidro/i, "Argentina"],
  [/santiago|valpara[ií]so|concepci[oó]n/i, "Chile"],
  [/bogot[aá]|medell[ií]n|cali|barranquilla/i, "Colombia"],
  [/lima|arequipa/i, "Perú"],
  [/montevideo|punta del este/i, "Uruguay"],
  [/s[aã]o paulo|rio de janeiro|bras[ií]lia|belo horizonte/i, "Brasil"],
  [/madrid|barcelona|valencia/i, "España"],
  [/miami|nueva york|new york|san francisco|austin|boston/i, "Estados Unidos"],
];

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function inferCountry(city: string | null, text = ""): string | null {
  const hay = `${city ?? ""} ${text.slice(0, 4000)}`;
  for (const [re, country] of CITY_COUNTRY) if (re.test(hay)) return country;
  return null;
}

export interface EventScore {
  score: number;
  access_note: string;
}

/**
 * Relevance for the project, adjusted by whether the founder can actually get there.
 * A great edtech event in Mexico City is not actionable from Tigre.
 */
export function scoreEventRelevance(
  e: EventExtraction,
  profile: { city?: string | null; country?: string | null } = {}
): EventScore {
  const blob = `${e.summary ?? ""} ${e.audience ?? ""} ${e.relevance_signals.join(" ")} ${e.title ?? ""}`.toLowerCase();
  let score = 25;
  if (/escuela|colegio|docente|educaci[oó]n|edtech|aula/.test(blob)) score += 30;
  if (/director|gesti[oó]n educativa|decisor|autoridad/.test(blob)) score += 12;
  if (e.call_for_speakers) score += 15;
  if (e.stand_opportunity) score += 10;
  if (/gratis|sin costo/i.test(e.cost ?? "")) score += 8;
  score = Math.min(100, score);

  const format = norm(e.format);
  const virtual = /virtual|online|remot|streaming/.test(format);
  const city = norm(e.city);
  const country = norm(e.country);
  const userCity = norm(profile.city);
  const userCountry = norm(profile.country);

  let factor = 0.75;
  let note = "No se pudo determinar la ubicación o el formato.";

  if (virtual) {
    factor = 1;
    note = "Virtual: podés participar desde donde estés.";
  } else if (userCity && city && (city.includes(userCity) || userCity.includes(city))) {
    factor = 1;
    note = `Presencial en tu ciudad (${e.city}).`;
  } else if (userCountry && country && country === userCountry) {
    factor = 0.92;
    note = `Presencial en ${e.city ?? "tu país"}: viaje doméstico.`;
  } else if (country && LATAM.includes(country)) {
    factor = 0.5;
    note = `Presencial en ${e.city ?? country} (${e.country}): requiere viaje internacional desde ${profile.city || profile.country || "tu ubicación"}.`;
  } else if (country) {
    factor = 0.35;
    note = `Presencial en ${e.city ?? country} (${e.country}): fuera de la región.`;
  }

  return { score: Math.max(0, Math.round(score * factor)), access_note: note };
}
