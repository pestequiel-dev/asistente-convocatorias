"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy, Check, FileSignature, RefreshCw, ExternalLink, AlertTriangle, MonitorUp, Save, Send,
} from "lucide-react";

interface Answer {
  question: string;
  answer: string;
  missing: string | null;
}

export function DraftPanel({
  programId,
  appliesUrl,
  contactUrl,
  onChanged,
}: {
  programId: number;
  appliesUrl: string | null;
  contactUrl: string | null;
  onChanged?: () => void | Promise<void>;
}) {
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillMsg, setPrefillMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);

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
      setDirty(false);
      setSubmitted(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!answers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${programId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markSubmitted() {
    if (!answers) return;
    setBusy(true);
    setError(null);
    try {
      if (dirty) await save();
      const res = await fetch(`/api/programs/${programId}/draft/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setSubmitted(data.doc?.label ?? "Guardada");
      await onChanged?.();
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

  // Every "[FALTA: …]" marker, with the answer it belongs to.
  const gaps = (answers ?? []).flatMap((a, i) =>
    [...a.answer.matchAll(/\[FALTA:[^\]]*\]/gi)].map((m) => ({ i, question: a.question, token: m[0] }))
  );

  function goToGap(i: number, token: string) {
    const el = refs.current[i];
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus();
    const at = el.value.indexOf(token);
    if (at >= 0) el.setSelectionRange(at, at + token.length);
  }

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Borrador de postulación</h2>
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {answers
              ? `${answers.length} respuestas · ${createdAt ? new Date(createdAt).toLocaleString("es-AR") : ""}`
              : "Respuestas redactadas con tu perfil, hitos y documentos"}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {answers && (
            <>
              <button className="btn btn-sm" onClick={generate} disabled={busy}>
                <RefreshCw size={13} /> Regenerar
              </button>
              <button className="btn btn-sm" onClick={save} disabled={busy || !dirty}>
                {saved ? <Check size={13} /> : <Save size={13} />} {saved ? "Guardado" : "Guardar"}
              </button>
            </>
          )}
          {(appliesUrl || contactUrl) && (
            <a className="btn btn-sm" href={(appliesUrl || contactUrl) as string} target="_blank" rel="noreferrer">
              Abrir formulario <ExternalLink size={13} />
            </a>
          )}
          {answers && (appliesUrl || contactUrl) && (
            <button
              className="btn btn-sm btn-primary"
              disabled={prefilling}
              onClick={async () => {
                setPrefilling(true);
                setPrefillMsg(null);
                try {
                  if (dirty) await save();
                  const res = await fetch(`/api/programs/${programId}/prefill`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "No se pudo abrir");
                  setPrefillMsg("Abriendo una ventana de navegador con el formulario. Revisalo y enviá vos.");
                } catch (e) {
                  setPrefillMsg((e as Error).message);
                } finally {
                  setPrefilling(false);
                }
              }}
            >
              <MonitorUp size={13} /> Abrir pre-cargado
            </button>
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
              <code>[FALTA: …]</code>. Después lo editás, lo abrís pre-cargado y lo enviás vos.
            </p>
            <button className="btn btn-primary" onClick={generate} disabled={busy}>
              {busy ? <span className="spinner" /> : <FileSignature size={15} />}
              {busy ? "Redactando…" : "Generar borrador"}
            </button>
          </>
        )}

        {answers && (
          <>
            {submitted && (
              <div className="banner banner-ok" style={{ marginBottom: 14 }}>
                <Check size={15} style={{ flex: "none", marginTop: 2 }} />
                <div>
                  Guardada como documento de ejemplo: <strong>{submitted}</strong>. La próxima postulación va a
                  imitar su tono y estructura.
                </div>
              </div>
            )}

            {gaps.length > 0 && (
              <div className="banner banner-warn" style={{ marginBottom: 14 }}>
                <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <strong>
                    {gaps.length} dato{gaps.length === 1 ? "" : "s"} sin completar.
                  </strong>{" "}
                  Las respuestas de abajo son editables: tocá “Completar” y te lleva al lugar exacto.
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {gaps.map((g, k) => (
                      <div key={k} className="row-between wrap" style={{ gap: 8 }}>
                        <span className="small" style={{ minWidth: 0 }}>
                          {g.question.length > 70 ? `${g.question.slice(0, 70)}…` : g.question} —{" "}
                          <em>{g.token.replace(/^\[FALTA:\s*/i, "").replace(/\]$/, "")}</em>
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => goToGap(g.i, g.token)}
                        >
                          Completar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="stack" style={{ gap: 14 }}>
              {answers.map((a, i) => {
                const itemGaps = [...a.answer.matchAll(/\[FALTA:[^\]]*\]/gi)].map((m) => m[0]);
                return (
                  <div key={i} className={`draft-item${itemGaps.length ? " has-gap" : ""}`}>
                    <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
                      <div className="draft-q">{a.question}</div>
                      <button className="btn btn-sm" onClick={() => copy(a.answer, i)} aria-label="Copiar respuesta">
                        {copied === i ? <Check size={13} /> : <Copy size={13} />}
                        {copied === i ? "Copiado" : "Copiar"}
                      </button>
                    </div>

                    {itemGaps.length > 0 && (
                      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                        {itemGaps.map((token, k) => (
                          <button
                            key={k}
                            type="button"
                            className="gap-chip"
                            onClick={() => goToGap(i, token)}
                            title="Ir al texto y seleccionarlo para reemplazarlo"
                          >
                            <AlertTriangle size={12} aria-hidden="true" />
                            {token.replace(/^\[FALTA:\s*/i, "").replace(/\]$/, "")}
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      className="textarea draft-edit"
                      value={a.answer}
                      onChange={(e) => {
                        const next = [...answers];
                        next[i] = { ...a, answer: e.target.value };
                        setAnswers(next);
                        setDirty(true);
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="row-between wrap" style={{ marginTop: 16, gap: 10 }}>
              <span className="tiny muted" style={{ maxWidth: 460 }}>
                Cuando la envíes, marcala acá: se guarda esta versión como documento de ejemplo (“Aplicación
                anterior”) y el programa pasa a “Aplicada”.
              </span>
              <button className="btn btn-primary" onClick={markSubmitted} disabled={busy || !!submitted}>
                <Send size={15} /> Ya la envié
              </button>
            </div>

            {prefillMsg && (
              <div className="banner banner-info" style={{ marginTop: 14 }}>
                <MonitorUp size={15} style={{ flex: "none", marginTop: 2 }} />
                <div>
                  {prefillMsg}
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    Se abre una ventana de Chromium aparte (no una pestaña del navegador). Completa los campos que
                    puede matchear; lo que no reconoce lo deja vacío. Nunca envía.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
