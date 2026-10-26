export const STATUS_LABEL: Record<string, string> = {
  idea: "Guardada",
  reviewing: "En revisión",
  eligible: "Elegible",
  not_eligible: "No elegible",
  applying: "Aplicando",
  applied: "Enviada",
  won: "Ganada",
  lost: "Perdida",
  closed: "Cerrada",
};

export function statusLabel(code: string): string {
  return STATUS_LABEL[code] ?? code;
}
