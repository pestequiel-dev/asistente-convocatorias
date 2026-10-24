"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, X, ArrowRight, ClipboardPaste } from "lucide-react";

/** Reads the clipboard, but never throws: permission can be denied. */
async function readClipboard(): Promise<string> {
  try {
    if (!navigator.clipboard?.readText) return "";
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'<>)\]]+/i);
  return m ? m[0] : null;
}

export function QuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ reason: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
    setBusy(false);
    setError(null);
    fabRef.current?.focus();
  }, []);

  const openModal = useCallback(async () => {
    // The modal lives in the layout and never unmounts: reset every transient
    // state on open, or a previous submit leaves it stuck on "Analizando…".
    setBusy(false);
    setError(null);
    setRejected(null);
    const text = await readClipboard();
    const found = firstUrl(text);
    setUrl(found ?? "");
    setPasted(Boolean(found));
    setOpen(true);
  }, []);

  // Global shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openModal();
      }
      if (e.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openModal, close]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  // The wobble is a one-shot feedback for "I pasted it for you".
  useEffect(() => {
    if (!pasted) return;
    const t = setTimeout(() => setPasted(false), 1100);
    return () => clearTimeout(t);
  }, [pasted]);

  async function post(force: boolean) {
    const clean = url.trim();
    if (!clean) {
      setError("Pegá el link primero.");
      return;
    }
    setBusy(true);
    setError(null);
    setRejected(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 60_000);

    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean, text: "", force }),
        signal: ctrl.signal,
      });

      if (res.status === 422) {
        const data = await res.json();
        setRejected({ reason: data.reason || "" });
        setError(data.error || "Ese link no parece tener que ver con el negocio.");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo analizar el link");
      setOpen(false);
      router.push(`/programa/${data.id}`);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("La operación tardó demasiado. Probá de nuevo.");
      } else {
        setError((err as Error).message);
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="qa-fab"
        onClick={openModal}
        title="Pegar link (⌘K)"
        aria-haspopup="dialog"
      >
        <Link2 size={19} aria-hidden="true" />
        Pegar link
      </button>

      {open && (
        <div
          className="qa-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="qa-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qa-title"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                'button, input, [href], textarea, select, [tabindex]:not([tabindex="-1"])'
              );
              if (!nodes.length) return;
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            }}
          >
            <div className="qa-head">
              <div className="qa-title-row">
                <ClipboardPaste size={18} aria-hidden="true" />
                <h2 id="qa-title">Pegá el link</h2>
              </div>
              <button type="button" className="qa-close" onClick={close} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                post(false);
              }}
            >
              <label className="qa-label" htmlFor="qa-url">
                Link de la convocatoria, evento o competidor
              </label>
              <div className={`qa-field${pasted ? " is-wobbling" : ""}`}>
                <input
                  ref={inputRef}
                  id="qa-url"
                  className="qa-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="qa-hint"
                />
              </div>

              <p id="qa-hint" className="qa-hint" aria-live="polite">
                {pasted
                  ? "Tomé el link de tu portapapeles."
                  : "Si copiaste un link, se pega solo al abrir. Enter para analizarlo."}
              </p>

              {error && (
                <div className="qa-error" role="alert">
                  {error}
                  {rejected?.reason && <div style={{ marginTop: 4, color: "var(--muted)" }}>{rejected.reason}</div>}
                </div>
              )}

              <div className="qa-actions">
                <button type="button" className="btn btn-ghost" onClick={close}>
                  Cancelar
                </button>
                {rejected ? (
                  <button type="button" className="btn" onClick={() => post(true)} disabled={busy}>
                    Guardar igual
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? <span className="spinner" /> : <ArrowRight size={16} />}
                    {busy ? "Verificando…" : "Analizar"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
