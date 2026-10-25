import type { Criterion, CriterionVerdict, Profile } from "./types";
import { chatJson, llmConfig } from "./llm";

const COUNTRIES = [
  "argentina", "chile", "uruguay", "paraguay", "bolivia", "perú", "peru", "colombia",
  "ecuador", "venezuela", "méxico", "mexico", "brasil", "costa rica", "panamá", "panama",
  "república dominicana", "guatemala", "honduras", "el salvador", "nicaragua", "cuba",
  "españa", "portugal", "estados unidos", "usa", "canadá", "reino unido",
];

/** Whole-word match: "Cuba" must not be found inside "incubadora". */
function mentionsCountry(text: string, country: string): boolean {
  // "USA" as a verb ("usa el formulario") is not the United States.
  if (country === "usa") return /(^|[^A-Za-z])USA([^A-Za-z]|$)/.test(text) || /\bU\.S\.A?\b/.test(text);
  const esc = country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-záéíóúüñ0-9])${esc}([^a-záéíóúüñ0-9]|$)`, "i").test(text);
}

function mentionsOtherCountry(text: string, own: string): string | null {
  const t = text.toLowerCase();
  const ownL = own.toLowerCase().trim();
  for (const c of COUNTRIES) {
    if (mentionsCountry(t, c) && !(ownL && (ownL.includes(c) || c.includes(ownL)))) {
      // Avoid flagging a country only mentioned as an example list including our own
      return c;
    }
  }
  return null;
}

function revenueThreshold(text: string): number | null {
  const m = text.match(/(?:USD|U\$S|\$)\s?([\d.,]+)\s*(k|m|millones|mil)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (isNaN(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "k" || unit === "mil" || unit === "millones" || unit === "m") n *= unit === "mil" || unit === "k" ? 1_000 : 1_000_000;
  return n;
}

/** "No se requiere X" is a relief, not a requirement: it must never count against you. */
function docsContext(docs?: { label: string; content: string | null }[]) {
  if (!docs?.length) return "";
  const parts: string[] = [];
  let used = 0;
  for (const d of docs) {
    if (!d.content) continue;
    const budget = 4000 - used;
    if (budget < 200) break;
    const chunk = d.content.slice(0, Math.min(1200, budget));
    parts.push(`— ${d.label}:\n${chunk}`);
    used += chunk.length;
  }
  return parts.length ? `\nDOCUMENTOS DE CONTEXTO (estado real de la startup):\n${parts.join("\n\n")}\n` : "";
}

export function nonRequirementReason(text: string): string | null {
  const re = /^\s*(no\s+(se\s+)?(requiere|es\s+necesario|hace\s+falta|se\s+exige|se\s+necesita|es\s+obligatorio)|no\s+hay\s+que|no\s+es\s+necesario)/i;
  return re.test(text) ? "No es un requisito: la base aclara que no se exige." : null;
}

const EXCLUSION = /no\s+(podr[aá]n|pueden|se\s+aceptan|se\s+admiten|participan)/i;

/**
 * A country restriction is a hard requirement, not a "doesn't apply".
 * If the criterion names countries and none is the startup's, it's a no.
 */
export function geoOverride(
  c: { text: string; category?: string | null; quote?: string | null },
  p: Profile
): { verdict: CriterionVerdict; reason: string } | null {
  if (!p.country) return null;
  const raw = `${c.text} ${c.quote ?? ""}`;
  const text = raw.toLowerCase();
  if (EXCLUSION.test(text)) return null;

  const named = COUNTRIES.filter((cn) => mentionsCountry(text, cn));
  if (!named.length) return null;

  const own = p.country.toLowerCase().trim();
  const included = named.some((cn) => own.includes(cn) || cn.includes(own));
  if (included) return null;

  // Only when the wording is about who may apply.
  const eligibilityish = /(podr[aá]n|pueden|postular|aplica|dirigid|exclusiv|solo|abierto|abierta|empresas|startups|proyectos|particip)/i.test(text);
  if (!eligibilityish) return null;

  return {
    verdict: "no_cumple",
    reason: `La convocatoria apunta a ${named
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(", ")} y Mehmiro opera en ${p.country}.`,
  };
}

/** Deterministic guard applied after the LLM, so a model mistake can't create a false negative. */
export function applyOverrides(
  c: { text: string; user_note?: string | null; quote?: string | null; category?: string | null },
  r: { verdict: CriterionVerdict; reason: string },
  p?: Profile
): { verdict: CriterionVerdict; reason: string } {
  const nonReq = nonRequirementReason(c.text);
  if (nonReq) return { verdict: "no_aplica", reason: nonReq };

  const geo = p ? geoOverride(c, p) : null;
  if (geo) return geo;

  // Without an LLM the heuristic can't interpret a free-text note: be explicit
  // instead of silently ignoring what the user wrote.
  if (c.user_note && r.verdict === "falta_dato" && !llmConfig()) {
    return {
      verdict: "ambiguo",
      reason: `Aporte tuyo: “${c.user_note.slice(0, 200)}”. Queda pendiente de interpretar (sin LLM no se puede reevaluar solo).`,
    };
  }
  return r;
}

export function matchHeuristic(c: Criterion, p: Profile): { verdict: CriterionVerdict; reason: string } {
  const text = `${c.text} ${c.quote ?? ""}`.toLowerCase();
  const cat = (c.category || "otro").toLowerCase();

  const nonReq = nonRequirementReason(c.text);
  if (nonReq) return { verdict: "no_aplica", reason: nonReq };

  const geo = geoOverride(c, c as never);
  if (geo) return geo;

  // A requirement scoped to a specific track/category must not disqualify globally.
  const trackScoped =
    /\b(track|categor[ií]a|modalidad|vertical)\b/.test(text) &&
    /\b(radicad|resid|ubicad|pa[ií]s|regi[oó]n|nacionalidad|estudiantes)\b/.test(text);
  if (trackScoped) {
    return {
      verdict: "no_aplica",
      reason: "Este requisito aplica solo a un track o categoría específica. Si te presentás por ese track tenés que cumplirlo; si vas por otro, no te bloquea.",
    };
  }

  if (cat === "geografia") {
    const local = /(latinoam[eé]rica|iberoam[eé]rica|am[eé]rica latina|latin america)/i.test(text);
    if (local && p.country) {
      const latam = ["argentina", "chile", "uruguay", "paraguay", "bolivia", "perú", "peru", "colombia", "ecuador", "venezuela", "méxico", "mexico", "brasil", "costa rica", "panamá", "panama", "república dominicana", "guatemala", "honduras", "el salvador", "nicaragua", "cuba"];
      if (latam.includes(p.country.toLowerCase().trim())) return { verdict: "cumple", reason: `Mehmiro opera en ${p.country}, incluido en la región.` };
      return { verdict: "no_cumple", reason: `La convocatoria es para Latinoamérica y Mehmiro opera en ${p.country}.` };
    }
    if (!p.country) return { verdict: "falta_dato", reason: "Falta cargar el país en el perfil." };
    if (text.includes(p.country.toLowerCase())) return { verdict: "cumple", reason: `La convocatoria incluye a ${p.country}.` };
    const other = mentionsOtherCountry(text, p.country);
    if (other) return { verdict: "no_cumple", reason: `La convocatoria menciona ${other} y no a ${p.country}.` };
    return { verdict: "falta_dato", reason: "La base no aclara la elegibilidad geográfica; revisá la fuente." };
  }

  const rawDetail = p.legal_structure_detail?.trim() || "";
  const detail = (rawDetail || "la estructura de la cooperativa").replace(/[.;\s]+$/, "").slice(0, 160);
  const thirdPartyStructure = /tercero|cooperativa|aceleradora|aliada|paraguas/i.test(p.legal_status || "");
  const allowsIndividuals = /persona[s]?\s+f[ií]sica[s]?|sin\s+personer[ií]a|emprendedor(es)?\s+individual|persona\s+humana/i.test(text);
  const requiresEntity = /constituid|personer[ií]a\s+jur[ií]dica|sociedad\s+constituida|raz[oó]n\s+social|empresa\s+formal/i.test(text);

  // Invoice / CUIT requirements are their own dimension, even when the criterion
  // was classified as "otro".
  if (!requiresEntity && /(emitir\s+factura|factura\s+electr[oó]nica|\bcuit\b|\brut\b|responsable\s+inscripto)/i.test(text)) {
    if (!p.can_invoice) return { verdict: "falta_dato", reason: "Falta indicar en el perfil si pueden emitir factura." };
    if (/^no$/i.test(p.can_invoice.trim())) return { verdict: "no_cumple", reason: "La base exige facturación y el perfil indica que no pueden emitir factura." };
    if (/tercero/i.test(p.can_invoice)) {
      return {
        verdict: "ambiguo",
        reason: `Pueden facturar solo a través de un tercero. Varias bases exigen que facture el mismo solicitante: confirmalo antes de invertir tiempo.`,
      };
    }
    return { verdict: "cumple", reason: `El perfil indica: ${p.can_invoice}.` };
  }

  if (cat === "legal") {
    if (!p.legal_status) return { verdict: "falta_dato", reason: "Falta cargar la situación legal en el perfil." };

    if (thirdPartyStructure) {
      if (allowsIndividuals) {
        return {
          verdict: "cumple",
          reason: `La base admite personas físicas o emprendimientos sin personería propia, así que pueden postular. Estructura declarada: ${detail}.`,
        };
      }
      if (requiresEntity) {
        return {
          verdict: "ambiguo",
          reason: `La base exige personería jurídica propia. Estructura declarada: ${detail}. Confirmá si la cooperativa puede figurar como solicitante (muchas veces sí, presentando el proyecto).`,
        };
      }
      return {
        verdict: "ambiguo",
        reason: `No está claro si la base exige personería propia. Estructura declarada: ${detail}.`,
      };
    }

    if (allowsIndividuals && /no|en tr[aá]mite/i.test(p.legal_status)) {
      return { verdict: "cumple", reason: "La base admite personas físicas y el perfil no está constituido." };
    }
    if (requiresEntity) {
      if (/s[ií]|constituida|formal/i.test(p.legal_status)) return { verdict: "cumple", reason: `El perfil indica: ${p.legal_status}.` };
      if (/no|en tr[aá]mite/i.test(p.legal_status)) return { verdict: "no_cumple", reason: `La base exige estar constituida y el perfil indica: ${p.legal_status}.` };
      return { verdict: "falta_dato", reason: "No se pudo interpretar la situación legal del perfil." };
    }
    return { verdict: "falta_dato", reason: "Requisito legal ambiguo; requiere revisión manual." };
  }

  if (cat === "ingresos") {
    const limit = revenueThreshold(text);
    if (p.revenue_usd == null) return { verdict: "falta_dato", reason: "Falta cargar la facturación anual (USD) en el perfil." };
    if (limit == null) return { verdict: "falta_dato", reason: "No se pudo leer el umbral de facturación de la base." };
    const lessThan = /menos de|inferior|hasta|m[aá]ximo|no superar|<|no m[aá]s de/i.test(text);
    if (lessThan) {
      return p.revenue_usd <= limit
        ? { verdict: "cumple", reason: `Facturación del perfil (USD ${p.revenue_usd.toLocaleString("es-AR")}) ≤ límite (USD ${limit.toLocaleString("es-AR")}).` }
        : { verdict: "no_cumple", reason: `Facturación del perfil (USD ${p.revenue_usd.toLocaleString("es-AR")}) supera el límite (USD ${limit.toLocaleString("es-AR")}).` };
    }
    return { verdict: "falta_dato", reason: "El requisito de ingresos no es un umbral simple; requiere revisión." };
  }

  if (cat === "etapa") {
    if (!p.stage) return { verdict: "falta_dato", reason: "Falta cargar la etapa de Mehmiro." };
    const stage = p.stage.toLowerCase();
    const wantsEarly = /pre[- ]?seed|etapa temprana|early|idea|mvp/i.test(text);
    const wantsSeed = /seed|serie a|crecimiento/i.test(text);
    if (wantsEarly && /pre|seed|idea|mvp|temprana/i.test(stage)) return { verdict: "cumple", reason: `La etapa del perfil (${p.stage}) entra en el foco.` };
    if (wantsSeed && !wantsEarly && /pre|seed|temprana/i.test(stage)) return { verdict: "cumple", reason: `La etapa del perfil (${p.stage}) es compatible.` };
    return { verdict: "ambiguo", reason: `La base apunta a "${c.text.slice(0, 90)}"; comparar con etapa "${p.stage}".` };
  }

  if (cat === "sector") {
    if (!p.sector) return { verdict: "falta_dato", reason: "Falta cargar el sector en el perfil." };
    const sectorWords = p.sector.toLowerCase().split(/[^a-záéíóúñ]+/).filter((w) => w.length > 3);
    if (sectorWords.some((w) => text.includes(w))) return { verdict: "cumple", reason: `El sector del perfil (${p.sector}) aparece en la base.` };
    if (/agtech|fintech|healthtech|prop ?tech|retail|log[ií]stica|energ[ií]a/i.test(text)) return { verdict: "no_cumple", reason: "La convocatoria está enfocada en otro sector." };
    return { verdict: "falta_dato", reason: "La base no restringe sector explícitamente." };
  }

  if (cat === "equipo") {
    const m = text.match(/(\d+|dos|tres|cuatro|cinco)\s+(?:socios|fundadores|integrantes|personas)/i);
    if (!m) return { verdict: "falta_dato", reason: "Requisito de equipo; revisar manualmente." };
    const map: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5 };
    const required = map[m[1]] ?? Number(m[1]);
    if (p.founders == null) return { verdict: "falta_dato", reason: `La base pide ${required} integrantes; falta cargar cuántos tiene Mehmiro.` };
    return p.founders >= required
      ? { verdict: "cumple", reason: `${p.founders} fundadores ≥ ${required} exigidos.` }
      : { verdict: "no_cumple", reason: `${p.founders} fundadores < ${required} exigidos.` };
  }

  if (cat === "producto") {
    if (!p.has_product) return { verdict: "falta_dato", reason: "Falta indicar si Mehmiro tiene producto en producción." };
    if (/mvp|producto|prototipo|en producci[oó]n/i.test(text)) {
      return /s[ií]/i.test(p.has_product)
        ? { verdict: "cumple", reason: `El perfil indica: ${p.has_product}.` }
        : { verdict: "no_cumple", reason: `El perfil indica: ${p.has_product}.` };
    }
    return { verdict: "falta_dato", reason: "Requisito de producto ambiguo." };
  }

  if (cat === "idioma") {
    const needsEnglish = /ingl[eé]s|english/i.test(text);
    if (needsEnglish) {
      return /ingl[eé]s|english/i.test(p.languages)
        ? { verdict: "cumple", reason: "El perfil declara manejo de inglés." }
        : { verdict: "falta_dato", reason: "La base exige inglés; confirmá el nivel del equipo." };
    }
    return { verdict: "cumple", reason: "El idioma requerido está cubierto (español)." };
  }

  return { verdict: "falta_dato", reason: "No se pudo evaluar automáticamente: requiere revisión manual." };
}

interface MatchResult {
  verdict: CriterionVerdict;
  reason: string;
}

export async function matchWithLlm(
  criteria: { text: string; category: string; quote: string | null; note?: string | null }[],
  p: Profile,
  docs?: { label: string; content: string | null }[]
): Promise<MatchResult[] | null> {
  if (!llmConfig() || criteria.length === 0) return null;
  try {
    const { json } = await chatJson<{ results: { index: number; verdict: string; reason: string }[] }>(
      `Sos un analista que evalúa si una startup cumple los requisitos de una convocatoria.
Te doy el perfil REAL de la startup y una lista de criterios extraídos de las bases.
Para cada criterio devolvés un veredicto:
- "cumple": el perfil satisface el requisito de forma clara.
- "no_cumple": el perfil contradice el requisito.
- "falta_dato": el perfil no tiene la información necesaria.
- "ambiguo": el requisito o el perfil son ambiguos.
- "no_aplica": SOLO para requisitos que pertenecen a un track o categoría alternativa (la startup puede presentarse por otro track). NUNCA lo uses para una restricción geográfica: si el programa es solo para Brasil y la startup es de Argentina, es "no_cumple".
- Los requisitos geográficos son excluyentes: si el criterio dice "startups de Brasil" y el perfil dice Argentina, el veredicto es "no_cumple" con el motivo."
Nunca inventes datos del perfil. Si el perfil está vacío en un campo, es "falta_dato".
Usá los DOCUMENTOS DE CONTEXTO como fuente de verdad sobre tracción, equipo, producto y métricas de la startup; si un documento responde un criterio, no es "falta_dato".
Si un criterio trae "NOTA DEL USUARIO", es información que el fundador aportó explícitamente: tratala como dato veraz y resolvé el veredicto con eso.
Importante: la startup puede operar bajo la estructura legal de un tercero (una cooperativa). Si la base exige personería jurídica propia y el perfil dice que opera bajo un tercero, el veredicto es "ambiguo" (no "cumple"): hay que confirmar si la cooperativa puede ser la solicitante.
Devolvés SOLO JSON: {"results":[{"index":0,"verdict":"cumple|no_cumple|falta_dato|ambiguo|no_aplica","reason":"..."}]}`,
      `PERFIL:\n${JSON.stringify(p, null, 2)}\n${docsContext(docs)}\nCRITERIOS:\n${criteria
        .map((c, i) => `${i}. [${c.category}] ${c.text}${c.note ? `\n   NOTA DEL USUARIO (dato aportado por el fundador): ${c.note}` : ""}`)
        .join("\n")}`,
      { maxTokens: 3000 }
    );
    const out: MatchResult[] = criteria.map(() => ({ verdict: "falta_dato", reason: "Sin evaluar" }));
    for (const r of json.results ?? []) {
      if (typeof r.index !== "number" || !out[r.index]) continue;
      const v = ["cumple", "no_cumple", "falta_dato", "ambiguo", "no_aplica"].includes(r.verdict)
        ? (r.verdict as CriterionVerdict)
        : "falta_dato";
      out[r.index] = { verdict: v, reason: (r.reason || "").slice(0, 400) };
    }
    return out;
  } catch {
    return null;
  }
}

export function computeScore(criteria: { verdict: CriterionVerdict }[]) {
  // Criteria that don't apply are not part of the evaluation.
  const applicable = criteria.filter((c) => c.verdict !== "no_aplica");
  if (!applicable.length) return { score: null as number | null, verdict: "unknown" as const };
  const weight: Record<CriterionVerdict, number> = {
    cumple: 1,
    falta_dato: 0.5,
    ambiguo: 0.5,
    no_cumple: 0,
    no_aplica: 0,
  };
  const score = Math.round((applicable.reduce((a, c) => a + weight[c.verdict], 0) / applicable.length) * 100);
  const anyFail = applicable.some((c) => c.verdict === "no_cumple");
  const anyMissing = applicable.some((c) => c.verdict === "falta_dato" || c.verdict === "ambiguo");
  const verdict = anyFail ? "not_eligible" : anyMissing ? "needs_info" : "eligible";
  return { score, verdict };
}
