"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Save, Building2, FileText, Plus, Trash2, Trophy } from "lucide-react";
import type { Profile } from "@/lib/types";

type Form = Omit<Profile, "id" | "updated_at">;

const EMPTY: Form = {
  name: "", url: "", country: "", city: "", founder_name: "", founder_last: "", email: "", linkedin: "", phone: "", role: "", deck_url: "", round_details: "", market_size: "", market_plan: "", traction_metrics: "", legal_status: "", legal_structure_detail: "", can_invoice: "", founded: "", stage: "", sector: "",
  description: "", team_size: null, founders: null, revenue_usd: null, customers: null,
  languages: "", tech_stack: "", has_product: "", notes: "",
};

export default function PerfilPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [docs, setDocs] = useState<{ id: number; label: string; url: string; kind: string; chars: number }[]>([]);
  const [newDoc, setNewDoc] = useState({ label: "", url: "", kind: "Pitch deck" });
  const [docBusy, setDocBusy] = useState(false);
  const [docMsg, setDocMsg] = useState<string | null>(null);

  async function loadDocs() {
    const res = await fetch("/api/profile/docs");
    const data = await res.json();
    setDocs(data.docs ?? []);
  }

  useEffect(() => {
    loadDocs();
  }, []);

  async function addDoc(e: React.FormEvent) {
    e.preventDefault();
    setDocBusy(true);
    setDocMsg(null);
    try {
      const res = await fetch("/api/profile/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoc),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setDocMsg(
        data.warning
          ? `Se guardó el link pero no pude leer el contenido (${data.warning}). La IA no lo va a usar.`
          : "Documento leído y agregado al contexto."
      );
      setNewDoc({ label: "", url: "", kind: newDoc.kind });
      await loadDocs();
    } catch (err) {
      setDocMsg((err as Error).message);
    } finally {
      setDocBusy(false);
    }
  }

  const [miles, setMiles] = useState<{ id: number; title: string; kind: string | null; metric: string | null; achieved_at: string; description: string | null }[]>([]);
  const [newMile, setNewMile] = useState({ title: "", kind: "Tracción", metric: "", achieved_at: new Date().toISOString().slice(0, 10), description: "" });
  const [mileMsg, setMileMsg] = useState<string | null>(null);

  async function loadMiles() {
    const res = await fetch("/api/milestones");
    const data = await res.json();
    setMiles(data.milestones ?? []);
  }

  useEffect(() => {
    loadMiles();
  }, []);

  async function addMile(e: React.FormEvent) {
    e.preventDefault();
    if (!newMile.title.trim()) {
      setMileMsg("Poné un título al hito");
      return;
    }
    const res = await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMile),
    });
    if (!res.ok) {
      setMileMsg("No se pudo guardar el hito");
      return;
    }
    setNewMile({ ...newMile, title: "", metric: "", description: "" });
    setMileMsg("Hito guardado. Recalculá el ranking para que se refleje.");
    await loadMiles();
  }

  async function removeMile(id: number) {
    await fetch(`/api/milestones?id=${id}`, { method: "DELETE" });
    await loadMiles();
  }

  async function removeDoc(id: number) {
    await fetch(`/api/profile/docs?id=${id}`, { method: "DELETE" });
    await loadDocs();
  }

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          const { id, updated_at, ...rest } = d.profile;
          setForm({ ...EMPTY, ...rest });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="row muted"><span className="spinner spinner-dark" /> Cargando perfil…</div>;
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Link href="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -9 }}>
        <ArrowLeft /> Volver al panel
      </Link>

      <div className="page-head">
        <div>
          <h1>Perfil de Mehmiro</h1>
          <p>
            Este perfil es el que se compara contra cada convocatoria. Cuanto más completo, menos veces el panel te
            va a decir “falta dato”. Nada se inventa: lo que dejés vacío se marca como desconocido.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? "Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      {error && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="stack">
        <section className="card card-pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <Building2 size={17} style={{ color: "var(--accent)" }} />
            <h2>Identidad</h2>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label">Nombre</label>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Sitio web</label>
              <input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">País de operación</label>
              <input className="input" placeholder="Argentina" value={form.country} onChange={(e) => set("country", e.target.value)} />
              <span className="hint">Define elegibilidad geográfica.</span>
            </div>
            <div className="field">
              <label className="label">Nombre del fundador/a</label>
              <input className="input" placeholder="Nombre" value={form.founder_name} onChange={(e) => set("founder_name", e.target.value)} />
              <span className="hint">Lo usan los formularios que piden datos personales.</span>
            </div>
            <div className="field">
              <label className="label">Apellido</label>
              <input className="input" value={form.founder_last} onChange={(e) => set("founder_last", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Rol / cargo</label>
              <input className="input" placeholder="Co-founder & CEO" value={form.role} onChange={(e) => set("role", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Email de contacto</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">LinkedIn</label>
              <input className="input" placeholder="https://linkedin.com/in/…" value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Teléfono</label>
              <input className="input" placeholder="+54 9 11 …" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Link del deck</label>
              <input className="input" placeholder="https://…/mehmiro-deck.pdf" value={form.deck_url} onChange={(e) => set("deck_url", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Ronda</label>
              <input className="input" placeholder="Pre-seed, USD 500k por 10%" value={form.round_details} onChange={(e) => set("round_details", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Ciudad</label>
              <input className="input" placeholder="Tigre" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <span className="hint">Se usa para saber si un evento presencial te queda cerca.</span>
            </div>
            <div className="field">
              <label className="label">Sector</label>
              <input className="input" placeholder="EdTech · IA pedagógica" value={form.sector} onChange={(e) => set("sector", e.target.value)} />
            </div>
            <div className="field span-2">
              <label className="label">Descripción (qué hace y para quién)</label>
              <textarea className="textarea" style={{ minHeight: 90 }} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="field span-2">
              <label className="label">Notas libres</label>
              <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Distinciones, alianzas, clientes ancla, cualquier cosa que ayude a evaluar." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Situación legal y etapa</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label className="label">Situación legal</label>
              <select className="select" value={form.legal_status} onChange={(e) => set("legal_status", e.target.value)}>
                <option value="">— sin definir —</option>
                <option value="Opera bajo la estructura legal de un tercero">
                  Opera bajo la estructura legal de un tercero (cooperativa, aceleradora, sociedad aliada)
                </option>
                <option value="Constituida (SAS/SRL)">Constituida (SAS / SRL)</option>
                <option value="En trámite de constitución">En trámite de constitución</option>
                <option value="No constituida (persona física)">No constituida (persona física)</option>
                <option value="Constituida en el exterior">Constituida en el exterior</option>
                <option value="Otra">Otra (describila abajo)</option>
              </select>
              <span className="hint">
                Si no encaja en ninguna, elegí “Otra” y escribí tu caso en el detalle: no hay opciones cerradas.
              </span>
            </div>
            <div className="field span-2">
              <label className="label">Detalle de la estructura legal</label>
              <textarea
                className="textarea"
                style={{ minHeight: 78 }}
                placeholder="Ej.: la cooperativa X nos aporta personería, CUIT y facturación; Mehmiro es el proyecto que se presenta."
                value={form.legal_structure_detail}
                onChange={(e) => set("legal_structure_detail", e.target.value)}
              />
              <span className="hint">
                Cuando una base exige personería jurídica propia, el panel va a marcar el requisito como ambiguo y
                citar este detalle en vez de darte un veredicto falso.
              </span>
            </div>
            <div className="field">
              <label className="label">¿Pueden emitir factura?</label>
              <select className="select" value={form.can_invoice} onChange={(e) => set("can_invoice", e.target.value)}>
                <option value="">— sin definir —</option>
                <option value="Sí, con CUIT propia">Sí, con CUIT propia</option>
                <option value="Sí, a través de un tercero">Sí, a través de un tercero</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Año de fundación</label>
              <input className="input" placeholder="2024" value={form.founded} onChange={(e) => set("founded", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Etapa</label>
              <select className="select" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                <option value="">— sin definir —</option>
                <option value="Idea">Idea</option>
                <option value="MVL / prototipo">MVL / prototipo</option>
                <option value="Pre-seed">Pre-seed</option>
                <option value="Seed">Seed</option>
                <option value="Serie A o posterior">Serie A o posterior</option>
                <option value="Bootstrapped / rentable">Bootstrapped / rentable</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Producto en producción</label>
              <select className="select" value={form.has_product} onChange={(e) => set("has_product", e.target.value)}>
                <option value="">— sin definir —</option>
                <option value="Sí, producto en producción">Sí, producto en producción</option>
                <option value="Sí, pero en beta">Sí, pero en beta</option>
                <option value="No, solo prototipo">No, solo prototipo</option>
                <option value="No, solo idea">No, solo idea</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Tracción y equipo</h2>
          <div className="form-grid">
            <div className="field">
              <label className="label">Facturación anual (USD)</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="0"
                value={form.revenue_usd ?? ""}
                onChange={(e) => set("revenue_usd", e.target.value === "" ? null : Number(e.target.value))}
              />
              <span className="hint">Muchas convocatorias tienen tope de ingresos.</span>
            </div>
            <div className="field">
              <label className="label">Clientes / usuarios activos</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="0"
                value={form.customers ?? ""}
                onChange={(e) => set("customers", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label className="label">Tamaño del equipo</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form.team_size ?? ""}
                onChange={(e) => set("team_size", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label className="label">Cantidad de fundadores</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form.founders ?? ""}
                onChange={(e) => set("founders", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label className="label">Idiomas del equipo</label>
              <input className="input" placeholder="Español, inglés" value={form.languages} onChange={(e) => set("languages", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Stack / tecnología</label>
              <input className="input" placeholder="IA generativa, LLMs, React" value={form.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <Building2 size={17} style={{ color: "var(--accent)" }} />
            <h2>Mercado y tracción</h2>
          </div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            Los tres datos que más se repiten en las postulaciones. Si están acá, el borrador los usa en vez de
            escribir <code>[FALTA: …]</code>.
          </p>
          <div className="grid-2">
            <div className="field span-2">
              <label className="label">Tamaño de mercado</label>
              <textarea
                className="textarea"
                style={{ minHeight: 130 }}
                placeholder={"TAM: … (fuente / método)\nSAM: … (a quién apuntamos primero)\nSOM: …"}
                value={form.market_size}
                onChange={(e) => set("market_size", e.target.value)}
              />
              <span className="hint">
                Escribí TAM, SAM y SOM con el método o la fuente. Sin números verificados, mejor una estimación
                explícita con supuestos que una cifra inventada.
              </span>
            </div>
            <div className="field span-2">
              <label className="label">Plan de expansión</label>
              <textarea
                className="textarea"
                style={{ minHeight: 96 }}
                placeholder="Ej.: arrancamos en Argentina; 2026 México y Chile; 2027 Colombia, Perú y Uruguay."
                value={form.market_plan}
                onChange={(e) => set("market_plan", e.target.value)}
              />
            </div>
            <div className="field span-2">
              <label className="label">Métricas de uso y retención</label>
              <textarea
                className="textarea"
                style={{ minHeight: 96 }}
                placeholder="Ej.: 2 colegios pagos · 85 docentes activos/semana · 3.100 estudiantes · 64% de retención docente a 3 meses · 12.400 notas de voz procesadas."
                value={form.traction_metrics}
                onChange={(e) => set("traction_metrics", e.target.value)}
              />
              <span className="hint">
                Es lo que más se repite en las postulaciones (“métricas de uso o retención”). Cargalo una vez y
                viaja a todos los borradores.
              </span>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <Trophy size={17} style={{ color: "var(--accent)" }} />
            <h2>Hitos</h2>
          </div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            Lo que van logrando: primer cliente, cantidad de escuelas, MRR, premios, alianzas. Es el historial
            que la IA usa como estado real de la startup al evaluar cada convocatoria o inversor.
          </p>

          {miles.length > 0 && (
            <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
              {miles.map((m) => (
                <div key={m.id} className="row-between wrap" style={{ gap: 10, paddingBottom: 10, borderBottom: "1px solid #f0efeb" }}>
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                      <strong style={{ fontWeight: 500 }}>{m.title}</strong>
                      {m.kind && <span className="badge badge-teal">{m.kind}</span>}
                      {m.metric && <span className="badge badge-gray">{m.metric}</span>}
                      <span className="tiny muted">{new Date(m.achieved_at).toLocaleDateString("es-AR")}</span>
                    </div>
                    {m.description && <div className="small muted" style={{ marginTop: 3 }}>{m.description}</div>}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => removeMile(m.id)} aria-label={`Quitar ${m.title}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addMile} className="form-grid">
            <div className="field">
              <label className="label">Qué lograron</label>
              <input className="input" placeholder="Primer cliente pago" value={newMile.title} onChange={(e) => setNewMile({ ...newMile, title: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Tipo</label>
              <select className="select" value={newMile.kind} onChange={(e) => setNewMile({ ...newMile, kind: e.target.value })}>
                {["Tracción", "Producto", "Financiamiento", "Equipo", "Premio", "Alianza", "Otro"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Métrica (opcional)</label>
              <input className="input" placeholder="3 escuelas / USD 500 MRR" value={newMile.metric} onChange={(e) => setNewMile({ ...newMile, metric: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Fecha</label>
              <input className="input" type="date" value={newMile.achieved_at} onChange={(e) => setNewMile({ ...newMile, achieved_at: e.target.value })} />
            </div>
            <div className="field span-2">
              <label className="label">Detalle (opcional)</label>
              <input className="input" value={newMile.description} onChange={(e) => setNewMile({ ...newMile, description: e.target.value })} />
            </div>
            <div className="span-2 row-between">
              <span className="tiny muted">{mileMsg}</span>
              <button className="btn btn-primary" type="submit">
                <Plus size={15} /> Agregar hito
              </button>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <FileText size={17} style={{ color: "var(--accent)" }} />
            <h2>Documentos de contexto</h2>
          </div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            Links a tu pitch deck, métricas, roadmap o one-pager. La IA los lee y los usa como fuente de verdad
            sobre el estado de la startup al evaluar requisitos. Funcionan mejor los Google Docs públicos y los
            PDFs; lo que esté detrás de un login no se puede leer.
          </p>

          {docs.length > 0 && (
            <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
              {docs.map((d) => (
                <div key={d.id} className="row-between wrap" style={{ gap: 10, paddingBottom: 10, borderBottom: "1px solid #f0efeb" }}>
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                      <strong style={{ fontWeight: 500 }}>{d.label}</strong>
                      <span className="badge badge-gray">{d.kind}</span>
                      {d.chars > 0 ? (
                        <span className="badge badge-green">leído</span>
                      ) : (
                        <span className="badge badge-amber">sin contenido</span>
                      )}
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" className="tiny src-link">
                      {d.url}
                    </a>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => removeDoc(d.id)} aria-label={`Quitar ${d.label}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addDoc} className="form-grid">
            <div className="field">
              <label className="label">Nombre</label>
              <input className="input" placeholder="Pitch deck / Métricas Q3" value={newDoc.label} onChange={(e) => setNewDoc({ ...newDoc, label: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Tipo</label>
              <select className="select" value={newDoc.kind} onChange={(e) => setNewDoc({ ...newDoc, kind: e.target.value })}>
                {["Pitch deck", "Métricas", "Roadmap", "One-pager", "Finanzas", "Investigación", "Aplicación anterior", "Otro"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label className="label">Link</label>
              <input className="input" placeholder="https://docs.google.com/document/d/…" value={newDoc.url} onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })} />
            </div>
            <div className="span-2 row-between">
              <span className="tiny" style={{ color: docMsg ? "var(--text-2)" : "var(--muted)" }}>{docMsg}</span>
              <button className="btn btn-primary" type="submit" disabled={docBusy}>
                {docBusy ? <span className="spinner" /> : <Plus size={15} />}
                {docBusy ? "Leyendo documento…" : "Agregar documento"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
