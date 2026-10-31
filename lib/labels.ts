export const STATUS_LABEL: Record<string, string> = {
  idea: "Guardada",
  reviewing: "En revisión",
  eligible: "Elegible",
  not_eligible: "No elegible",
  applying: "Aplicando",
  applied: "Enviada",
  replied: "Contestaron",
  shortlisted: "Preseleccionada",
  interview: "Entrevista",
  diligence: "Due diligence",
  negotiating: "Negociación",
  won: "Ganada",
  lost: "Perdida",
  closed: "Cerrada",
  discarded: "Descartada",
};

export function statusLabel(code: string): string {
  return STATUS_LABEL[code] ?? code;
}
