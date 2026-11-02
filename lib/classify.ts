import type { Kind } from "./types";
import { chatJson, llmConfig } from "./llm";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface Preview {
  text: string;
  title: string | null;
  description: string | null;
}

/** Cheap HTML preview: plain fetch, no browser. Good enough to classify. */
export async function fetchPreview(url: string): Promise<Preview> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return { text: "", title: null, description: null };
    const html = await res.text();

    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 160) ?? null;
    const description =
      html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:og:)?description["']/i)?.[1]?.trim() ??
      null;

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    return { text, title, description: description?.slice(0, 400) ?? null };
  } catch {
    return { text: "", title: null, description: null };
  }
}

const SIGNALS: Record<Exclude<Kind, "referencia">, RegExp[]> = {
  aceleradora: [
    /accelerator|aceleradora|incubadora|incubator/i, /\bcohorte\b|\bcohort\b|\bbatch\b/i,
    /demo day|mentor(es|ía)?\b|mentorship/i, /programa de aceleraci/i,
  ],
  convocatoria: [
    /bases\s*(y|e)\s*condiciones/i, /\bconvocatoria/i, /postulaci[oó]n|postular/i,
    /elegibilidad|elegibles/i, /\bpremio\b|\bpremios\b/i, /aceleradora|accelerator/i,
    /\bfondo\b|capital semilla|\bgrant\b/i, /\bbeca\b/i, /cierre de (la )?(convocatoria|postulaci)/i,
    /aplic[aá]|apply now/i, /requisitos/i,
  ],
  evento: [
    /\bcongreso\b/i, /\bferia\b/i, /\bwebinar\b/i, /\bjornada/i, /\bsummit\b/i, /\bmeetup\b/i,
    /hackat[oó]n/i, /\bentradas?\b/i, /call for (papers|speakers)/i, /\bdisertantes?\b/i,
    /\bseed[ae]?\b|\bvenue\b/i, /\bagenda\b/i, /\bspeakers?\b/i, /inscripci[oó]n al evento/i,
  ],
  inversor: [
    /\bvc\b|\bventure capital\b|\bfondo\b|\bfund\b/i, /\bportfolio\b|\bportafolio\b/i,
    /\blp\b|limited partner|\bticket\b/i, /\binvertimos\b|\bwe invest\b|\binvest in\b/i,
    /\bpre-seed\b|\bseed\b|\bserie [abc]\b/i, /\btesis\b|\bthesis\b/i,
  ],
  competidor: [
    /\bplanes?\b.*(precio|\$|mes)/i, /\bpricing\b/i, /\bprecios?\b/i, /probar gratis|free trial/i,
    /\bnuestros? clientes?\b/i, /\bfuncionalidades\b|\bfeatures\b/i, /\bdemo\b/i,
    /plataforma para (escuelas|docentes|colegios|institutos)/i, /solicit[aá] una demo/i,
  ],
};

const URL_HINTS: { re: RegExp; kind: Kind; weight: number }[] = [
  { re: /typeform|forms\.gle|docs\.google\.com\/forms|jotform|airtable/i, kind: "convocatoria", weight: 3 },
  { re: /lu\.ma|luma\.com|eventbrite|meetup\.com|hopin|zoom\.us/i, kind: "evento", weight: 3 },
  { re: /linkedin\.com\/pulse|medium\.com|substack|blog/i, kind: "referencia", weight: 2 },
];

export interface Classification {
  kind: Kind;
  confidence: number;
  reason: string;
  /** ¿Tiene que ver con el negocio o su ecosistema? Ser "referencia" no implica ser irrelevante. */
  relevant: boolean;
  relevance_reason: string;
}

const KIND_LABEL: Record<Kind, string> = {
  convocatoria: "convocatoria / premio / fondo",
  aceleradora: "aceleradora o incubadora (programa con mentoría; puede o no invertir)",
  evento: "evento (congreso, feria, webinar, hackathon)",
  competidor: "competidor (producto o servicio que compite con Mehmiro)",
  inversor: "inversor (fondo de VC, ángel o aceleradora con capital)",
  referencia: "referencia (nota, artículo, recurso, ruido)",
};

/** Unmistakable "this is a call" wording: overrides a wrong model verdict. */
const OPPORTUNITY = /(grant opportunity|call for proposals|call for applications|request for proposals|request for applications|applications? (?:are |is )?open|apply by|application deadline|deadline to apply|funding opportunity|\brfps?\b|grant program|grant of up to|awards? of up to|submit your (?:proposal|application))/i;

const BUSINESS = /(edtech|educaci[oó]n|educativ|escuela|colegio|docente|universidad|aula|ense[ñn]anza|aprendizaje|startup|emprendedor|emprendimiento|inversi[oó]n|inversor|venture|\bvc\b|fondo|aceleradora|incubadora|inteligencia artificial|\bia\b|funding|capital semilla|latam|latinoam[eé]rica|iberoam[eé]rica)/i;

function heuristic(url: string, pasted: string, preview: string): Classification {
  const corpus = `${pasted}\n${preview}`;
  const scores: Record<Kind, number> = { convocatoria: 0, aceleradora: 0, evento: 0, competidor: 0, inversor: 0, referencia: 0 };
  const hits: Record<Kind, string[]> = { convocatoria: [], aceleradora: [], evento: [], competidor: [], inversor: [], referencia: [] };

  for (const [kind, res] of Object.entries(SIGNALS) as [Exclude<Kind, "referencia">, RegExp[]][]) {
    for (const re of res) {
      const m = corpus.match(re);
      if (m) {
        scores[kind] += 2;
        if (hits[kind].length < 3) hits[kind].push(m[0].toLowerCase());
      }
    }
  }

  for (const h of URL_HINTS) if (h.re.test(url)) scores[h.kind] += h.weight;

  // A page with pricing + product language is a competitor even if it mentions "convocatoria"
  // in a blog post.
  if (scores.competidor >= 4 && scores.convocatoria <= 2) scores.competidor += 2;

  const ranked = (Object.keys(scores) as Kind[]).sort((a, b) => scores[b] - scores[a]);
  const best = ranked[0];
  const top = scores[best];

  const opportunityHit = OPPORTUNITY.exec(corpus);
  let bestKind: Kind = best;
  if (opportunityHit && best !== "competidor") bestKind = "convocatoria";

  const relevant = bestKind !== "referencia" || BUSINESS.test(corpus);

  if (top === 0) {
    return {
      kind: "referencia",
      confidence: 0.2,
      reason: "No se detectaron señales claras de convocatoria, evento ni competidor.",
      relevant,
      relevance_reason: relevant
        ? "Menciona temas del ecosistema (educación, startups o inversión)."
        : "No se detectó relación con educación, startups ni inversión.",
    };
  }

  const second = scores[ranked[1]];
  const confidence = Math.min(0.9, 0.35 + top * 0.08 + (top - second) * 0.05);
  const signals = hits[best].slice(0, 3).map((h) => `“${h}”`).join(", ");
  return {
    kind: bestKind,
    confidence: Number(confidence.toFixed(2)),
    reason: `Señales detectadas: ${signals || "contenido del sitio"}.`,
    relevant,
    relevance_reason: relevant
      ? "Tiene que ver con el ecosistema de Mehmiro (educación, startups o inversión)."
      : "No se detectó relación con educación, startups ni inversión.",
  };
}

export async function classify(input: { url: string; pasted: string; preview: string }): Promise<Classification> {
  const fallback = heuristic(input.url, input.pasted, input.preview);
  // Sitio bloqueado por anti-bot: no hay evidencia para descartarlo.
  const walled = input.preview.trim().length < 60 || /(just a moment|checking your browser|attention required|verify you are human)/i.test(input.preview);
  if (walled) {
    return {
      ...fallback,
      relevant: true,
      kind: fallback.kind === "referencia" ? "referencia" : fallback.kind,
      reason: "Sitio protegido: no pude leer el contenido. Revisalo a mano.",
      relevance_reason: "No se pudo verificar por el bloqueo anti-bot.",
    };
  }

  if (!llmConfig()) return fallback;

  try {
    const { json } = await chatJson<{
      kind: string;
      confidence: number;
      reason: string;
      relevant: boolean;
      relevance_reason: string;
    }>(
      `Clasificás links que un emprendedor guarda desde LinkedIn/Instagram/web. Devolvés SOLO JSON.
Categorías:
- "convocatoria": llamados a postular con beneficios (aceleradora, premio, fondo, concurso, beca, grant). Señales: bases y condiciones, requisitos de elegibilidad, formulario de postulación, fecha de cierre.
- "aceleradora": programa de aceleración/incubación con mentoría, red o capital (aunque no invierta). Señales: cohorte, batch, demo day, mentores, programa de aceleración.
- "evento": encuentro para asistir (congreso, feria, webinar, jornada, hackathon, meetup). Señales: fecha del evento, sede, entradas, agenda, disertantes, call for speakers.
- "competidor": producto o servicio que compite con la startup (evaluación formativa con IA, edtech para docentes/escuelas). Señales: planes y precios, demo, funcionalidades, clientes.
- "inversor": fondo de VC, ángel o aceleradora con capital que podría invertir en la startup. Señales: portfolio, tesis, ticket, etapas, geografías, "invertimos en".
- "referencia": nota, artículo, opinión, noticia, recurso o ruido. No es una oportunidad ni un competidor.

Regla clave: si hay que POSTULAR para obtener algo (plata, mentoría, premio) es "convocatoria", aunque se anuncie en un evento. Si el propósito principal es ASISTIR o exponer, es "evento". Si vende un producto que compite, es "competidor".

Además, en "relevant" decí si el link tiene que ver con el NEGOCIO de la startup o su ecosistema: educación, edtech, IA aplicada, escuelas, docentes, startups, emprendimiento, inversión/VC, aceleradoras, fondos, políticas educativas, LatAm.
- Un fondo de inversión o el sitio de un VC es RELEVANTE (es la vertical de financiamiento), aunque no tenga postulación abierta.
- Una home corporativa de una industria no relacionada (bebidas, retail, deportes) NO es relevante.
- Un perfil personal de alguien del sector educativo es relevante.

Devolvé: {"kind":"convocatoria|evento|competidor|inversor|referencia","confidence":0-1,"reason":"máximo 20 palabras","relevant":true|false,"relevance_reason":"máximo 15 palabras"}`,
      `URL: ${input.url}
TEXTO PEGADO POR EL USUARIO:
${input.pasted.slice(0, 3000) || "(vacío)"}

PREVIEW DEL SITIO:
${input.preview.slice(0, 3000) || "(no se pudo leer)"}`,
      { maxTokens: 300 }
    );
    const kind = (["convocatoria", "aceleradora", "evento", "competidor", "inversor", "referencia"] as const).includes(json.kind as Kind)
      ? (json.kind as Kind)
      : fallback.kind;
    // A model that reads "Grant Opportunity Available" and answers "referencia"
    // is simply wrong; the wording is stronger evidence than its judgement.
    const opportunityHit = OPPORTUNITY.exec(`${input.pasted}\n${input.preview}`);
    const finalKind: Kind = opportunityHit && kind !== "competidor" ? "convocatoria" : kind;

    return {
      kind: finalKind,
      confidence:
        finalKind !== kind
          ? Math.max(0.8, typeof json.confidence === "number" ? json.confidence : 0.8)
          : typeof json.confidence === "number"
            ? Math.max(0, Math.min(1, json.confidence))
            : fallback.confidence,
      reason:
        finalKind !== kind
          ? `Menciona una convocatoria explícita ("${opportunityHit![0]}").`.slice(0, 240)
          : (json.reason || fallback.reason).slice(0, 240),
      relevant: typeof json.relevant === "boolean" ? json.relevant : kind !== "referencia" || fallback.relevant,
      relevance_reason: (json.relevance_reason || fallback.relevance_reason).slice(0, 200),
    };
  } catch {
    return fallback;
  }
}

export { KIND_LABEL };
