"use client";

import { Check, Copy, Mail, Send } from "lucide-react";
import { useState } from "react";

export function EmailPanel({ programId, to }: { programId: number; to: string }) {
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/programs/${programId}/email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar");
      setEmail(data.email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, which: "subject" | "body") {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  const mailto = email
    ? `mailto:${to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
    : `mailto:${to}`;

  return (
    <div className="card">
      <div className="row-between wrap" style={{ marginBottom: 10 }}>
        <div>
          <div className="card-title">Email de contacto</div>
          <div className="tiny muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Mail size={12} /> {to}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? <span className="spinner" /> : <Mail size={15} />} {email ? "Regenerar" : "Preparar email"}
          </button>
          {email && (
            <a className="btn" href={mailto}>
              <Send size={15} /> Abrir en mi correo
            </a>
          )}
        </div>
      </div>

      {error && <div className="banner banner-warn" style={{ marginBottom: 10 }}>{error}</div>}

      {email && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="field">
            <div className="row-between">
              <label className="label">Asunto</label>
              <button className="btn btn-sm" onClick={() => copy(email.subject, "subject")}>
                {copied === "subject" ? <Check size={12} /> : <Copy size={12} />} Copiar
              </button>
            </div>
            <input
              className="input"
              value={email.subject}
              onChange={(e) => setEmail({ ...email, subject: e.target.value })}
            />
          </div>

          <div className="field">
            <div className="row-between">
              <label className="label">Mensaje</label>
              <button className="btn btn-sm" onClick={() => copy(email.body, "body")}>
                {copied === "body" ? <Check size={12} /> : <Copy size={12} />} Copiar
              </button>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 200 }}
              value={email.body}
              onChange={(e) => setEmail({ ...email, body: e.target.value })}
            />
          </div>

          <div className="tiny muted">
            El deck no se adjunta solo: pegá el link en el mensaje (o adjuntalo en tu cliente de correo).
          </div>
        </div>
      )}
    </div>
  );
}
