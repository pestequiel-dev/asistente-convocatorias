export const TZ = "America/Argentina/Buenos_Aires";

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: TZ,
  }).format(d);
}

export function fmtDateTime(iso: string | null | undefined) {
  return fmtDate(iso, true);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

export function countdown(iso: string | null | undefined) {
  const d = daysUntil(iso);
  if (d === null) return { text: "Sin fecha", tone: "gray" as const };
  if (d < 0) return { text: "Cerrada", tone: "gray" as const };
  if (d === 0) return { text: "Cierra hoy", tone: "red" as const };
  if (d <= 3) return { text: `${d} días`, tone: "red" as const };
  if (d <= 10) return { text: `${d} días`, tone: "amber" as const };
  return { text: `${d} días`, tone: "green" as const };
}

export const PIPELINE: Record<string, { label: string; tone: string }> = {
  idea: { label: "Guardada", tone: "gray" },
  reviewing: { label: "En revisión", tone: "blue" },
  eligible: { label: "Elegible", tone: "green" },
  not_eligible: { label: "No elegible", tone: "red" },
  applying: { label: "Aplicando", tone: "amber" },
  applied: { label: "Aplicada", tone: "teal" },
  won: { label: "Ganada", tone: "green" },
  lost: { label: "Perdida", tone: "gray" },
};

export const VERDICT: Record<string, { label: string; tone: string }> = {
  eligible: { label: "Elegible", tone: "green" },
  not_eligible: { label: "No elegible", tone: "red" },
  needs_info: { label: "Faltan datos", tone: "amber" },
  unknown: { label: "Sin evaluar", tone: "gray" },
};

export const CRITERION: Record<string, { icon: string; tone: string; label: string }> = {
  cumple: { icon: "✓", tone: "green", label: "Cumple" },
  no_cumple: { icon: "✕", tone: "red", label: "No cumple" },
  falta_dato: { icon: "?", tone: "amber", label: "Falta dato" },
  ambiguo: { icon: "≈", tone: "gray", label: "Ambiguo" },
  no_aplica: { icon: "–", tone: "gray", label: "No aplica" },
};

export function toneClass(tone: string) {
  return `badge badge-${tone}`;
}

export function scoreColor(score: number | null | undefined) {
  if (score == null) return "var(--muted)";
  if (score >= 75) return "var(--ok)";
  if (score >= 45) return "var(--warn)";
  return "var(--danger)";
}
