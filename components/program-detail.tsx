"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CalendarClock, Check, ExternalLink, FileText, Mail, RefreshCw,
  Trash2, TriangleAlert, X, HelpCircle, Minus, Database, Sparkles,
} from "lucide-react";
import type { Criterion, KeyDate, Program } from "@/lib/types";
import { CRITERION, PIPELINE, PIPELINE_INVESTOR, VERDICT, countdown, fmtDate, fmtDateTime, scoreColor, toneClass } from "./format";
import { KIND_META, EventBody, CompetitorBody, InvestorBody, ReferenceBody } from "./kind-body";
import { buildRecommendation } from "@/lib/recommend";
import { RecommendationCard } from "./recommendation";
import { EvidenceSection } from "./evidence";
import { DraftPanel } from "./draft-panel";
import { EmailPanel } from "./email-panel";

interface SourceRow {
  id: number;
  url: string;
  title: string | null;
  kind: string;
  depth: number;
  status: string;
  fetched_at: string;
  error: string | null;
  chars: number | null;
}

interface Data {
  program: Program;
  sources: SourceRow[];
  criteria: Criterion[];
  dates: KeyDate[];
}

const STEPS = [
  { key: "queued", label: "En cola" },
  { key: "crawling", label: "Rastreando el sitio" },
  { key: "extracting", label: "Extrayendo datos" },
  { key: "ready", label: "Listo" },
];

function analyzing(p?: Program | null) {
  return !!p && ["queued", "crawling", "extracting"].includes(p.status);
}

export function ProgramDetail({ id }: { id: number }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [slow, setSlow] = useState(false);
  const [altUrl, setAltUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setError("No se encontró la convocatoria.");
      return;
    }
    const json = (await res.json()) as Data;
    setData(json);
    setNotes((prev) => prev || json.program.notes || "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isAnalyzing = analyzing(data?.program);
  useEffect(() => {
    if (!isAnalyzing) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [isAnalyzing, load]);

  // If the analysis takes unusually long, say so instead of spinning silently.
  useEffect(() => {
    setSlow(false);
    if (!isAnalyzing) return;
    const t = setTimeout(() => setSlow(true), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [isAnalyzing]);

  const p = data?.program;
  const kind = p?.kind ?? "convocatoria";
  const isOpp = kind === "convocatoria";
  const isEvent = kind === "evento";
  const isComp = kind === "competidor";
  const isInv = kind === "inversor";
  const isRef = kind === "referencia";
  const criteria = data?.criteria ?? [];
  const rec = p ? buildRecommendation(p, criteria) : null;
  const dates = data?.dates ?? [];
  const sources = data?.sources ?? [];

  const counts = useMemo(() => {
    const c = { cumple: 0, no_cumple: 0, falta_dato: 0, ambiguo: 0, no_aplica: 0 };
    for (const x of criteria) c[(x.verdict as keyof typeof c) ?? "falta_dato"]++;
    return c;
  }, [criteria]);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function reanalyze(kindHint?: string) {
    setBusy(true);
    await fetch(`/api/programs/${id}${kindHint ? `?kind=${kindHint}` : ""}`, { method: "POST" });
    await load();
    setBusy(false);
  }

  async function reevaluate() {
    setBusy(true);
    await fetch(`/api/programs/${id}?action=reevaluate`, { method: "POST" });
    await load();
    setBusy(false);
  }

  async function remove() {
    if (!confirm("¿Eliminar esta convocatoria y toda su evidencia?")) return;
    await fetch(`/api/programs/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function saveNotes() {
    await patch({ notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1800);
  }

  if (error) {
    return (
      <div>
        <Link href="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -9 }}>
          <ArrowLeft /> Volver
        </Link>
        <div className="banner banner-error">{error}</div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="card card-pad" style={{ maxWidth: 600 }}>
        <div className="row muted"><span className="spinner spinner-dark" /> Cargando…</div>
      </div>
    );
  }

  const cd = countdown(p.closing_at);
  const verdict = VERDICT[p.verdict ?? "unknown"] ?? VERDICT.unknown;
  let docs: string[] = [];
  try {
    docs = JSON.parse(p.docs_required || "[]");
  } catch {
    docs = [];
  }

  const stepIndex = STEPS.findIndex((s) => s.key === p.status);

  return (
    <div>
      <Link href="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -9 }}>
        <ArrowLeft /> Volver al panel
      </Link>

      <div className="page-head" style={{ marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ marginBottom: 7 }}>
            <span className={`badge badge-${KIND_META[kind]?.tone ?? "gray"}`}>{KIND_META[kind]?.label ?? kind}</span>
            {p.type && isOpp && <span className="badge badge-teal">{p.type}</span>}
            {p.form_platform && isOpp && <span className="badge badge-gray">{p.form_platform}</span>}
            {isOpp && (
              <span className="badge badge-gray">
                {p.mode === "llm" ? "Análisis con DeepSeek" : "Análisis heurístico"}
              </span>
            )}
            {isOpp && p.eligibility_score != null && (
              <span className={toneClass(verdict.tone)}>
                {verdict.label} · {p.eligibility_score}%
              </span>
            )}
            {isInv && (
              <span className={`badge ${(p.fit_score ?? 0) >= 65 ? "badge-green" : (p.fit_score ?? 0) >= 40 ? "badge-amber" : "badge-gray"}`}>
                Fit {p.fit_score ?? 0}%
              </span>
            )}
            {isEvent && p.relevance_score != null && (
              <span className={`badge ${p.relevance_score >= 60 ? "badge-green" : p.relevance_score >= 35 ? "badge-amber" : "badge-gray"}`}>
                Relevancia {p.relevance_score}%
              </span>
            )}
            {p.pipeline_status === "closed" && (
              <span className="badge badge-gray">{isInv ? "Cerrado" : "Cerrada"}</span>
            )}

            {(isOpp || isInv) && (p.applies_url || p.contact_url) && (
              p.applied_at ? (
                <span className="badge badge-green">Postulación enviada · {fmtDate(p.applied_at)}</span>
              ) : (
                <span className="badge badge-amber">Postulación sin enviar</span>
              )
            )}
            {!p.kind_confirmed && <span className="badge badge-amber">sin confirmar</span>}
            {p.kind_confidence != null && (
              <span className="tiny muted">clasificado al {Math.round(p.kind_confidence * 100)}%</span>
            )}
          </div>
          <h1 style={{ fontSize: "calc(23px * var(--fs))", lineHeight: 1.25 }}>{p.title || p.url}</h1>
          <div className="small muted" style={{ marginTop: 5 }}>
            {p.organization ? `${p.organization} · ` : ""}
            <a href={p.url} target="_blank" rel="noreferrer" className="src-link">
              {p.origin || p.url}
            </a>
          </div>
        </div>
        <div className="actions">
          {isOpp && p.applies_url && (
            <a className="btn btn-primary" href={p.applies_url} target="_blank" rel="noreferrer">
              Ir al formulario <ArrowUpRight size={15} />
            </a>
          )}
          {isOpp && !p.applies_url && p.contact_url && (
            <a className="btn btn-primary" href={p.contact_url} target="_blank" rel="noreferrer">
              Contactar <ArrowUpRight size={15} />
            </a>
          )}
          {isEvent && (
            <a
              className="btn btn-primary"
              href={p.applies_url || p.contact_url || p.url}
              target="_blank"
              rel="noreferrer"
            >
              {p.applies_url ? "Inscribirme" : p.contact_url ? "Contactar organizador" : "Ver evento"}{" "}
              <ArrowUpRight size={15} />
            </a>
          )}
          {isComp && (
            <a className="btn btn-primary" href={p.url} target="_blank" rel="noreferrer">
              Abrir landing <ArrowUpRight size={15} />
            </a>
          )}
          {isInv && (
            <>
              {p.applies_url && (
                <a className="btn btn-primary" href={p.applies_url} target="_blank" rel="noreferrer">
                  Postular / enviar pitch <ArrowUpRight size={15} />
                </a>
              )}
              {!p.applies_url && p.contact_url && (
                <a className="btn btn-primary" href={p.contact_url} target="_blank" rel="noreferrer">
                  Contactar <ArrowUpRight size={15} />
                </a>
              )}
              {!p.applies_url && !p.contact_url && (
                <a className="btn btn-primary" href={p.url} target="_blank" rel="noreferrer">
                  Abrir sitio <ArrowUpRight size={15} />
                </a>
              )}
            </>
          )}
          {isRef && (
            <>
              <a className="btn" href={p.url} target="_blank" rel="noreferrer">
                Abrir sitio <ArrowUpRight size={15} />
              </a>
              <button className="btn btn-danger" onClick={remove} title="Descartar">
                <Trash2 size={14} /> Descartar
              </button>
            </>
          )}
          <button className="btn" onClick={() => reanalyze(kind)} disabled={busy || isAnalyzing}>
            <RefreshCw size={14} className={busy || isAnalyzing ? "pulse" : ""} /> Re-analizar
          </button>
          <button className="btn btn-danger" onClick={remove} title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isAnalyzing && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <div className="row">
              <span className="spinner spinner-dark" />
              <strong>Analizando convocatoria…</strong>
            </div>
            <span className="small muted">{p.pages_crawled ?? 0} páginas relevadas</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {STEPS.slice(0, 3).map((s, i) => (
              <div key={s.key} style={{ flex: 1 }}>
                <div
                  className="progress-track"
                  style={{ height: 6, background: i <= stepIndex ? "var(--accent-soft)" : "#ecebe6" }}
                >
                  <span
                    style={{
                      width: i < stepIndex ? "100%" : i === stepIndex ? "55%" : "0%",
                      background: "var(--accent)",
                    }}
                    className={i === stepIndex ? "pulse" : ""}
                  />
                </div>
                <div className="tiny muted" style={{ marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {slow ? (
            <div className="row-between wrap" style={{ marginTop: 12 }}>
              <p className="small" style={{ color: "var(--warn)", margin: 0 }}>
                Está tardando más de lo normal. Puede haberse cortado: reintentá o revisá el log.
              </p>
              <button className="btn btn-sm" onClick={() => reanalyze(kind)} disabled={busy}>
                <RefreshCw size={13} /> Reintentar
              </button>
            </div>
          ) : (
            <p className="small muted" style={{ marginTop: 12 }}>
              Esto puede tardar 1–3 minutos. Podés dejar la pestaña abierta: se actualiza sola.
            </p>
          )}
        </div>
      )}

      {p.status === "error" && (
        <div className="banner banner-error" style={{ marginBottom: 18 }}>
          <TriangleAlert size={16} style={{ flex: "none", marginTop: 2 }} />
          <div>
            <strong>El análisis falló.</strong> {p.error}
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button className="btn btn-sm" onClick={() => reanalyze(kind)} disabled={busy} style={{ justifySelf: "start" }}>
                <RefreshCw size={13} /> Reintentar
              </button>
              <div>
                <label className="label" htmlFor="alt-url" style={{ display: "block", marginBottom: 6 }}>
                  ¿El sitio se mudó? Pegá la URL que sí funciona
                </label>
                <div className="row wrap" style={{ gap: 8 }}>
                  <input
                    id="alt-url"
                    className="input"
                    style={{ flex: 1, minWidth: 220 }}
                    placeholder="https://comunidad.socialab.com/es"
                    value={altUrl}
                    onChange={(e) => setAltUrl(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy || !altUrl.trim()}
                    onClick={async () => {
                      setBusy(true);
                      await fetch(`/api/programs/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: altUrl.trim() }),
                      });
                      setAltUrl("");
                      await fetch(`/api/programs/${id}`, { method: "POST" });
                      await load();
                      setBusy(false);
                    }}
                  >
                    Analizar esta URL
                  </button>
                </div>
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  Se reemplaza la URL del registro y se vuelve a analizar desde cero.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {p.status === "ready" && p.error && (
        <div className="banner banner-warn" style={{ marginBottom: 18 }}>
          <TriangleAlert size={16} style={{ flex: "none", marginTop: 2 }} />
          <div>{p.error}</div>
        </div>
      )}

      <div className="detail-grid">
        <div className="stack">
          {rec && <RecommendationCard rec={rec} />}
          {isOpp && (
            <EvidenceSection
              criteria={criteria}
              onReevaluate={reevaluate}
              onChanged={load}
              busy={busy}
            />
          )}
          {(isOpp || isInv) && !(!p.applies_url && p.contact && /@/.test(p.contact)) && (
            <DraftPanel
              programId={p.id}
              appliesUrl={p.applies_url}
              contactUrl={p.contact_url}
              appliedAt={p.applied_at}
              onChanged={load}
            />
          )}
          {!p.applies_url && p.contact && /@/.test(p.contact) && (
            <EmailPanel programId={p.id} to={p.contact} />
          )}

          {p.summary && !isRef && (
            <section className="card">
              <div className="panel-head"><h2>Resumen</h2></div>
              <div className="panel-body">
                <p style={{ lineHeight: 1.6 }}>{p.summary}</p>
              </div>
            </section>
          )}

          {isOpp && (
          <section className="card">
            <div className="panel-body">
              <dl className="def-list">
                <dt>Tipo</dt><dd>{p.type || "—"}</dd>
                <dt>Alcance</dt><dd>{p.scope || "—"}</dd>
                <dt>Sector foco</dt><dd>{p.sector_focus || "—"}</dd>
                <dt>Etapa</dt><dd>{p.stage_focus || "—"}</dd>
                <dt>Equity</dt><dd>{p.equity || "—"}</dd>
                <dt>Beneficios</dt><dd>{p.funding || "—"}</dd>
                <dt>Duración</dt><dd>{p.duration || "—"}</dd>
                <dt>Modalidad</dt><dd>{p.modality || "—"}</dd>
                <dt>Idioma</dt><dd>{p.language || "—"}</dd>
                <dt>Contacto</dt><dd>{p.contact || "—"}</dd>
                <dt>Confianza</dt>
                <dd>
                  {p.confidence != null ? `${Math.round(p.confidence * 100)}%` : "—"}
                  {p.confidence != null && p.confidence < 0.5 && (
                    <span className="tiny muted"> · revisá las fuentes antes de confiar</span>
                  )}
                </dd>
              </dl>
            </div>
          </section>
          )}



          {isEvent && <EventBody program={p} />}
          {isComp && <CompetitorBody program={p} />}
          {isInv && <InvestorBody program={p} />}
          {isRef && <ReferenceBody program={p} />}

          {(isOpp || isEvent) && (
          <section className="card">
            <div className="panel-head">
              <h2>Fechas</h2>
            </div>
            <div className="panel-body" style={{ paddingTop: 8 }}>
              {dates.length === 0 ? (
                <p className="muted small">No se detectaron fechas explícitas en las fuentes.</p>
              ) : (
                <div className="stack" style={{ gap: 14 }}>
                  {dates.map((d) => (
                    <div key={d.id} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                      <div
                        className="criterion-icon"
                        style={{ background: d.kind === "closing" ? "var(--danger-soft)" : "#f1f1ee", color: d.kind === "closing" ? "var(--danger)" : "var(--text-2)" }}
                      >
                        <CalendarClock size={13} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row-between">
                          <div style={{ fontWeight: 500 }}>
                            {d.label}
                            {d.kind === "closing" && <span className="badge badge-red" style={{ marginLeft: 8 }}>cierre</span>}
                          </div>
                          <div className="nowrap" style={{ fontWeight: 500 }}>
                            {fmtDate(d.value_iso) || d.value_raw || "—"}
                          </div>
                        </div>
                        {d.value_raw && d.value_iso && (
                          <div className="tiny muted" style={{ marginTop: 2 }}>Texto original: “{d.value_raw}”</div>
                        )}
                        {d.quote && <div className="quote" style={{ marginTop: 7 }}>“{d.quote}”</div>}
                        {d.source_url && (
                          <a href={d.source_url} target="_blank" rel="noreferrer" className="tiny src-link">
                            ver fuente
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          )}

          {isOpp && (
          <section className="card">
            <div className="panel-head">
              <h2>Formulario y documentos</h2>
            </div>
            <div className="panel-body">
              {p.applies_url ? (
                <div className="row-between wrap" style={{ marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 7 }}>
                      <FileText size={15} style={{ color: "var(--accent)" }} />
                      <strong>{p.form_platform || "Formulario de postulación"}</strong>
                    </div>
                    <a href={p.applies_url} target="_blank" rel="noreferrer" className="tiny src-link">
                      {p.applies_url}
                    </a>
                    {p.contact_url && (
                      <div className="tiny" style={{ marginTop: 6 }}>
                        Contacto / consultas:{" "}
                        <a href={p.contact_url} target="_blank" rel="noreferrer" className="src-link">
                          {p.contact_url}
                        </a>
                      </div>
                    )}
                  </div>
                  <a className="btn btn-sm" href={p.applies_url} target="_blank" rel="noreferrer">
                    Abrir <ExternalLink size={13} />
                  </a>
                </div>
              ) : p.contact_url ? (
                <div className="row-between wrap" style={{ marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 7 }}>
                      <Mail size={15} style={{ color: "var(--accent)" }} />
                      <strong>Formulario de contacto</strong>
                    </div>
                    <a href={p.contact_url} target="_blank" rel="noreferrer" className="tiny src-link">
                      {p.contact_url}
                    </a>
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      No se detectó un formulario de postulación: este es el canal oficial del programa.
                    </div>
                  </div>
                  <a className="btn btn-sm" href={p.contact_url} target="_blank" rel="noreferrer">
                    Abrir <ExternalLink size={13} />
                  </a>
                </div>
              ) : (
                <p className="small muted" style={{ marginBottom: 12 }}>
                  No se detectó el link del formulario. Suele publicarse al abrir la convocatoria o dentro de las bases.
                </p>
              )}
              <div className="label" style={{ marginBottom: 6 }}>Documentos que piden</div>
              {docs.length ? (
                <div className="row wrap" style={{ gap: 6 }}>
                  {docs.map((d) => (
                    <span key={d} className="badge badge-gray">{d}</span>
                  ))}
                </div>
              ) : (
                <p className="small muted">No se identificaron documentos obligatorios en las fuentes.</p>
              )}
            </div>
          </section>
          )}

          <section className="card">
            <div className="panel-head">
              <h2>Fuentes rastreadas ({sources.filter((s) => s.status === "ok").length})</h2>
              <span className="tiny muted">Todo lo que el sistema leyó</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 10 }}>
              <div className="stack" style={{ gap: 9 }}>
                {sources.map((s) => (
                  <div key={s.id} className="row" style={{ gap: 9, alignItems: "flex-start", fontSize: "calc(12.6px * var(--fs))" }}>
                    <span className={toneClass(s.kind === "pdf" ? "amber" : "gray")} style={{ flex: "none" }}>
                      {s.kind === "pdf" ? "PDF" : "HTML"}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="src-link" style={{ fontSize: "calc(12.6px * var(--fs))" }}>
                        {s.title || s.url}
                      </a>
                      {s.status === "error" && <div className="tiny" style={{ color: "var(--danger)" }}>{s.error}</div>}
                    </div>
                    <span className="tiny muted nowrap">
                      {s.status === "ok" ? `${Math.round((s.chars ?? 0) / 1000)}k` : "error"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          {(isOpp || isEvent) && (
          <section className="card card-pad">
            <div className="kpi-label">Cierre de postulación</div>
            <div style={{ fontSize: "calc(26px * var(--fs))", fontWeight: 500, letterSpacing: "-0.03em", marginTop: 6, color: cd.tone === "red" ? "var(--danger)" : cd.tone === "amber" ? "var(--warn)" : undefined }}>
              {cd.text}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {p.closing_at ? fmtDate(p.closing_at, true) : "Sin fecha detectada"}
            </div>
            {p.closing_raw && <div className="quote" style={{ marginTop: 10 }}>“{p.closing_raw}”</div>}
            {p.closing_at && (
              <div className="tiny muted" style={{ marginTop: 8 }}>
                {p.closing_tz ? `Zona horaria: ${p.closing_tz}` : "Hora local de Buenos Aires"}
              </div>
            )}
          </section>
          )}

          {isOpp && (
          <section className="card card-pad">
            <div className="kpi-label">Elegibilidad</div>
            <div className="row" style={{ alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: "calc(30px * var(--fs))", fontWeight: 500, letterSpacing: "-0.03em", color: scoreColor(p.eligibility_score) }}>
                {p.eligibility_score ?? "—"}{p.eligibility_score != null ? "%" : ""}
              </div>
              <span className={toneClass(verdict.tone)}>{verdict.label}</span>
            </div>
            <div className="progress-track" style={{ margin: "10px 0 12px" }}>
              <span style={{ width: `${p.eligibility_score ?? 0}%`, background: scoreColor(p.eligibility_score) }} />
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {[
                { label: "Cumple", n: counts.cumple, color: "var(--ok)", icon: <Check size={11} /> },
                { label: "No cumple", n: counts.no_cumple, color: "var(--danger)", icon: <X size={11} /> },
                { label: "Falta dato", n: counts.falta_dato, color: "var(--warn)", icon: <HelpCircle size={11} /> },
                { label: "Ambiguo", n: counts.ambiguo, color: "var(--muted)", icon: <Minus size={11} /> },
                { label: "No aplica", n: counts.no_aplica, color: "var(--muted)", icon: <Minus size={11} /> },
              ].map((r) => (
                <div key={r.label} className="row-between small">
                  <span className="row" style={{ gap: 6, color: "var(--text-2)" }}>
                    <span style={{ color: r.color, display: "flex" }}>{r.icon}</span>
                    {r.label}
                  </span>
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{r.n}</strong>
                </div>
              ))}
            </div>
            {counts.falta_dato > 0 && (
              <Link href="/perfil" className="btn btn-sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
                Completar perfil
              </Link>
            )}
          </section>
          )}

          <section className="card card-pad">
            <div className="kpi-label" style={{ marginBottom: 8 }}>Gestión</div>
            {isOpp || isInv ? (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">Estado</label>
                <select
                  className="select"
                  value={p.pipeline_status}
                  onChange={(e) => patch({ pipeline_status: e.target.value })}
                >
                  {Object.entries(isInv ? PIPELINE_INVESTOR : PIPELINE).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">Tipo</label>
                <select
                  className="select"
                  value={kind}
                  onChange={(e) => patch({ kind: e.target.value })}
                >
                  {Object.entries(KIND_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <span className="hint">Cambia la categoría. Para volver a extraer, usá “Re-analizar”.</span>
              </div>
            )}
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label">Notas</label>
              <textarea
                className="textarea"
                style={{ minHeight: 92, fontSize: "calc(13px * var(--fs))" }}
                placeholder="Contacto, requisitos a confirmar, próximo paso…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="row-between">
              <span className="tiny" style={{ color: notesSaved ? "var(--ok)" : "var(--muted)" }}>
                {notesSaved ? "Guardado ✓" : ""}
              </span>
              <button className="btn btn-sm" onClick={saveNotes}>Guardar notas</button>
            </div>
          </section>

          <section className="card card-pad">
            <div className="kpi-label" style={{ marginBottom: 10 }}>Metadatos</div>
            <div className="stack" style={{ gap: 7 }}>
              <div className="row-between small"><span className="muted row" style={{ gap: 5 }}><Database size={12} /> Páginas</span><strong>{p.pages_crawled ?? 0}</strong></div>
              <div className="row-between small"><span className="muted row" style={{ gap: 5 }}><Sparkles size={12} /> Tokens</span><strong>{p.tokens ?? 0}</strong></div>
              <div className="row-between small"><span className="muted">Modo</span><strong>{p.mode ?? "—"}</strong></div>
              <div className="row-between small"><span className="muted">Analizado</span><strong>{p.analyzed_at ? fmtDateTime(p.analyzed_at) : "—"}</strong></div>
              <div className="row-between small"><span className="muted">Creado</span><strong>{fmtDate(p.created_at)}</strong></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
