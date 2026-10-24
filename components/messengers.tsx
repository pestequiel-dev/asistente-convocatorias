"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Send, Users, X, ArrowRight, TriangleAlert } from "lucide-react";
import type { Messenger } from "@/lib/types";

export const MESSENGER_STATUS: Record<string, { label: string; tone: string }> = {
  nuevo: { label: "Nuevo", tone: "gray" },
  contactado: { label: "Contactado", tone: "blue" },
  interesado: { label: "Interesado", tone: "amber" },
  negociando: { label: "Negociando", tone: "amber" },
  acuerdo: { label: "Acuerdo", tone: "teal" },
  publico: { label: "Publicó", tone: "green" },
  descartado: { label: "Descartado", tone: "gray" },
};

export const PLATFORMS = ["LinkedIn", "Instagram", "YouTube", "Newsletter", "Podcast", "Medio", "Docente", "Otro"];

const EMPTY = {
  name: "", role: "", organization: "", country: "Argentina", platform: "LinkedIn", handle: "",
  audience: "", audience_size: "", topics: "", status: "nuevo", rate_usd: "", rate_notes: "", notes: "",
};

type Selection = {
  brief: string;
  results: (Messenger & { fit: number; reason: string; message: string })[];
  cost_usd: number;
  reach: number;
  cpm: number | null;
  mode: "llm" | "heuristic";
  warning?: string;
};

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return `USD ${n.toLocaleString("es-AR")}`;
}

export function Messengers() {
  const router = useRouter();
  const [list, setList] = useState<Messenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brief, setBrief] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  async function load() {
    const res = await fetch("/api/messengers", { cache: "no-store" });
    const data = await res.json();
    setList(data.messengers ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const kpis = useMemo(() => {
    const total = list.length;
    const published = list.filter((m) => m.status === "publico").length;
    const talking = list.filter((m) => ["contactado", "interesado", "negociando", "acuerdo"].includes(m.status)).length;
    const spent = list.reduce((a, m) => a + (m.rate_usd ?? 0), 0);
    return { total, published, talking, spent };
  }, [list]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/messengers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          audience_size: form.audience_size === "" ? null : Number(form.audience_size),
          rate_usd: form.rate_usd === "" ? null : Number(form.rate_usd),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setForm({ ...EMPTY });
      setShowForm(false);
      await load();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runSelection() {
    if (!brief.trim()) return;
    setSelecting(true);
    setSelection(null);
    try {
      const res = await fetch("/api/messengers/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo seleccionar");
      setSelection(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSelecting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Mensajeros</h1>
          <p>
            Personas con reputación que pueden hablar de Mehmiro. Seguí el estado de cada conversación, cuánto
            cobran y a quién conviene escribirle para cada tema.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={15} /> : <Plus size={15} />} {showForm ? "Cerrar" : "Nuevo mensajero"}
          </button>
        </div>
      </div>

      {error && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Contactos</div>
          <div className="kpi-value">{kpis.total}</div>
          <div className="kpi-sub">en la base</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">En conversación</div>
          <div className="kpi-value">{kpis.talking}</div>
          <div className="kpi-sub">contactados o negociando</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Publicaron</div>
          <div className="kpi-value" style={{ color: "var(--ok)" }}>{kpis.published}</div>
          <div className="kpi-sub">ya hablaron de Mehmiro</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Tarifas sumadas</div>
          <div className="kpi-value">{money(kpis.spent)}</div>
          <div className="kpi-sub">costo si contratás a todos</div>
        </div>
      </div>

      {showForm && (
        <form className="card card-pad stack" onSubmit={create} style={{ marginBottom: 18 }}>
          <div className="row" style={{ gap: 8 }}>
            <Users size={16} style={{ color: "var(--accent)" }} />
            <h2>Nuevo mensajero</h2>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label">Nombre *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label className="label">Rol</label>
              <input className="input" placeholder="Docente, director, periodista, creador…" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Organización</label>
              <input className="input" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">País</label>
              <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Plataforma</label>
              <select className="select" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Usuario / link</label>
              <input className="input" placeholder="@cuenta o URL" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Audiencia</label>
              <input className="input" placeholder="Directores de secundaria, docentes de matemática…" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Alcance (seguidores)</label>
              <input className="input" type="number" min={0} value={form.audience_size} onChange={(e) => setForm({ ...form, audience_size: e.target.value })} />
            </div>
            <div className="field span-2">
              <label className="label">Temas que cubre</label>
              <input className="input" placeholder="evaluación, inteligencia artificial, políticas educativas" value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Cuánto cobra (USD)</label>
              <input className="input" type="number" min={0} value={form.rate_usd} onChange={(e) => setForm({ ...form, rate_usd: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Notas de tarifa</label>
              <input className="input" placeholder="Por post, por mes, canje…" value={form.rate_notes} onChange={(e) => setForm({ ...form, rate_notes: e.target.value })} />
            </div>
            <div className="field span-2">
              <label className="label">Notas</label>
              <textarea className="textarea" style={{ minHeight: 70 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="row-between">
            <span className="tiny muted">La reputación se construye con el historial: cargá cada contacto abajo.</span>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : <Plus size={15} />} Guardar
            </button>
          </div>
        </form>
      )}

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <Sparkles size={16} style={{ color: "var(--accent)" }} />
          <h2>¿A quién le mando esto?</h2>
        </div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Pegá el tema o la oportunidad. La IA elige los 5 contactos con mejor encaje, te dice por qué y te
          redacta el primer mensaje. También calcula el costo y el alcance estimado.
        </p>
        <div className="field">
          <textarea
            className="textarea"
            style={{ minHeight: 76 }}
            placeholder="Ej.: lanzamos evaluaciones formativas con IA para secundaria y queremos que lo cuenten en sus canales."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </div>
        <div className="row-between" style={{ marginTop: 10 }}>
          <span className="tiny muted">Con 5 contactos seleccionados se estima el costo de la campaña.</span>
          <button className="btn btn-primary" onClick={runSelection} disabled={selecting || !brief.trim()}>
            {selecting ? <span className="spinner" /> : <Send size={15} />} {selecting ? "Analizando…" : "Seleccionar"}
          </button>
        </div>

        {selection && (
          <div style={{ marginTop: 16 }}>
            {selection.warning && (
              <div className="banner banner-warn" style={{ marginBottom: 12 }}>
                <TriangleAlert size={15} style={{ flex: "none", marginTop: 2 }} />
                <div>{selection.warning}</div>
              </div>
            )}
            {selection.results.length === 0 ? (
              <p className="small muted">No hay contactos cargados todavía.</p>
            ) : (
              <>
                <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                  <span className="badge badge-teal">Costo estimado: {money(selection.cost_usd)}</span>
                  <span className="badge badge-gray">Alcance: {selection.reach.toLocaleString("es-AR")}</span>
                  {selection.cpm != null && (
                    <span className="badge badge-gray">CPM: USD {selection.cpm}</span>
                  )}
                  <span className="badge badge-gray">
                    {selection.mode === "llm" ? "Selección con DeepSeek" : "Selección heurística"}
                  </span>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  {selection.results.map((r) => (
                    <div key={r.id} className="sel-item">
                      <div className="row-between" style={{ alignItems: "flex-start" }}>
                        <div>
                          <Link href={`/mensajeros/${r.id}`} className="t-title">{r.name}</Link>
                          <div className="t-sub">
                            {[r.role, r.organization, r.platform, r.audience_size ? `${r.audience_size.toLocaleString("es-AR")} seguidores` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <div className="row" style={{ gap: 8, flex: "none" }}>
                          <span className={`badge ${r.fit >= 70 ? "badge-green" : r.fit >= 45 ? "badge-amber" : "badge-gray"}`}>
                            {r.fit}% encaje
                          </span>
                          <span className="badge badge-gray">{money(r.rate_usd)}</span>
                        </div>
                      </div>
                      <div className="small" style={{ marginTop: 6 }}>{r.reason}</div>
                      {r.message && (
                        <div className="quote" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{r.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <div className="table-wrap">
        {loading ? (
          <div className="empty"><span className="spinner spinner-dark" /> Cargando…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <Users size={22} style={{ color: "var(--accent)" }} />
            <h3>Todavía no hay mensajeros</h3>
            <p className="small" style={{ maxWidth: 460 }}>
              Cargá docentes referentes, creadores de contenido o periodistas educativos que puedan hablar de
              Mehmiro, con su tarifa y su audiencia.
            </p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginTop: 6 }}>
              <Plus /> Cargar el primero
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>Mensajero</th>
                  <th>Audiencia</th>
                  <th>Tarifa</th>
                  <th>Estado</th>
                  <th>Último contacto</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const st = MESSENGER_STATUS[m.status] ?? MESSENGER_STATUS.nuevo;
                  return (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/mensajeros/${m.id}`} className="t-title">{m.name}</Link>
                        <div className="t-sub">{[m.role, m.organization].filter(Boolean).join(" · ") || "—"}</div>
                      </td>
                      <td>
                        <div className="small">{m.audience || "—"}</div>
                        <div className="tiny muted">
                          {[m.platform, m.audience_size ? `${m.audience_size.toLocaleString("es-AR")}` : null].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="nowrap">{money(m.rate_usd)}</td>
                      <td><span className={`badge badge-${st.tone}`}>{st.label}</span></td>
                      <td className="small muted">{m.last_contact_at ? new Date(m.last_contact_at).toLocaleDateString("es-AR") : "—"}</td>
                      <td>
                        <Link href={`/mensajeros/${m.id}`} className="btn btn-ghost btn-sm" aria-label={`Abrir ${m.name}`}>
                          <ArrowRight size={15} />
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
