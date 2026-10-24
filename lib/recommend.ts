import type { Criterion, Program } from "./types";

export interface RecPoint {
  kind: "block" | "pending" | "ok";
  text: string;
  reason: string | null;
}

export interface Recommendation {
  tone: "green" | "amber" | "red" | "gray";
  title: string;
  body: string;
  points: RecPoint[];
}

const DATE_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : DATE_FMT.format(d);
}

function daysTo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return isNaN(ms) ? null : Math.ceil(ms / 86_400_000);
}

function deadlineSentence(iso: string | null | undefined): string {
  const d = daysTo(iso);
  if (d === null) return "";
  if (d < 0) return " El plazo ya venció.";
  if (d === 0) return " Cierra hoy.";
  if (d === 1) return " Cierra mañana.";
  if (d <= 10) return ` Cierra en ${d} días.`;
  return "";
}

export function buildRecommendation(p: Program, criteria: Criterion[]): Recommendation | null {
  if (p.kind === "evento") return eventRecommendation(p);
  if (p.kind !== "convocatoria") return null;

  if (!criteria.length) {
    return {
      tone: "gray",
      title: "No pude evaluar la elegibilidad",
      body:
        "No se extrajeron requisitos explícitos de las bases. Puede que estén en un PDF protegido, detrás de un login o que el sitio no los publique. Revisá las fuentes antes de decidir.",
      points: [],
    };
  }

  const applicable = criteria.filter((c) => c.verdict !== "no_aplica");
  const blocking = applicable.filter((c) => c.verdict === "no_cumple");
  const pending = applicable.filter((c) => c.verdict === "falta_dato" || c.verdict === "ambiguo");
  const ok = applicable.filter((c) => c.verdict === "cumple");
  const notApplicable = criteria.length - applicable.length;
  const deadline = deadlineSentence(p.closing_at);
  const days = daysTo(p.closing_at);

  // A closed call is the most actionable thing to say first.
  if (days !== null && days < 0) {
    const toFix = [...blocking.map((c) => ({ kind: "block" as const, text: c.text, reason: c.reason })),
                   ...pending.map((c) => ({ kind: "pending" as const, text: c.text, reason: c.reason }))].slice(0, 4);
    const body = toFix.length
      ? `Cerró el ${fmtDate(p.closing_at)}. Si te interesa para la próxima edición, esto es lo que conviene resolver antes${
          blocking.length ? `: hay ${blocking.length} requisito${blocking.length === 1 ? "" : "s"} que no cumplís` : ""
        }.`
      : `Cerró el ${fmtDate(p.closing_at)}. Si te interesa para la próxima edición, guardala: cumplías los requisitos evaluados.`;
    return { tone: "gray", title: "El plazo ya venció", body, points: toFix };
  }

  if (blocking.length) {
    return {
      tone: "red",
      title: "No te recomiendo aplicar",
      body: `No cumplís ${blocking.length} de ${applicable.length} requisitos${
        pending.length ? `, y otros ${pending.length} quedaron sin verificar` : ""
      }.${deadline} Salvo que puedas cambiar la condición que falla, el esfuerzo de postular se pierde.`,
      points: blocking.slice(0, 4).map((c) => ({ kind: "block", text: c.text, reason: c.reason })),
    };
  }

  if (pending.length) {
    return {
      tone: "amber",
      title: "Revisá antes de aplicar",
      body: `Cumplís ${ok.length} de ${applicable.length} requisitos, pero ${pending.length} ${
        pending.length === 1 ? "quedó" : "quedaron"
      } sin verificar.${deadline} No está claro que quedes afuera: falta confirmar estos puntos.`,
      points: pending.slice(0, 4).map((c) => ({ kind: "pending", text: c.text, reason: c.reason })),
    };
  }

  return {
    tone: "green",
    title: "Te recomiendo aplicar",
    body: `Cumplís los ${applicable.length} requisitos detectados${
      notApplicable
        ? ` (${notApplicable === 1 ? "1 no aplica" : `${notApplicable} no aplican`} a tu caso)`
        : ""
    }.${deadline} Revisá igual las fuentes antes de enviar el formulario.`,
    points: [],
  };
}

function eventRecommendation(p: Program): Recommendation {
  const score = p.relevance_score ?? 0;
  const when = p.closing_at ? deadlineSentence(p.closing_at).trim() : "";

  let access = "";
  try {
    access = (JSON.parse(p.meta || "{}") as { access_note?: string }).access_note ?? "";
  } catch {
    access = "";
  }
  const far = /requiere viaje internacional|fuera de la regi[oó]n/i.test(access);

  // An in-person event that needs an international trip is not an action item.
  if (far && score < 60) {
    return {
      tone: "gray",
      title: "No es una acción para ahora",
      body: `${access}${when ? ` ${when}` : ""} La relevancia temática es ${score}%, pero el costo y el viaje no se justifican para esta etapa.`,
      points: [],
    };
  }

  if (score >= 60) {
    return {
      tone: "green",
      title: "Vale la pena ir",
      body: `La relevancia para Mehmiro es alta (${score}%): hay audiencia escolar y señales de que se puede exponer o hacer contactos. ${access} ${when}`.trim(),
      points: [],
    };
  }
  if (score >= 35) {
    return {
      tone: "amber",
      title: "Consideralo, pero no es prioritario",
      body: `Relevancia media (${score}%). Sirve para visibilidad, aunque la audiencia o el costo no están claros. ${when}`.trim(),
      points: [],
    };
  }
  return {
    tone: "gray",
    title: "Baja prioridad",
    body: `Relevancia baja (${score}%) para lo que vende Mehmiro. Probablemente no justifica el tiempo ni la entrada. ${when}`.trim(),
    points: [],
  };
}
