"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Sparkles, TriangleAlert } from "lucide-react";

export default function NuevaPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ reason: string } | null>(null);

  async function post(force: boolean) {
    setError(null);
    setRejected(null);
    if (!url.trim()) {
      setError("Pegá el link de la convocatoria.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: text.trim(), force }),
      });
      if (res.status === 422) {
        const data = await res.json();
        setRejected({ reason: data.reason || "" });
        setError(data.error || "Ese link no parece tener que ver con el negocio.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el análisis");
      router.push(`/programa/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post(false);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -9 }}>
        <ArrowLeft /> Volver al panel
      </Link>

      <div className="page-head">
        <div>
          <h1>Guardar un link</h1>
          <p>
            Pegá el link de una convocatoria, un evento o la landing de un competidor. El sistema clasifica primero
            y después aplica el análisis que corresponde: bases y elegibilidad, agenda y relevancia, o lectura
            competitiva con precios.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20, alignItems: "start" }} className="detail-grid">
        <form className="card card-pad stack" onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="url">Link de la convocatoria</label>
            <input
              id="url"
              className="input"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <span className="hint">
              Sirve el link del posteo (incluido el link que aparece dentro del texto) o directamente el de las bases.
            </span>
          </div>

          <div className="field">
            <label className="label" htmlFor="text">Texto del posteo (recomendado)</label>
            <textarea
              id="text"
              className="textarea"
              placeholder={"Pegá acá el texto de LinkedIn / Instagram / WhatsApp…\n\nSi el link es de una red social, esto es obligatorio: LinkedIn e Instagram bloquean el rastreo, así que el sistema busca el link real dentro de lo que pegaste."}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="hint">
              Más texto = mejor detección de fechas, montos y requisitos que quizás no estén en la página principal.
            </span>
          </div>

          {error && (
            <div className="banner banner-error">
              <TriangleAlert size={16} style={{ flex: "none", marginTop: 2 }} />
              <div>
                {error}
                {rejected?.reason && <div style={{ marginTop: 4, opacity: 0.85 }}>{rejected.reason}</div>}
                {rejected && (
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-sm" onClick={() => post(true)} disabled={loading}>
                      Guardar igual
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="row-between">
            <span className="tiny muted">El análisis tarda entre 1 y 3 minutos.</span>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Encolando…
                </>
              ) : (
                <>
                  <Sparkles /> Analizar
                </>
              )}
            </button>
          </div>
        </form>

        <div className="card card-pad">
          <h3 style={{ marginBottom: 8 }}>Qué hace exactamente</h3>
          <ol className="small muted" style={{ paddingLeft: 17, margin: 0, display: "grid", gap: 8 }}>
            <li><strong>Clasifica</strong> el link: convocatoria, evento, competidor o referencia.</li>
            <li>Si es oportunidad, entra con navegador real y prioriza bases, requisitos y formulario.</li>
            <li>Si es evento, busca fecha, sede, costo, audiencia y call for speakers.</li>
            <li>Si es competidor, lee planes, precios y funcionalidades, y guarda un snapshot para detectar cambios.</li>
            <li>Todo cae en la bandeja de entrada: confirmás el tipo y queda en su pestaña.</li>
          </ol>
          <div className="banner banner-info" style={{ marginTop: 14 }}>
            <Link2 size={15} style={{ flex: "none", marginTop: 2 }} />
            <div className="small">
              Si el sitio pide login o bloquea bots, el panel te lo va a decir en vez de inventar datos.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
