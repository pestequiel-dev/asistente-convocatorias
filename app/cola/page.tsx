"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "lucide-react";
import {
  ListChecks, Pause, Play, Upload, Clock, CheckCircle2, AlertTriangle, Loader2, Gauge,
} from "lucide-react";

interface QueueState {
  counts: Record<string, number>;
  pending: number;
  paused: boolean;
  concurrency: number;
  avgMinutes: number | null;
  etaMinutes: number | null;
  workerAlive: boolean;
  heartbeatAge: number | null;
  next: { id: number; url: string }[];
}

function fmtDuration(min: number | null) {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${m ? `${m} min` : ""}`.trim();
}

export default function ColaPage() {
  const [q, setQ] = useState<QueueState | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/queue", { cache: "no-store" });
    setQ(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const detected = useMemo(() => (text.match(/https?:\/\/[^\s"'<>)\]]+/gi) ?? []).length, [text]);

  async function togglePause() {
    if (!q) return;
    setBusy(true);
    await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !q.paused }),
    });
    await load();
    setBusy(false);
  }

  async function setConcurrency(n: number) {
    await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concurrency: n }),
    });
    await load();
  }

  async function enqueue() {
    if (!detected) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/programs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo encolar");
      setMsg(`${data.created} links encolados${data.skipped ? ` · ${data.skipped} duplicados o inválidos` : ""}.`);
      setText("");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const c = q?.counts ?? {};
  const running = (c.crawling ?? 0) + (c.extracting ?? 0);

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1>Cola de análisis</h1>
          <p>
            Cargá cientos de links y el worker los procesa de a uno o de a varios. Podés pausar cuando quieras:
            lo que está en curso termina y el resto espera. Al reabrir la app, la cola sigue donde quedó.
          </p>
        </div>
        <div className="actions">
          <button className={`btn ${q?.paused ? "btn-primary" : ""}`} onClick={togglePause} disabled={busy || !q}>
            {q?.paused ? <Play size={15} /> : <Pause size={15} />}
            {q?.paused ? "Reanudar" : "Pausar"}
          </button>
        </div>
      </div>

      {q?.paused && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <Pause size={16} style={{ flex: "none", marginTop: 2 }} />
          <div>Cola pausada. Los análisis en curso terminan; no se toma ningún link nuevo.</div>
        </div>
      )}

      {q && !q.workerAlive && (
        <div className="banner banner-error" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} style={{ flex: "none", marginTop: 2 }} />
          <div>
            El worker no está corriendo, así que la cola no avanza. Levantalo con <code>npm run dev</code> (o
            <code> npm run worker</code> en otra terminal).
          </div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Pendientes</div>
          <div className="kpi-value">{q?.pending ?? "—"}</div>
          <div className="kpi-sub">esperando turno</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Procesando</div>
          <div className="kpi-value" style={{ color: running ? "var(--info)" : undefined }}>{running}</div>
          <div className="kpi-sub">ahora mismo</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Listas</div>
          <div className="kpi-value" style={{ color: "var(--ok)" }}>{c.ready ?? 0}</div>
          <div className="kpi-sub">analizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Tiempo estimado</div>
          <div className="kpi-value">{q?.etaMinutes != null ? fmtDuration(q.etaMinutes) : "—"}</div>
          <div className="kpi-sub">{q?.avgMinutes ? `~${q.avgMinutes} min por link` : "sin historial aún"}</div>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
        <span className="badge badge-gray"><Clock size={12} /> {c.rejected ?? 0} descartadas por irrelevantes</span>
        <span className="badge badge-gray"><CheckCircle2 size={12} /> {c.error ?? 0} con error</span>
        {q?.workerAlive ? (
          <span className="badge badge-green"><Loader2 size={12} /> worker activo</span>
        ) : (
          <span className="badge badge-red">worker detenido</span>
        )}
        <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
          <Gauge size={15} style={{ color: "var(--muted)" }} />
          <span className="small muted">En paralelo:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={`chip${q?.concurrency === n ? " active" : ""}`}
              onClick={() => setConcurrency(n)}
              aria-pressed={q?.concurrency === n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <Upload size={17} style={{ color: "var(--accent)" }} />
          <h2>Cargar lista</h2>
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Pegá los links, uno por línea (también acepta separados por coma). Se ignoran los duplicados y lo que
          ya está en el panel. No se clasifica al encolar: cada link se evalúa cuando le toca, así no gastás
          llamadas al modelo en cosas que después vas a descartar.
        </p>
        <textarea
          className="textarea"
          style={{ minHeight: 150 }}
          placeholder={"https://ejemplo.com/convocatoria-1\nhttps://ejemplo.com/convocatoria-2\n…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row-between" style={{ marginTop: 10 }}>
          <span className="small muted">
            {detected ? `${detected} link${detected === 1 ? "" : "s"} detectado${detected === 1 ? "" : "s"}` : "Todavía no hay links"}
            {msg ? ` · ${msg}` : ""}
          </span>
          <button className="btn btn-primary" onClick={enqueue} disabled={busy || !detected}>
            {busy ? <span className="spinner" /> : <ListChecks size={15} />}
            {busy ? "Encolando…" : `Encolar${detected ? ` ${detected}` : ""}`}
          </button>
        </div>
      </section>

      {q && q.next.length > 0 && (
        <section className="card">
          <div className="panel-head">
            <h2>Próximos en la cola</h2>
            <span className="tiny muted">los primeros 8</span>
          </div>
          <div className="panel-body" style={{ paddingTop: 10 }}>
            <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}>
              {q.next.map((n) => (
                <li key={n.id} className="truncate" style={{ color: "var(--text-2)" }}>{n.url}</li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
