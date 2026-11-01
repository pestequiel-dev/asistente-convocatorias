"use client";

import { useState } from "react";
import { Pencil, RefreshCw, Send, X } from "lucide-react";
import type { Criterion } from "@/lib/types";
import { CRITERION, toneClass } from "./format";

const TONE_BG: Record<string, string> = {
  cumple: "var(--ok-soft)",
  no_cumple: "var(--danger-soft)",
  ambiguo: "#f1f1ee",
  falta_dato: "var(--warn-soft)",
  no_aplica: "#f1f1ee",
};

const TONE_FG: Record<string, string> = {
  cumple: "var(--ok)",
  no_cumple: "var(--danger)",
  ambiguo: "var(--text-2)",
  falta_dato: "var(--warn)",
  no_aplica: "var(--muted)",
};

const ACTION_LABEL: Record<string, string> = {
  falta_dato: "Aportar el dato",
  ambiguo: "Aclarar",
  no_cumple: "Corregir",
  no_aplica: "Revisar",
};

export function EvidenceSection({
  criteria,
  onReevaluate,
  onChanged,
  busy,
}: {
  criteria: Criterion[];
  onReevaluate: () => void;
  onChanged: () => void | Promise<void>;
  busy: boolean;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = criteria.reduce(
    (acc, c) => {
      acc[c.verdict] = (acc[c.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function open(c: Criterion) {
    setOpenId(c.id);
    setDraft(c.user_note ?? "");
    setError(null);
  }

  function close() {
    setOpenId(null);
    setError(null);
  }

  async function removeNote(c: Criterion) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/criteria/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo quitar el aporte");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submit(c: Criterion) {
    if (!draft.trim()) {
      setError("Escribí el dato antes de re-analizar.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/criteria/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo re-analizar");
      setOpenId(null);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="ev-title">
      <div className="panel-head">
        <div>
          <h2 id="ev-title">Evidencias</h2>
          <div className="tiny muted" style={{ marginTop: 2 }}>
            Cada veredicto con su cita y su fuente · {counts.cumple ?? 0} cumple ·{" "}
            {counts.falta_dato ?? 0} falta dato · {counts.no_cumple ?? 0} no cumple ·{" "}
            {counts.ambiguo ?? 0} ambiguo
            {counts.no_aplica ? ` · ${counts.no_aplica} no aplica` : ""}
          </div>
        </div>
        <button className="btn btn-sm" onClick={onReevaluate} disabled={busy || !criteria.length}>
          <RefreshCw size={13} /> Re-evaluar
        </button>
      </div>

      <div className="panel-body" style={{ paddingTop: 4 }}>
        {criteria.length === 0 ? (
          <p className="muted small">
            No se encontraron requisitos explícitos. Revisá las fuentes: puede que las bases estén en un PDF
            protegido o requieran login.
          </p>
        ) : (
          criteria.map((c) => {
            const meta = CRITERION[c.verdict] ?? CRITERION.falta_dato;
            const isOpen = openId === c.id;
            return (
              <div className={`criterion${isOpen ? " is-open" : ""}`} key={c.id}>
                <div
                  className="criterion-icon"
                  style={{ background: TONE_BG[c.verdict] ?? "#f1f1ee", color: TONE_FG[c.verdict] ?? "var(--text-2)" }}
                  aria-hidden="true"
                >
                  {meta.icon}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 500, lineHeight: 1.4 }}>{c.text}</div>
                    <span
                      className={toneClass(meta.tone === "gray" ? "gray" : meta.tone)}
                      style={{ flex: "none" }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {c.reason && <div className="small muted" style={{ marginTop: 5 }}>{c.reason}</div>}

                  {c.verdict === "no_cumple" && (
                    <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          await fetch(`/api/criteria/${c.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ verdict: "no_aplica" }),
                          });
                          await onChanged?.();
                        }}
                      >
                        No aplica (es de otro track)
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          await fetch(`/api/criteria/${c.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ verdict: "cumple" }),
                          });
                          await onChanged?.();
                        }}
                      >
                        Lo cumplimos
                      </button>
                    </div>
                  )}

                  {c.user_note && (
                    <div className="crit-note">
                      <strong>Tu aporte:</strong> {c.user_note}
                    </div>
                  )}

                  {!isOpen && (
                    <div className="row wrap" style={{ gap: 8, marginTop: 9 }}>
                      <button
                        type="button"
                        className="crit-action"
                        style={{ marginTop: 0 }}
                        onClick={() => open(c)}
                        aria-expanded={false}
                        aria-label={`${ACTION_LABEL[c.verdict] ?? "Aportar dato"} en: ${c.text.slice(0, 60)}`}
                      >
                        <Pencil size={13} aria-hidden="true" />
                        {c.user_note ? "Editar aporte" : ACTION_LABEL[c.verdict] ?? "Aportar dato"}
                      </button>
                      {c.user_note && (
                        <button
                          type="button"
                          className="crit-action"
                          style={{ marginTop: 0 }}
                          onClick={() => removeNote(c)}
                          disabled={saving}
                        >
                          <X size={13} aria-hidden="true" /> Quitar aporte
                        </button>
                      )}
                    </div>
                  )}

                  {isOpen && (
                    <form
                      className="crit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit(c);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") close();
                      }}
                    >
                      <label className="label" htmlFor={`note-${c.id}`}>
                        Contale a la IA el dato que falta
                      </label>
                      <textarea
                        id={`note-${c.id}`}
                        className="textarea"
                        autoFocus
                        rows={3}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Ej.: facturamos USD 0, todavía no tenemos ingresos; factura la cooperativa. O: todos los fundadores tenemos más de 18 años."
                      />
                      <span className="hint">
                        Si es un dato permanente (facturación, equipo, constitución), conviene cargarlo también en
                        el perfil para que aplique a todas las convocatorias.
                      </span>
                      <div className="crit-form-actions">
                        <button className="btn btn-sm btn-primary" type="submit" disabled={saving}>
                          {saving ? <span className="spinner" /> : <Send size={13} />}
                          {saving ? "Re-analizando…" : "Re-analizar con este dato"}
                        </button>
                        <button className="btn btn-sm btn-ghost" type="button" onClick={close}>
                          <X size={13} /> Cancelar
                        </button>
                      </div>
                      {error && <div className="crit-error">{error}</div>}
                    </form>
                  )}

                  {c.quote && <div className="quote" style={{ marginTop: 8 }}>“{c.quote}”</div>}
                  {c.source_url && (
                    <a
                      href={c.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="tiny src-link"
                      style={{ display: "inline-block", marginTop: 6 }}
                    >
                      {c.source_url}
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
