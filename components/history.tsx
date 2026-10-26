"use client";

import { History, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Ev = { id: number; kind: string; detail: string | null; created_at: string };

const LABEL: Record<string, string> = {
  analisis: "Análisis",
  estado: "Estado",
  correccion: "Corrección",
  dato: "Dato aportado",
  envio: "Envío",
  email: "Email",
  mensaje: "Mensaje",
  prefill: "Prellenado",
  nota: "Nota",
};

export function HistoryCard({
  programId,
  onChanged,
}: {
  programId: number;
  onChanged: () => void | Promise<void>;
}) {
  const [events, setEvents] = useState<Ev[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/events`);
    const data = await res.json().catch(() => ({ events: [] }));
    setEvents(data.events ?? []);
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!detail.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/programs/${programId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detail, status: status || undefined }),
      });
      setDetail("");
      setStatus("");
      setOpen(false);
      await load();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Historial</h2>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            Qué se hizo y qué pasó, en orden. No se puede editar: es la memoria de la ficha.
          </div>
        </div>
        {!open && (
          <button className="btn btn-sm" onClick={() => setOpen(true)}>
            <Plus size={13} /> Anotar
          </button>
        )}
      </div>
      <div className="panel-body">
        {open && (
          <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
            <textarea
              className="textarea"
              style={{ minHeight: 80 }}
              placeholder="Ej.: me respondieron que no están invirtiendo en este momento."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <div className="row wrap" style={{ gap: 8 }}>
              <select className="select" style={{ maxWidth: 260 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Sin cambiar el estado</option>
                <option value="reviewing">En revisión</option>
                <option value="applied">Pitch enviado</option>
                <option value="won">Invirtió / Ganada</option>
                <option value="lost">Rechazó</option>
                <option value="closed">Cerrada / no recibe</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !detail.trim()}>
                {busy ? <span className="spinner" /> : <Plus size={13} />} Guardar
              </button>
              <button className="btn btn-sm" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!events.length && <p className="small muted" style={{ margin: 0 }}>Todavía no hay movimientos.</p>}

        <ol className="stack" style={{ gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
          {events.map((e) => (
            <li key={e.id} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span className="badge badge-gray" style={{ flex: "none" }}>{LABEL[e.kind] ?? e.kind}</span>
              <span className="small" style={{ lineHeight: 1.5 }}>
                {e.detail}
                <span className="tiny muted" style={{ marginLeft: 8 }}>
                  {new Date(e.created_at).toLocaleString("es-AR")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
