"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, FileSignature, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";

interface Answer {
  question: string;
  answer: string;
  missing: string | null;
}

export function DraftPanel({
  programId,
  appliesUrl,
  contactUrl,
}: {
  programId: number;
  appliesUrl: string | null;
  contactUrl: string | null;
}) {
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/draft`, { cache: "no-store" });
    const data = await res.json();
    if (data.draft) {
      setAnswers(data.draft.answers);
      setCreatedAt(data.draft.created_at);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${programId}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar");
      setAnswers(data.draft.answers);
      setCreatedAt(data.draft.created_at);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("No pude copiar al portapapeles.");
    }
  }

  const missing = (answers ?? []).filter((a) => /\[FALTA:/i.test(a.answer)).length;

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Borrador de postulación</h2>
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {answers
              ? `${answers.length} respuestas · generado ${createdAt ? new Date(createdAt).toLocaleString("es-AR") : ""}`
              : "Respuestas redactadas con tu perfil, hitos y documentos"}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {answers && (
            <button className="btn btn-sm" onClick={generate} disabled={busy}>
              <RefreshCw size={13} /> Regenerar
            </button>
          )}
          {(appliesUrl || contactUrl) && (
            <a
              className="btn btn-sm btn-primary"
              href={(appliesUrl || contactUrl) as string}
              target="_blank"
              rel="noreferrer"
            >
              Abrir formulario <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      <div className="panel-body">
        {error && <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div>}

        {!answers && (
          <>
            <p className="small muted" style={{ marginBottom: 12 }}>
              Genero un borrador con las respuestas típicas (problema, solución, tracción, equipo, mercado, uso de
              fondos y por qué este programa). No inventa datos: donde falta información escribe{" "}
              <code>[FALTA: …]</code> para que lo completes vos. Después abrís el formulario y pegás.
            </p>
            <button className="btn btn-primary" onClick={generate} disabled={busy}>
              {busy ? <span className="spinner" /> : <FileSignature size={15} />}
              {busy ? "Redactando…" : "Generar borrador"}
            </button>
          </>
        )}

        {answers && (
          <>
            {missing > 0 && (
              <div className="banner banner-warn" style={{ marginBottom: 14 }}>
                <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
                <div>
                  Hay {missing} respuesta(s) con datos faltantes marcados como <code>[FALTA: …]</code>. Completalos
                  antes de enviar.
                </div>
              </div>
            )}

            <div className="stack" style={{ gap: 14 }}>
              {answers.map((a, i) => (
                <div key={i} className="draft-item">
                  <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
                    <div className="draft-q">{a.question}</div>
                    <button className="btn btn-sm" onClick={() => copy(a.answer, i)} aria-label="Copiar respuesta">
                      {copied === i ? <Check size={13} /> : <Copy size={13} />}
                      {copied === i ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="draft-a">{a.answer}</p>
                </div>
              ))}
            </div>

            <p className="tiny muted" style={{ marginTop: 14 }}>
              Revisalo antes de enviar. La IA trabaja con tus documentos, pero la responsabilidad de lo que se envía
              es tuya.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
