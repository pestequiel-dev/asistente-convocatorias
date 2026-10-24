"use client";

import { CalendarClock, MapPin, Ticket, Users, Mic, Store, Sparkles } from "lucide-react";
import type { Program } from "@/lib/types";
import type { CompetitorExtraction, EventExtraction, InvestorExtraction } from "@/lib/extract-kind";
import { fmtDate } from "./format";

export const KIND_META: Record<string, { label: string; tone: string; icon: string }> = {
  convocatoria: { label: "Convocatoria", tone: "teal", icon: "◆" },
  evento: { label: "Evento", tone: "blue", icon: "◈" },
  competidor: { label: "Competidor", tone: "amber", icon: "◉" },
  inversor: { label: "Inversor", tone: "blue", icon: "◎" },
  referencia: { label: "Referencia", tone: "gray", icon: "○" },
};

export function parseMeta<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid #f0efeb" }}>
      <span style={{ color: "var(--muted)", marginTop: 2, flex: "none" }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="tiny muted">{label}</div>
        <div style={{ fontWeight: 500, lineHeight: 1.45 }}>{value}</div>
      </div>
    </div>
  );
}

export function EventBody({ program }: { program: Program }) {
  const e = parseMeta<EventExtraction>(program.meta);
  if (!e) return <p className="muted small">No hay datos estructurados del evento.</p>;

  return (
    <section className="card">
      <div className="panel-head">
        <h2>Datos del evento</h2>
        {program.relevance_score != null && (
          <span className={`badge ${program.relevance_score >= 60 ? "badge-green" : program.relevance_score >= 35 ? "badge-amber" : "badge-gray"}`}>
            Relevancia {program.relevance_score}%
          </span>
        )}
      </div>
      <div className="panel-body" style={{ paddingTop: 6 }}>
        <Row icon={<CalendarClock size={14} />} label="Fecha del evento" value={e.event_date ? fmtDate(e.event_date, true) : null} />
        <Row icon={<CalendarClock size={14} />} label="Cierre de inscripción" value={e.registration_deadline ? fmtDate(e.registration_deadline, true) : null} />
        <Row icon={<MapPin size={14} />} label="Sede" value={[e.venue, e.city, e.country].filter(Boolean).join(" · ") || null} />
        {e.access_note && (
          <div className="row" style={{ marginTop: 8, gap: 6 }}>
            <span className={`badge ${/requiere viaje|fuera de la regi/i.test(e.access_note) ? "badge-amber" : "badge-green"}`}>
              {e.access_note}
            </span>
          </div>
        )}
        <Row icon={<Sparkles size={14} />} label="Formato" value={e.format} />
        <Row icon={<Ticket size={14} />} label="Costo" value={e.cost} />
        <Row icon={<Users size={14} />} label="Audiencia" value={e.audience} />
        <Row icon={<Mic size={14} />} label="Call for speakers" value={e.call_for_speakers} />
        <Row icon={<Store size={14} />} label="Stands / auspicios" value={e.stand_opportunity} />

        {e.relevance_signals.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="label" style={{ marginBottom: 6 }}>Por qué te puede servir</div>
            <ul className="small" style={{ margin: 0, paddingLeft: 17, display: "grid", gap: 5, color: "var(--text-2)" }}>
              {e.relevance_signals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function CompetitorBody({ program }: { program: Program }) {
  const c = parseMeta<CompetitorExtraction>(program.meta);
  if (!c) return <p className="muted small">No hay datos estructurados del competidor.</p>;

  return (
    <>
      <section className="card">
        <div className="panel-head">
          <h2>Lectura competitiva</h2>
        </div>
        <div className="panel-body" style={{ paddingTop: 8 }}>
          <Row icon={<Users size={14} />} label="A quién le vende" value={c.target_customer} />
          <Row icon={<Sparkles size={14} />} label="Segmento" value={c.segment} />
          <Row icon={<MapPin size={14} />} label="País" value={c.country} />
          {c.positioning && (
            <div style={{ marginTop: 12 }}>
              <div className="label" style={{ marginBottom: 4 }}>Posicionamiento</div>
              <p className="small" style={{ lineHeight: 1.55 }}>{c.positioning}</p>
            </div>
          )}

          {c.pricing.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>Precios</div>
              <div className="table-wrap" style={{ boxShadow: "none" }}>
                <table className="table">
                  <thead>
                    <tr><th>Plan</th><th>Precio</th><th>Notas</th></tr>
                  </thead>
                  <tbody>
                    {c.pricing.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{p.plan}</td>
                        <td className="nowrap">{p.price}</td>
                        <td className="muted small">{p.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {c.key_features.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="label" style={{ marginBottom: 6 }}>Funcionalidades</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {c.key_features.map((f, i) => (
                  <span key={i} className="badge badge-gray">{f}</span>
                ))}
              </div>
            </div>
          )}

          {(c.strengths.length > 0 || c.weaknesses.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
              <div>
                <div className="label" style={{ marginBottom: 5, color: "var(--ok)" }}>Fortalezas</div>
                <ul className="small" style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
                  {c.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  {!c.strengths.length && <li className="muted">—</li>}
                </ul>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 5, color: "var(--danger)" }}>Debilidades</div>
                <ul className="small" style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
                  {c.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                  {!c.weaknesses.length && <li className="muted">—</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      {program.diff_summary && (
        <section className="card">
          <div className="panel-head">
            <h2>Cambios desde la última revisión</h2>
            <span className="tiny muted">{program.diff_at ? fmtDate(program.diff_at, true) : ""}</span>
          </div>
          <div className="panel-body">
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "var(--mono)",
                fontSize: "calc(12px * var(--fs))",
                lineHeight: 1.65,
                color: "var(--text-2)",
              }}
            >
              {program.diff_summary}
            </pre>
          </div>
        </section>
      )}
    </>
  );
}

export function InvestorBody({ program }: { program: Program }) {
  const inv = parseMeta<InvestorExtraction>(program.meta);
  if (!inv) return <p className="muted small">No hay datos estructurados del inversor.</p>;

  // Older records stored plain strings; normalise both shapes.
  const rawPortfolio = (inv.portfolio ?? (inv as unknown as { portfolio_highlights?: unknown[] }).portfolio_highlights ?? []) as unknown[];
  const portfolio = rawPortfolio
    .map((x) =>
      typeof x === "string"
        ? { name: x, url: null as string | null }
        : { name: String((x as { name?: string })?.name ?? ""), url: (x as { url?: string })?.url ?? null }
    )
    .filter((x) => x.name);

  return (
    <section className="card">
      <div className="panel-head">
        <h2>Ficha del inversor</h2>
        <span className={`badge ${inv.invests_latam ? "badge-green" : "badge-gray"}`}>
          {inv.invests_latam ? "Invierte en LatAm" : "LatAm sin confirmar"}
        </span>
      </div>
      <div className="panel-body" style={{ paddingTop: 6 }}>
        <Row icon={<MapPin size={14} />} label="Geografías" value={inv.geographies.join(", ") || inv.country} />
        <Row icon={<Sparkles size={14} />} label="Etapas" value={inv.stages.join(", ")} />
        <Row icon={<Ticket size={14} />} label="Ticket" value={inv.ticket} />
        <Row icon={<Users size={14} />} label="Foco sectorial" value={inv.sector_focus.join(", ")} />
        {inv.thesis && (
          <div style={{ marginTop: 12 }}>
            <div className="label" style={{ marginBottom: 4 }}>Tesis</div>
            <p className="small" style={{ lineHeight: 1.55 }}>{inv.thesis}</p>
          </div>
        )}
        {portfolio.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="label" style={{ marginBottom: 6 }}>Portfolio</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {portfolio.map((x, i) =>
                x.url ? (
                  <a
                    key={i}
                    className="badge badge-gray pf-chip"
                    href={x.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${x.name}`}
                  >
                    {x.name} ↗
                  </a>
                ) : (
                  <span key={i} className="badge badge-gray">{x.name}</span>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ReferenceBody({ program }: { program: Program }) {
  const sameText = program.summary && program.kind_reason && program.summary.trim() === program.kind_reason.trim();
  return (
    <section className="card">
      <div className="panel-head">
        <h2>Referencia</h2>
        <span className="badge badge-gray">contexto</span>
      </div>
      <div className="panel-body">
        <p className="small" style={{ lineHeight: 1.6 }}>
          {program.summary || "Sin resumen disponible."}
        </p>
        {program.kind_reason && !sameText && (
          <div className="quote" style={{ marginTop: 10 }}>{program.kind_reason}</div>
        )}
        <p className="tiny muted" style={{ marginTop: 12 }}>
          Se archivó como contexto: no es una postulación abierta ni un evento, así que no se analizó
          elegibilidad. Podés borrarla con el tacho de arriba.
        </p>
      </div>
    </section>
  );
}
