import { chatJson } from "./llm";
import type { Profile, Program } from "./types";

export type EmailDraft = { subject: string; body: string };

/** A short cold email to a fund that asks for "your deck or blurb". */
export async function generateEmail(
  program: Program,
  profile: Profile,
  docs: { label: string; content: string | null }[],
  language: "es" | "en"
): Promise<EmailDraft> {
  const links = [
    profile.url ? `Sitio: ${profile.url}` : "",
    profile.linkedin ? `LinkedIn fundador: ${profile.linkedin}` : "",
    profile.deck_url ? `Deck: ${profile.deck_url}` : "",
    ...docs.filter((d) => /deck|pitch|presentaci/i.test(d.label) && !profile.deck_url).map((d) => `Deck: ${d.label}`),
  ]
    .filter(Boolean)
    .join("\n");

  const { json } = await chatJson<EmailDraft>(
    `Escribís emails de founders a fondos de inversión. Devolvés JSON {"subject": "...", "body": "..."}.
IDIOMA OBLIGATORIO: ${language === "en" ? "INGLÉS. Aunque el perfil y los documentos estén en español, el email va en inglés." : "español rioplatense"}. Tono directo, sin adjetivos vacíos.
El cuerpo va en texto plano con saltos de línea, entre 110 y 150 palabras. No inventes datos: si falta el monto de la ronda, escribí [FALTA: monto de la ronda].`,
    `Fondo: ${program.organization ?? program.title}
Tesis: ${program.summary ?? ""}
El fondo pide: "enviá tu deck o blurb con los detalles de tu ronda".

Startup: ${profile.name}
Qué hace: ${profile.description}
Etapa: ${profile.stage}
Clientes: ${profile.customers ?? "?"}
Equipo: ${profile.team_size ?? "?"} personas
País: ${profile.country}
Ronda: ${profile.round_details || "(sin datos)"}

Links disponibles:
${links || "(ninguno)"}

Escribí el email como ${profile.founder_name || "el fundador"}.
Incluí: una línea de qué hace Mehmiro, una de tracción, los detalles de la ronda (${profile.round_details || "[FALTA: monto de la ronda]"}), y los links que existan.
Cerrá con una pregunta simple.`,
    { maxTokens: 1200, temperature: 0.4 }
  );

  return {
    subject: (json.subject ?? "").slice(0, 160),
    body: (json.body ?? "").slice(0, 2500),
  };
}
