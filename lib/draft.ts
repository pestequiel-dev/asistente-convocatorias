import { chatJson, llmConfig } from "./llm";
import type { Criterion, Profile, Program } from "./types";

export interface DraftAnswer {
  question: string;
  answer: string;
  missing: string | null;
}

const STANDARD_EN = [
  "What problem do you solve?",
  "How do you solve it? Describe the product.",
  "What traction do you have today?",
  "Who are your customers and how do you make money?",
  "Who is the team and why are you the right people?",
  "What is the market and why now?",
  "What would you use the funding or the program's support for?",
  "Why this program in particular?",
];

const STANDARD = [
  "¿Cuál es el problema que resuelven?",
  "¿Cómo lo resuelven? Describí el producto.",
  "¿Qué tracción tienen hoy?",
  "¿Quiénes son sus clientes y cómo ganan dinero?",
  "¿Cómo es el equipo y por qué es el indicado?",
  "¿Cuál es el mercado y por qué ahora?",
  "¿Para qué usarían el financiamiento o el apoyo del programa?",
  "¿Por qué este programa en particular?",
];

export async function generateDraft(
  program: Program,
  profile: Profile,
  docs: { label: string; content: string | null }[],
  criteria: Criterion[],
  language: "es" | "en" = "es",
  formQuestions: string[] = []
): Promise<DraftAnswer[]> {
  if (!llmConfig()) throw new Error("Configurá DeepSeek en Ajustes para generar el borrador.");

  const context = docs
    .filter((d): d is { label: string; content: string } => !!d.content)
    .map((d) => `— ${d.label}:\n${d.content.slice(0, 1800)}`)
    .join("\n\n")
    .slice(0, 9000);

  const questions = formQuestions.length
    ? formQuestions
    : criteria.length > 0
      ? criteria.slice(0, 12).map((c) => c.text)
      : [];

  const { json } = await chatJson<{ answers: { question: string; answer: string; missing?: string }[] }>(
    `${language === "en"
      ? "You are the project's founder writing application answers, in English, first person, direct and concrete tone."
      : "Sos el fundador del proyecto escribiendo respuestas de postulación, en español rioplatense, primera persona, tono directo y concreto."}
IDIOMA OBLIGATORIO: ${language === "en" ? "inglés (todas las preguntas y respuestas)" : "español rioplatense"}. Si el programa está en inglés, TODO va en inglés.
REGLAS:
- Usá SOLO la información del perfil, los hitos y los documentos. NUNCA inventes métricas, clientes, fechas ni montos.
- Si un dato necesario no está, escribí literalmente "[FALTA: qué dato]" dentro de la respuesta en vez de rellenar.
- Si el perfil trae "market_size", "market_plan" o "traction_metrics", usá esos textos tal cual para mercado, expansión y tracción: no los reemplaces ni los marques como faltantes.
- Cada respuesta: 110 a 170 palabras. Sin adjetivos vacíos, sin "somos apasionados". Hechos y decisiones.
- Si hay una aplicación anterior entre los documentos, imitá su tono, su estructura y su nivel de detalle.
- La última respuesta debe conectar con lo que este programa busca específicamente.
Devolvés SOLO JSON: {"answers":[{"question":"...","answer":"...","missing":"dato que falta o null"}]}`,
    `EMPRESA:
${JSON.stringify(profile, null, 2)}

PROGRAMA AL QUE POSTULA:
- Nombre: ${program.title ?? ""}
- Organización: ${program.organization ?? ""}
- Tipo: ${program.type ?? ""}
- Qué ofrece: ${program.funding ?? ""}
- Resumen: ${program.summary ?? ""}
- Requisitos extraídos: ${questions.slice(0, 10).join(" | ")}
- Documentos que piden: ${program.docs_required ?? "[]"}

DOCUMENTOS E HITOS:
${context || "(sin documentos cargados)"}

${formQuestions.length
      ? `PREGUNTAS EXACTAS DEL FORMULARIO (respondé estas, en este orden, copiando el texto tal cual):\n${formQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : `PREGUNTAS SUGERIDAS (usalas si no hay mejores):\n${(language === "en" ? STANDARD_EN : STANDARD).join("\n")}`}`,
    { maxTokens: 4500 }
  );

  const answers = (json.answers ?? [])
    .map((a) => ({
      question: String(a.question ?? "").slice(0, 200),
      answer: String(a.answer ?? "").slice(0, 3000),
      missing: a.missing ? String(a.missing).slice(0, 120) : null,
    }))
    .filter((a) => a.question && a.answer);

  if (!answers.length) throw new Error("El modelo no devolvió respuestas. Probá de nuevo.");
  return answers;
}
