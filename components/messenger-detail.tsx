"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MessageSquarePlus, Save, Trash2, Check } from "lucide-react";
import type { Messenger, Touchpoint } from "@/lib/types";
import { MESSENGER_STATUS, PLATFORMS } from "./messengers";

const CHANNELS = ["Email", "LinkedIn", "Instagram", "WhatsApp", "Llamada", "Presencial"];
const KINDS = ["Primer contacto", "Follow-up", "Propuesta", "Acuerdo", "Publicación", "Respuesta"];

export function MessengerDetail({ id }: { id: number }) {
  const router = useRouter();
  const [m, setM] = useState<Messenger | null>(null);
  const [touches, setTouches] = useState<Touchpoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tp, setTp] = useState({ channel: "LinkedIn", kind: "Primer contacto", summary: "", cost_usd: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/messengers/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setM(data.messenger);
    setTouches(data.touchpoints ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof Messenger>(k: K, v: Messenger[K]) {
    setM((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  }

  async function save() {
    if (!m) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/messengers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: m.name, role: m.role, organization: m.organization, country: m.country,
          platform: m.platform, handle: m.handle, audience: m.audience,
          audience_size: m.audience_size, topics: m.topics, status: m.status,
          rate_usd: m.rate_usd, rate_notes: m.rate_notes, notes: m.notes,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addTouch(e: React.FormEvent) {
    e.preventDefault();
    if (!tp.summary.trim()) {
      setError("Contá qué pasó en este contacto");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/messengers/${id}/touchpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tp, cost_usd: tp.cost_usd === "" ? null : Number(tp.cost_usd) }),
      });
      if (!res.ok) throw new Error("No se pudo registrar");
      setTp({ channel: tp.channel, kind: tp.kind, summary: "", cost_usd: "" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar este mensajero y su historial?")) return;
    await fetch(`/api/messengers/${id}`, { method: "DELETE" });
    router.push("/mensajeros");
  }

  if (!m) {
    return <div className="row muted"><span className="spinner spinner-dark" /> Cargando…</div>;
  }

  const st = MESSENGER_STATUS[m.status] ?? MESSENGER_STATUS.nuevo;
  const spent = touches.reduce((a, t) => a + (t.cost_usd ?? 0), 0);

  return (
    <div>
      <Link href="/mensajeros" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -9 }}>
        <ArrowLeft /> Volver
      </Link>

      <div className="page-head">
        <div>
          <div className="row wrap" style={{ marginBottom: 7 }}>
            <span className={`badge badge-${st.tone}`}>{st.label}</span>
            {m.platform && <span className="badge badge-gray">{m.platform}</span>}
            {m.audience_size ? (
              <span className="badge badge-gray">{m.audience_size.toLocaleString("es-AR")} seguidores</span>
            ) : null}
          </div>
          <h1>{m.name}</h1>
          <div className="small muted" style={{ marginTop: 4 }}>
            {[m.role, m.organization, m.country].filter(Boolean).join(" · ") || "Sin datos de perfil"}
          </div>
        </div>
        <div className="actions">
          {m.handle && (
            <a className="btn" href={m.handle.startsWith("http") ? m.handle : `https://${m.handle}`} target="_blank" rel="noreferrer">
              Abrir perfil <ArrowUpRight size={15} />
            </a>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? "Guardado" : "Guardar"}
          </button>
          <button className="btn btn-danger" onClick={remove} aria-label="Eliminar"><Trash2 size={15} /></button>
        </div>
      </div>

      {error && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="detail-grid">
        <div className="stack">
          <section className="card card-pad">
            <h2 style={{ marginBottom: 14 }}>Perfil</h2>
            <div className="form-grid">
              <div className="field">
                <label className="label">Nombre</label>
                <input className="input" value={m.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Rol</label>
                <input className="input" value={m.role ?? ""} onChange={(e) => set("role", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Organización</label>
                <input className="input" value={m.organization ?? ""} onChange={(e) => set("organization", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">País</label>
                <input className="input" value={m.country ?? ""} onChange={(e) => set("country", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Plataforma</label>
                <select className="select" value={m.platform ?? ""} onChange={(e) => set("platform", e.target.value)}>
                  <option value="">—</option>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Usuario / link</label>
                <input className="input" value={m.handle ?? ""} onChange={(e) => set("handle", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Audiencia</label>
                <input className="input" value={m.audience ?? ""} onChange={(e) => set("audience", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Alcance (seguidores)</label>
                <input
                  className="input"
                  type="number"
                  value={m.audience_size ?? ""}
                  onChange={(e) => set("audience_size", e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <div className="field span-2">
                <label className="label">Temas</label>
                <input className="input" value={m.topics ?? ""} onChange={(e) => set("topics", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Cuánto cobra (USD)</label>
                <input
                  className="input"
                  type="number"
                  value={m.rate_usd ?? ""}
                  onChange={(e) => set("rate_usd", e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label className="label">Notas de tarifa</label>
                <input className="input" value={m.rate_notes ?? ""} onChange={(e) => set("rate_notes", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Estado</label>
                <select className="select" value={m.status} onChange={(e) => set("status", e.target.value as Messenger["status"])}>
                  {Object.entries(MESSENGER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="field span-2">
                <label className="label">Notas</label>
                <textarea className="textarea" style={{ minHeight: 80 }} value={m.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="panel-head">
              <div>
                <h2>Historial</h2>
                <div className="tiny muted" style={{ marginTop: 2 }}>
                  {touches.length} contacto(s) · {spent > 0 ? `USD ${spent.toLocaleString("es-AR")} invertidos` : "sin gastos registrados"}
                </div>
              </div>
            </div>
            <div className="panel-body">
              <form onSubmit={addTouch} className="stack" style={{ gap: 10, marginBottom: 18 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <select className="select" style={{ width: "auto" }} value={tp.channel} onChange={(e) => setTp({ ...tp, channel: e.target.value })}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="select" style={{ width: "auto" }} value={tp.kind} onChange={(e) => setTp({ ...tp, kind: e.target.value })}>
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input
                    className="input"
                    style={{ width: 130 }}
                    type="number"
                    placeholder="Costo USD"
                    value={tp.cost_usd}
                    onChange={(e) => setTp({ ...tp, cost_usd: e.target.value })}
                  />
                </div>
                <textarea
                  className="textarea"
                  style={{ minHeight: 64 }}
                  placeholder="Qué pasó: qué le dijiste, qué respondió, qué falta."
                  value={tp.summary}
                  onChange={(e) => setTp({ ...tp, summary: e.target.value })}
                />
                <div className="row-between">
                  <span className="tiny muted">Registrar cada contacto construye la reputación del mensajero.</span>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                    <MessageSquarePlus size={14} /> Registrar
                  </button>
                </div>
              </form>

              {touches.length === 0 ? (
                <p className="small muted">Sin contactos registrados todavía.</p>
              ) : (
                <div className="stack" style={{ gap: 12 }}>
                  {touches.map((t) => (
                    <div key={t.id} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                      <div className="criterion-icon" style={{ background: "var(--surface-2)", color: "var(--text-2)", flex: "none" }}>
                        {t.kind?.[0] ?? "·"}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row-between wrap" style={{ gap: 8 }}>
                          <div className="small" style={{ fontWeight: 500 }}>
                            {[t.kind, t.channel].filter(Boolean).join(" · ")}
                          </div>
                          <div className="tiny muted nowrap">
                            {new Date(t.happened_at).toLocaleDateString("es-AR")}
                            {t.cost_usd ? ` · USD ${t.cost_usd.toLocaleString("es-AR")}` : ""}
                          </div>
                        </div>
                        <div className="small" style={{ marginTop: 3, lineHeight: 1.5 }}>{t.summary}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <div className="kpi-label">Resumen</div>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              <div className="row-between small"><span className="muted">Tarifa</span><strong>{m.rate_usd ? `USD ${m.rate_usd.toLocaleString("es-AR")}` : "—"}</strong></div>
              <div className="row-between small"><span className="muted">Alcance</span><strong>{m.audience_size ? m.audience_size.toLocaleString("es-AR") : "—"}</strong></div>
              <div className="row-between small"><span className="muted">Invertido</span><strong>{spent ? `USD ${spent.toLocaleString("es-AR")}` : "—"}</strong></div>
              <div className="row-between small"><span className="muted">Último contacto</span><strong>{m.last_contact_at ? new Date(m.last_contact_at).toLocaleDateString("es-AR") : "—"}</strong></div>
            </div>
          </section>

          {m.notes && (
            <section className="card card-pad">
              <div className="kpi-label">Notas</div>
              <p className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{m.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
