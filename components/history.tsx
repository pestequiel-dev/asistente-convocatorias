"use client";

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

export function HistoryCard({ programId, version = 0 }: { programId: number; version?: number }) {
  const [events, setEvents] = useState<Ev[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/events`);
    const data = await res.json().catch(() => ({ events: [] }));
    setEvents(data.events ?? []);
  }, [programId]);

  useEffect(() => {
    load();
  }, [load, version]);

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Historial</h2>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            Qué se hizo y qué pasó, en orden. No se puede editar: es la memoria de la ficha.
          </div>
        </div>
      </div>
      <div className="panel-body">
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
