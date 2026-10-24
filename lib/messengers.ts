import type { Messenger } from "./types";
import { chatJson, llmConfig } from "./llm";

export interface RankedMessenger {
  id: number;
  fit: number;
  reason: string;
  message: string;
}

export interface SelectionResult {
  brief: string;
  results: (Messenger & { fit: number; reason: string; message: string })[];
  cost_usd: number;
  reach: number;
  cpm: number | null;
  mode: "llm" | "heuristic";
  warning?: string;
}

const STOP = new Set(
  "de la el los las un una y o que en para con por del al se es son como más sobre entre desde hasta".split(" ")
);

function words(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function heuristicRank(brief: string, list: Messenger[]): RankedMessenger[] {
  const bw = new Set(words(brief));
  return list
    .map((m) => {
      const mw = new Set(words(`${m.topics ?? ""} ${m.audience ?? ""} ${m.role ?? ""} ${m.organization ?? ""}`));
      let overlap = 0;
      for (const w of mw) if (bw.has(w)) overlap++;
      let fit = Math.min(70, overlap * 18);
      if (m.status === "publico" || m.status === "acuerdo") fit += 15;
      if (m.status === "interesado" || m.status === "negociando") fit += 10;
      if (m.audience_size && m.audience_size > 5000) fit += 5;
      return {
        id: m.id,
        fit: Math.max(0, Math.min(100, fit)),
        reason: overlap
          ? `Coincide en ${overlap} tema(s) con el brief.`
          : "Sin coincidencia temática detectada (modo heurístico).",
        message: "",
      };
    })
    .sort((a, b) => b.fit - a.fit);
}

export async function selectMessengers(brief: string, list: Messenger[]): Promise<SelectionResult> {
  const empty = { cost_usd: 0, reach: 0, cpm: null as number | null };

  if (!list.length) return { brief, results: [], ...empty, mode: "heuristic" };

  const finish = (ranked: RankedMessenger[], mode: "llm" | "heuristic", warning?: string): SelectionResult => {
    const byId = new Map(list.map((m) => [m.id, m]));
    const results = ranked
      .map((r) => {
        const m = byId.get(r.id);
        return m ? { ...m, fit: r.fit, reason: r.reason, message: r.message } : null;
      })
      .filter((x): x is Messenger & { fit: number; reason: string; message: string } => !!x);

    const cost = results.reduce((a, m) => a + (m.rate_usd ?? 0), 0);
    const reach = results.reduce((a, m) => a + (m.audience_size ?? 0), 0);
    return {
      brief,
      results,
      cost_usd: Math.round(cost),
      reach,
      cpm: reach > 0 && cost > 0 ? Number(((cost / reach) * 1000).toFixed(2)) : null,
      mode,
      warning,
    };
  };

  if (!llmConfig()) {
    return finish(heuristicRank(brief, list).slice(0, 5), "heuristic", "Sin DeepSeek: ranking por coincidencia de palabras.");
  }

  try {
    const payload = list.slice(0, 60).map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      org: m.organization,
      platform: m.platform,
      audience: m.audience,
      reach: m.audience_size,
      topics: m.topics,
      rate_usd: m.rate_usd,
      status: m.status,
    }));

    const { json } = await chatJson<{ results: { id: number; fit: number; reason: string; message: string }[] }>(
      `Sos estratega de comunicación de Mehmiro, una startup edtech argentina: asistente de IA pedagógico que analiza observaciones docentes y genera evaluaciones formativas. Vende a escuelas, colegios y docentes de Argentina y LatAm.

Te doy un BRIEF (un tema, lanzamiento u oportunidad) y una lista de CONTACTOS que podrían hablar de Mehmiro.
Elegí los 5 mejores y devolvé SOLO JSON:
{"results":[{"id":number,"fit":0-100,"reason":"por qué encaja, 1 frase concreta","message":"primer mensaje personalizado, máximo 60 palabras, tono humano, sin plantilla"}]}

Reglas:
- Priorizá afinidad temática y audiencia escolar/docente.
- Sumá puntos si ya publicó o tiene acuerdo; restá si está descartado.
- Considerá el costo: si dos encajan igual, preferí el más barato.
- El mensaje debe mencionar algo específico de esa persona, no genérico.`,
      `BRIEF: ${brief}\n\nCONTACTOS:\n${JSON.stringify(payload)}`,
      { maxTokens: 2500 }
    );

    const ranked = (json.results ?? [])
      .filter((r) => typeof r.id === "number")
      .map((r) => ({
        id: r.id,
        fit: Math.max(0, Math.min(100, Number(r.fit) || 0)),
        reason: (r.reason || "").slice(0, 300),
        message: (r.message || "").slice(0, 900),
      }))
      .slice(0, 5);

    return finish(ranked, "llm");
  } catch (e) {
    return finish(heuristicRank(brief, list).slice(0, 5), "heuristic", `Falló DeepSeek (${(e as Error).message.slice(0, 120)}). Ranking heurístico.`);
  }
}
