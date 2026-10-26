"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Download, Inbox, Plus, RefreshCw, Search, Sparkles, TriangleAlert, Check, X, Trash2,
} from "lucide-react";
import type { Kind, Program } from "@/lib/types";
import { PIPELINE, VERDICT, countdown, fmtDate, scoreColor, toneClass } from "./format";
import { KIND_META } from "./kind-body";
import { Timeline, ViewToggle } from "./timeline";

type Props = { programs: Program[]; profileName: string; hasKey: boolean; mode?: "summary" };

const TABS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "convocatoria", label: "Convocatorias" },
  { id: "evento", label: "Eventos" },
  { id: "competidor", label: "Competidores" },
  { id: "inversor", label: "Inversores" },
  { id: "referencia", label: "Referencias" },
];

const KINDS: Kind[] = ["convocatoria", "evento", "competidor", "inversor", "referencia"];

function isAnalyzing(p: Program) {
  return p.status === "queued" || p.status === "crawling" || p.status === "extracting";
}

function fitOf(p: Program): number | null {
  // Read the semantic score for the kind, not the cached mirror.
  if (p.kind === "convocatoria") return p.eligibility_score ?? p.fit_score ?? null;
  if (p.kind === "evento") return p.relevance_score ?? p.fit_score ?? null;
  return p.fit_score ?? null;
}

function KindChip({ kind }: { kind: Kind }) {
  const k = KIND_META[kind] ?? KIND_META.referencia;
  return <span className={`badge badge-${k.tone}`}>{k.label}</span>;
}

export function Dashboard({ programs, profileName, hasKey, mode }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Program[]>(programs);
  const [tab, setTab] = useState<Kind | "all">("all");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Kind>>({});
  const [view, setView] = useState<"timeline" | "table">("timeline");
  const [minFit, setMinFit] = useState(0);
  const [order, setOrder] = useState<"recent" | "fit_desc" | "fit_asc">("recent");
  const [ready, setReady] = useState(false);

  // Remember the filters between visits; defaults would silently hide records.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("resumen-filtros") || "{}") as {
        tab?: typeof tab;
        minFit?: number;
        order?: typeof order;
      };
      if (saved.tab) setTab(saved.tab);
      if (typeof saved.minFit === "number") setMinFit(saved.minFit);
      if (saved.order) setOrder(saved.order);
    } catch {
      /* ignore */
    }
    // Only after the restored values have been applied to state.
    setReady(true);
  }, []);

  useEffect(() => {
    // Saving in the same commit as the restore would overwrite it with defaults.
    if (!ready) return;
    try {
      localStorage.setItem("resumen-filtros", JSON.stringify({ tab, minFit, order }));
    } catch {
      /* ignore */
    }
  }, [tab, minFit, order, ready]);
  const [showInbox, setShowInbox] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("vista");
    if (saved === "table" || saved === "timeline") setView(saved);
  }, []);

  useEffect(() => setRows(programs), [programs]);

  const analyzing = rows.some(isAnalyzing);
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => router.refresh(), 3500);
    return () => clearInterval(t);
  }, [analyzing, router]);

  const pending = useMemo(() => rows.filter((r) => !r.kind_confirmed && r.status !== "error"), [rows]);

  function changeView(v: "timeline" | "table") {
    setView(v);
    localStorage.setItem("vista", v);
  }

  const kpis = useMemo(() => {
    const by = (k: Kind) => rows.filter((r) => r.kind === k).length;
    const soon = rows.filter((r) => {
      if (!r.closing_at) return false;
      const d = (new Date(r.closing_at).getTime() - Date.now()) / 86_400_000;
      return d >= -1 && d <= 14;
    }).length;
    return { conv: by("convocatoria"), ev: by("evento"), comp: by("competidor"), soon };
  }, [rows]);

  const filtered = useMemo(() => {
    // Las descartadas no ensucian las listas: viven en su propia pestaña.
    let list = showDiscarded ? rows.filter((r) => r.pipeline_status === "discarded") : rows.filter((r) => r.pipeline_status !== "discarded");
    if (tab !== "all") list = list.filter((r) => r.kind === tab);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((r) => `${r.title ?? ""} ${r.organization ?? ""} ${r.url}`.toLowerCase().includes(s));
    }
    if (minFit > 0) {
      list = list.filter((r) => (fitOf(r) ?? -1) >= minFit);
    }
    if (order !== "recent") {
      list = [...list].sort((a, b) => {
        const fa = fitOf(a);
        const fb = fitOf(b);
        // Unknown scores always go last, whichever the direction.
        if (fa == null && fb == null) return 0;
        if (fa == null) return 1;
        if (fb == null) return -1;
        return order === "fit_desc" ? fb - fa : fa - fb;
      });
    }
    return list;
  }, [rows, tab, q, minFit, order, showDiscarded]);

  const dateTabs = tab === "all" || tab === "convocatoria" || tab === "evento";
  const showTimeline = mode !== "summary" && view === "timeline" && dateTabs;

  async function setKind(id: number, kind: Kind) {
    const before = rows.find((r) => r.id === id);
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, kind, kind_confirmed: 1, status: kind !== before?.kind ? ("queued" as const) : r.status } : r
      )
    );
    await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (kind !== before?.kind) {
      await fetch(`/api/programs/${id}?kind=${kind}`, { method: "POST" });
    }
    router.refresh();
  }

  async function changePipeline(id: number, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, pipeline_status: value as Program["pipeline_status"] } : r)));
    await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_status: value }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{mode === "summary" ? "Resumen" : "Panel"}</h1>
          <p>
            {mode === "summary"
              ? `Cantidades, estados y carga de links de ${profileName}. La línea de tiempo está en Panel.`
              : `Todo lo que guardás entra acá: convocatorias, eventos y competidores. La línea de tiempo los ordena por fecha.`}
          </p>
        </div>
        <div className="actions">
          <button
            className="btn"
            onClick={async (e) => {
              const btn = e.currentTarget;
              const original = btn.textContent;
              btn.disabled = true;
              btn.textContent = "Recalculando…";
              try {
                await fetch("/api/ranking/recompute", { method: "POST" });
                router.refresh();
              } finally {
                btn.disabled = false;
                btn.textContent = original;
              }
            }}
            title="Vuelve a puntuar todo contra el perfil y los hitos actuales"
          >
            <RefreshCw size={15} /> Recalcular ranking
          </button>
          <a className="btn" href="/api/export">
            <Download /> Exportar CSV
          </a>
          <Link className="btn btn-primary" href="/nueva">
            <Plus /> Guardar link
          </Link>
        </div>
      </div>

      {!hasKey && (
        <div className="banner banner-warn" style={{ marginBottom: 18 }}>
          <TriangleAlert size={16} style={{ marginTop: 2, flex: "none" }} />
          <div>
            Sin DeepSeek el análisis (y la clasificación) usa reglas heurísticas: funciona, pero es mucho menos
            preciso.{" "}
            <Link href="/ajustes" style={{ color: "inherit", fontWeight: 500, textDecoration: "underline" }}>
              Configurar API key
            </Link>
          </div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Convocatorias</div>
          <div className="kpi-value">{kpis.conv}</div>
          <div className="kpi-sub">oportunidades activas</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Eventos</div>
          <div className="kpi-value">{kpis.ev}</div>
          <div className="kpi-sub">en agenda</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Competidores</div>
          <div className="kpi-value">{kpis.comp}</div>
          <div className="kpi-sub">bajo vigilancia</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">En los próximos 14 días</div>
          <div className="kpi-value" style={{ color: kpis.soon ? "var(--danger)" : undefined }}>{kpis.soon}</div>
          <div className="kpi-sub">cierres o eventos</div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="banner banner-info" style={{ marginBottom: 16, alignItems: "center" }}>
          <Inbox size={16} style={{ flex: "none" }} />
          <div style={{ flex: 1 }}>
            <strong>{pending.length}</strong> {pending.length === 1 ? "link está" : "links están"} sin confirmar de
            tipo. La clasificación es automática; si alguna está mal, corregila en su ficha o acá.
          </div>
          <button className="btn btn-sm" onClick={() => setShowInbox((v) => !v)} aria-expanded={showInbox}>
            {showInbox ? <X size={13} /> : <Check size={13} />} {showInbox ? "Cerrar" : "Revisar tipos"}
          </button>
        </div>
      )}

      {showInbox && pending.length > 0 && (
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="panel-body" style={{ paddingTop: 14, display: "grid", gap: 10 }}>
            {pending.map((p) => {
              const suggested = (p.kind ?? "referencia") as Kind;
              const current = drafts[p.id] ?? suggested;
              return (
                <div
                  key={p.id}
                  className="row-between wrap inbox-row"
                  style={{ gap: 10, paddingBottom: 10, borderBottom: "1px solid #f0efeb" }}
                >
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <Link href={`/programa/${p.id}`} className="t-title">
                      {p.title || (isAnalyzing(p) ? "Analizando…" : p.url)}
                    </Link>
                    <div className="t-sub row" style={{ gap: 6, marginTop: 3 }}>
                      <span className="badge badge-gray">
                        sugerido: {KIND_META[suggested].label}
                        {p.kind_confidence != null ? ` · ${Math.round(p.kind_confidence * 100)}%` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="row inbox-actions" style={{ gap: 6 }}>
                    <select
                      className="select"
                      style={{ padding: "5px 8px", fontSize: "calc(12.5px * var(--fs))", minWidth: 140 }}
                      value={current}
                      aria-label={`Tipo de ${p.title ?? p.url}`}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value as Kind }))}
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>{KIND_META[k].label}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-primary" onClick={() => setKind(p.id, current)}>
                      <Check size={13} /> Confirmar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="filters">
        <button
          className={`chip${showDiscarded ? " active" : ""}`}
          onClick={() => setShowDiscarded((v) => !v)}
          title="Ver solo las fichas descartadas"
        >
          Descartadas
        </button>
        {TABS.map((t) => {
          const n = t.id === "all" ? rows.length : rows.filter((r) => r.kind === t.id).length;
          return (
            <button key={t.id} className={`chip${tab === t.id && !showDiscarded ? " active" : ""}`} onClick={() => { setShowDiscarded(false); setTab(t.id); }}>
              {t.label} <span style={{ opacity: 0.55 }}>{n}</span>
            </button>
          );
        })}
        <select
          className="select"
          style={{ width: "auto", padding: "6px 10px", fontSize: "calc(12.8px * var(--fs))" }}
          value={minFit}
          onChange={(e) => setMinFit(Number(e.target.value))}
          aria-label="Fit mínimo"
        >
          <option value={0}>Fit: todos</option>
          <option value={30}>Fit ≥ 30%</option>
          <option value={50}>Fit ≥ 50%</option>
          <option value={70}>Fit ≥ 70%</option>
          <option value={85}>Fit ≥ 85%</option>
        </select>
        {!showTimeline && (
        <select
          className="select"
          style={{ width: "auto", padding: "6px 10px", fontSize: "calc(12.8px * var(--fs))" }}
          value={order}
          onChange={(e) => setOrder(e.target.value as typeof order)}
          aria-label="Orden"
        >
          <option value="recent">Orden: recientes</option>
          <option value="fit_desc">Fit: mayor a menor</option>
          <option value="fit_asc">Fit: menor a mayor</option>
        </select>
        )}
        {mode !== "summary" && dateTabs && <ViewToggle value={view} onChange={changeView} />}
        {tab === "referencia" && filtered.length > 0 && (
          <button
            className="chip"
            onClick={async () => {
              if (!confirm(`¿Borrar las ${filtered.length} referencias?`)) return;
              await fetch("/api/programs?kind=referencia", { method: "DELETE" });
              router.refresh();
              setRows((prev) => prev.filter((r) => r.kind !== "referencia"));
            }}
          >
            <Trash2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Vaciar referencias
          </button>
        )}
        <div className="search" style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px" }}>
          <Search size={14} style={{ color: "var(--muted)", flex: "none" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar"
            style={{ border: "none", outline: "none", background: "transparent", padding: "7px 0", width: "100%", fontSize: "calc(13px * var(--fs))" }}
          />
        </div>
      </div>

      <div className={showTimeline ? "" : "table-wrap"}>
        {showTimeline ? (
          <Timeline programs={filtered} />
        ) : filtered.length === 0 ? (
          <div className="empty">
            <Sparkles size={22} style={{ color: "var(--accent)" }} />
            <h3>{rows.length === 0 ? "Todavía no hay nada guardado" : "Ningún resultado con este filtro"}</h3>
            <p className="small" style={{ maxWidth: 440 }}>
              {rows.length === 0
                ? "Pegá el link de un posteo o de las bases. El sistema detecta si es convocatoria, evento o competidor."
                : "Probá con otra pestaña o limpiá la búsqueda."}
            </p>
            {rows.length === 0 && (
              <Link className="btn btn-primary" href="/nueva" style={{ marginTop: 6 }}>
                <Plus /> Guardar el primer link
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "36%" }}>
                    {tab === "competidor" ? "Competidor" : tab === "evento" ? "Evento" : tab === "inversor" ? "Inversor" : tab === "referencia" ? "Referencia" : "Convocatoria"}
                  </th>
                  <th>{tab === "competidor" ? "Última revisión" : "Fecha"}</th>
                  <th>{tab === "competidor" ? "Cambios" : tab === "evento" ? "Relevancia" : tab === "inversor" ? "Fit" : "Elegibilidad"}</th>
                  <th>Estado</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const kind = (p.kind ?? "convocatoria") as Kind;
                  const cd = countdown(p.closing_at);
                  const v = VERDICT[p.verdict ?? "unknown"] ?? VERDICT.unknown;
                  const analyzingRow = isAnalyzing(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/programa/${p.id}`} className="t-title">
                          {p.title || (analyzingRow ? "Analizando…" : p.url)}
                        </Link>
                        <div className="t-sub row" style={{ gap: 6 }}>
                          <KindChip kind={kind} />
                          {[p.organization, p.type].filter(Boolean).join(" · ")}
                        </div>
                      </td>

                      <td>
                        {analyzingRow ? (
                          <span className="badge badge-blue"><RefreshCw size={11} className="pulse" /> procesando</span>
                        ) : kind === "competidor" ? (
                          <span className="small muted">{p.diff_at ? fmtDate(p.diff_at) : p.analyzed_at ? fmtDate(p.analyzed_at) : "—"}</span>
                        ) : p.closing_at ? (
                          <>
                            <span className={toneClass(cd.tone)}><span className="dot" /> {cd.text}</span>
                            <div className="tiny muted" style={{ marginTop: 3 }}>{fmtDate(p.closing_at)}</div>
                          </>
                        ) : (
                          <span className="small muted">—</span>
                        )}
                      </td>

                      <td>
                        {kind === "competidor" ? (
                          p.diff_summary ? (
                            <span className="badge badge-amber">cambios detectados</span>
                          ) : (
                            <span className="small muted">sin cambios</span>
                          )
                        ) : kind === "inversor" ? (
                          p.fit_score != null ? (
                            <div className="row" style={{ gap: 8 }}>
                              <div className="meter">
                                <span style={{ width: `${p.fit_score}%`, background: scoreColor(p.fit_score) }} />
                              </div>
                              <span style={{ fontWeight: 500, fontSize: "calc(13px * var(--fs))" }}>{p.fit_score}%</span>
                            </div>
                          ) : (
                            <span className="small muted">—</span>
                          )
                        ) : kind === "evento" ? (
                          p.relevance_score != null ? (
                            <div className="row" style={{ gap: 8 }}>
                              <div className="meter">
                                <span style={{ width: `${p.relevance_score}%`, background: scoreColor(p.relevance_score) }} />
                              </div>
                              <span style={{ fontWeight: 500, fontSize: "calc(13px * var(--fs))" }}>{p.relevance_score}%</span>
                            </div>
                          ) : (
                            <span className="small muted">—</span>
                          )
                        ) : p.status === "error" ? (
                          <span className="badge badge-red">Error</span>
                        ) : p.eligibility_score == null ? (
                          <span className="muted small">—</span>
                        ) : (
                          <div className="row" style={{ gap: 8 }}>
                            <div className="meter">
                              <span style={{ width: `${p.eligibility_score}%`, background: scoreColor(p.eligibility_score) }} />
                            </div>
                            <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums", fontSize: "calc(13px * var(--fs))" }}>
                              {p.eligibility_score}%
                            </span>
                            <span className={toneClass(v.tone)}>{v.label}</span>
                          </div>
                        )}
                      </td>

                      <td>
                        {kind === "convocatoria" ? (
                          <select
                            className="select"
                            style={{ padding: "5px 8px", fontSize: "calc(12.5px * var(--fs))", minWidth: 122 }}
                            value={p.pipeline_status}
                            aria-label={`Estado de ${p.title ?? p.url}`}
                            onChange={(e) => changePipeline(p.id, e.target.value)}
                          >
                            {Object.entries(PIPELINE).map(([k, val]) => (
                              <option key={k} value={k}>{val.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="small muted">{p.pipeline_status === "reviewing" ? "En revisión" : PIPELINE[p.pipeline_status]?.label}</span>
                        )}
                      </td>

                      <td>
                        <Link href={`/programa/${p.id}`} className="btn btn-ghost btn-sm" aria-label={`Abrir ${p.title ?? p.url}`}>
                          <ArrowRight />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
