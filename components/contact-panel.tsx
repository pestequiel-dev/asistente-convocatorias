"use client";

import { Check, Copy, MessageSquare, MonitorUp, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function ContactPanel({ programId, url }: { programId: number; url: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillMsg, setPrefillMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/programs/${programId}/draft`)
      .then((r) => r.json())
      .then((d) => {
        if (d.draft?.source === "contact" && d.draft.answers?.[0]?.answer) {
          setMessage(d.draft.answers[0].answer);
        }
      })
      .catch(() => {});
  }, [programId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${programId}/contact`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar");
      setMessage(data.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function prefill() {
    setPrefilling(true);
    setPrefillMsg(null);
    try {
      const res = await fetch(`/api/programs/${programId}/prefill`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo abrir");
      setPrefillMsg("Abriendo el formulario de contacto con tus datos y el mensaje. Revisalo y enviá vos.");
    } catch (e) {
      setPrefillMsg((e as Error).message);
    } finally {
      setPrefilling(false);
    }
  }

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Mensaje de contacto</h2>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            No hay formulario de postulación: el camino es este formulario.
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? <span className="spinner" /> : message ? <RefreshCw size={15} /> : <MessageSquare size={15} />}
            {message ? "Regenerar" : "Preparar mensaje"}
          </button>
          {message && (
            <button className="btn" onClick={prefill} disabled={prefilling}>
              {prefilling ? <span className="spinner" /> : <MonitorUp size={15} />} Abrir contacto pre-cargado
            </button>
          )}
        </div>
      </div>

      <div className="panel-body">
        {error && <div className="banner banner-warn" style={{ marginBottom: 12 }}>{error}</div>}

        {!message && !error && (
          <p className="small muted" style={{ margin: 0 }}>
            Genera un mensaje corto con qué hace el proyecto, tracción y tu fit con la tesis del fondo, listo para pegar.
          </p>
        )}

        {message && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row-between">
              <label className="label">Mensaje</label>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(message);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} Copiar
              </button>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 170 }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="tiny muted">
              Destino: {url}. El prellenado completa nombre, email, empresa y el mensaje; no envía nada.
            </div>
            {prefillMsg && <div className="small">{prefillMsg}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
