"use client";

import { Check, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";

export function CorrectionCard({
  programId,
  correction,
  correctedAt,
  onChanged,
}: {
  programId: number;
  correction: string | null;
  correctedAt: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(correction ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/programs/${programId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo aplicar");
      const r = data.result;
      setMsg(
        r?.ok
          ? `Re-verificado: ${r.verdict === "eligible" ? "elegible" : r.verdict === "not_eligible" ? "no elegible" : "faltan datos"} · ${r.score}%`
          : r?.error || "Corrección guardada."
      );
      setOpen(false);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Corrección</h2>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            Si el análisis entendió mal algo, escribilo acá: manda sobre el modelo y re-verifica.
          </div>
        </div>
        {!open && (
          <button className="btn btn-sm" onClick={() => setOpen(true)}>
            <Pencil size={13} /> {correction ? "Editar" : "Corregir"}
          </button>
        )}
      </div>

      <div className="panel-body">
        {correction && !open && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="small" style={{ lineHeight: 1.55 }}>{correction}</div>
            <div className="tiny muted">
              <Check size={11} /> aplicada
              {correctedAt ? ` el ${new Date(correctedAt).toLocaleDateString("es-AR")}` : ""}
            </div>
          </div>
        )}

        {open && (
          <div className="stack" style={{ gap: 10 }}>
            <textarea
              className="textarea"
              style={{ minHeight: 96 }}
              placeholder="Ej.: no es para Cuba; es una incubadora de Salto, Uruguay, y acepta proyectos de la región."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="row wrap" style={{ gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={apply} disabled={busy || !text.trim()}>
                {busy ? <span className="spinner" /> : <RefreshCw size={13} />} Aplicar y re-verificar
              </button>
              <button className="btn btn-sm" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && <div className="banner banner-warn" style={{ marginTop: 10 }}>{error}</div>}
        {msg && <div className="banner banner-ok" style={{ marginTop: 10 }}>{msg}</div>}
      </div>
    </section>
  );
}
