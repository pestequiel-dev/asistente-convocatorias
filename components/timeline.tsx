"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, Rows3 } from "lucide-react";
import type { Program } from "@/lib/types";
import { KIND_META } from "./kind-body";
import { fmtDate, daysUntil, PIPELINE, PIPELINE_INVESTOR } from "./format";

export const TZ_AR = "America/Argentina/Buenos_Aires";

interface Group {
  key: string;
  label: string;
  sortKey: number;
  items: Program[];
  past: boolean;
}

const WEEKDAY = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: TZ_AR });
const MONTH = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: TZ_AR });

function parts(iso: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ_AR,
  });
  const [y, m, day] = fmt.format(d).split("-").map(Number);
  return { y, m, day, date: d };
}

function monthLabel(iso: string) {
  const s = MONTH.format(new Date(iso)).replace(/ de /g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupItems(items: Program[]): Group[] {
  const now = Date.now();
  const groups = new Map<string, Group>();

  for (const p of items) {
    if (!p.closing_at) continue;
    const { y, m } = parts(p.closing_at);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!groups.has(key)) {
      groups.set(key, { key, label: monthLabel(p.closing_at), sortKey: y * 100 + m, items: [], past: false });
    }
    groups.get(key)!.items.push(p);
  }

  const list = [...groups.values()];
  list.forEach((g) => {
    g.items.sort((a, b) => +new Date(a.closing_at!) - +new Date(b.closing_at!));
    // A month is "past" only when every item in it is already gone.
    g.past = g.items.every((p) => new Date(p.closing_at!).getTime() < now - 86_400_000);
  });

  const upcoming = list.filter((g) => !g.past).sort((a, b) => a.sortKey - b.sortKey);
  const past = list.filter((g) => g.past).sort((a, b) => b.sortKey - a.sortKey);
  return [...upcoming, ...past];
}

function countdownLabel(p: Program) {
  const d = daysUntil(p.closing_at);
  const isEvent = p.kind === "evento";
  const noun = isEvent ? "Evento" : "Cierra";
  if (d === null) return { text: "Sin fecha", tone: "muted" as const };
  if (d < -1) return { text: "Ya pasó", tone: "muted" as const };
  if (d === -1 || d === 0) return { text: isEvent ? "Es hoy" : "Cierra hoy", tone: "red" as const };
  if (d === 1) return { text: `${noun} en 1 día`, tone: "red" as const };
  if (d <= 7) return { text: `${noun} en ${d} días`, tone: "red" as const };
  if (d <= 21) return { text: `${noun} en ${d} días`, tone: "amber" as const };
  return { text: `${noun} en ${d} días`, tone: "green" as const };
}

function TimelineItem({ p }: { p: Program }) {
  const hasDate = !!p.closing_at;
  const { day } = hasDate ? parts(p.closing_at!) : { day: 0 };
  const wd = hasDate ? WEEKDAY.format(new Date(p.closing_at!)).replace(".", "") : "";
  const kind = (p.kind ?? "convocatoria") as keyof typeof KIND_META;
  const meta = KIND_META[kind] ?? KIND_META.referencia;
  const cd = countdownLabel(p);
  const isPast = hasDate && new Date(p.closing_at!).getTime() < Date.now() - 86_400_000;

  // Every item should invite an action, not just describe itself.
  const action =
    p.kind === "evento"
      ? p.applies_url
        ? { label: "Inscribirme", href: p.applies_url }
        : p.contact_url
          ? { label: "Contactar", href: p.contact_url }
          : null
      : p.kind === "inversor"
        ? p.applies_url
          ? { label: "Enviar pitch", href: p.applies_url }
          : p.contact_url
            ? { label: "Contactar", href: p.contact_url }
            : null
        : p.kind === "convocatoria" && p.applies_url
          ? { label: "Postular", href: p.applies_url }
          : p.contact_url
            ? { label: "Contactar", href: p.contact_url }
            : null;

  return (
    <li className={`tl-item is-${p.kind ?? "convocatoria"}${isPast ? " is-past" : ""}`}>
      <div className="tl-date">
        <div className="tl-day">{hasDate ? day : "—"}</div>
        {wd && <div className="tl-wd">{wd}</div>}
      </div>
      <div className="tl-axis" aria-hidden="true">
        <span className="tl-dot" />
      </div>
      <div className="tl-body">
        <div className="tl-title-row">
          <Link href={`/programa/${p.id}`} className="tl-title">
            {p.title || p.url}
          </Link>
        </div>
        <div className="tl-meta">
          <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
          {(() => {
            const state = (p.kind === "inversor" ? PIPELINE_INVESTOR : PIPELINE)[p.pipeline_status];
            return state ? <span className={`badge badge-${state.tone}`}>{state.label}</span> : null;
          })()}
          {!p.kind_confirmed && <span className="badge badge-amber">Sin confirmar</span>}
          <span className={`tl-cd tone-${cd.tone}`}>{cd.text}</span>
          {p.organization && <span className="tl-org">{p.organization}</span>}
          {p.eligibility_score != null && p.kind === "convocatoria" && (
            <span className="tl-org">Elegibilidad {p.eligibility_score}%</span>
          )}
          {p.relevance_score != null && p.kind === "evento" && (
            <span className="tl-org">Relevancia {p.relevance_score}%</span>
          )}
          {action && (
            <a
              className="tl-cta"
              href={action.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${action.label}: ${p.title ?? p.url}`}
            >
              {action.label} ↗
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function Timeline({ programs, fill = false }: { programs: Program[]; fill?: boolean }) {
  const groups = useMemo(() => groupItems(programs), [programs]);
  const undated = useMemo(() => programs.filter((p) => !p.closing_at), [programs]);

  if (!groups.length && !undated.length) {
    return (
      <div className="empty">
        <CalendarDays size={22} style={{ color: "var(--accent)" }} />
        <h3>No hay nada con fecha</h3>
        <p className="small" style={{ maxWidth: 460 }}>
          La línea de tiempo muestra convocatorias y eventos con fecha de cierre o de realización. Los
          competidores y las referencias quedan en la vista de tabla.
        </p>
      </div>
    );
  }

  return (
    <div className={`timeline${fill ? " is-fill" : ""}`}>
      <div className="tl-toolbar">
        <p className="small muted" style={{ maxWidth: 620 }}>
          Ordenadas por fecha, de lo más próximo a lo más lejano.
        </p>
      </div>

      <div className="tl-scroll">
      <div className="tl-today">
        <span className="tl-today-label">Hoy</span>
        <span className="tl-today-date">{fmtDate(new Date().toISOString())}</span>
      </div>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`m-${g.key}`}>
          <h3
            id={`m-${g.key}`}
            className={`tl-month${g.past ? " is-past" : ""}`}
            aria-label={`${g.label}${g.past ? " (ya pasó)" : ""}`}
          >
            {g.label}
            {g.past && <span className="tl-past-tag" aria-hidden="true">ya pasó</span>}
          </h3>

          <ol className="tl-list">
            {g.items.map((p) => (
              <TimelineItem key={p.id} p={p} />
            ))}
          </ol>
        </section>
      ))}

      {undated.length > 0 && (
        <section aria-labelledby="m-sin-fecha">
          <h3 id="m-sin-fecha" className="tl-month is-past">
            Sin fecha
          </h3>
          <ol className="tl-list">
            {undated.map((p) => (
              <TimelineItem key={p.id} p={p} />
            ))}
          </ol>
        </section>
      )}
      </div>
    </div>
  );
}

export function ViewToggle({ value, onChange }: { value: "timeline" | "table"; onChange: (v: "timeline" | "table") => void }) {
  return (
    <div className="row" role="group" aria-label="Vista" style={{ gap: 4 }}>
      <button
        type="button"
        className={`chip${value === "timeline" ? " active" : ""}`}
        onClick={() => onChange("timeline")}
        aria-pressed={value === "timeline"}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38 }}
      >
        <CalendarDays size={15} /> Línea de tiempo
      </button>
      <button
        type="button"
        className={`chip${value === "table" ? " active" : ""}`}
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38 }}
      >
        <Rows3 size={15} /> Tabla
      </button>
    </div>
  );
}
