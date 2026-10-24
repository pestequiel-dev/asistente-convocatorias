"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, KeyRound, Save, Zap } from "lucide-react";

interface SettingsState {
  model: string;
  baseUrl: string;
  maxPages: number;
  hasKey: boolean;
  keyHint: string;
  usingEnv: boolean;
}

export default function AjustesPage() {
  const [s, setS] = useState<SettingsState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setS);
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setTest(null);
    const body: Record<string, unknown> = { model: s.model, baseUrl: s.baseUrl, maxPages: s.maxPages };
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const fresh = await fetch("/api/settings").then((r) => r.json());
    setS(fresh);
    setApiKey("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/settings", { method: "POST" });
      const data = await res.json();
      setTest({ ok: res.ok && data.ok, msg: data.ok ? "Conexión con DeepSeek verificada." : data.error || "Falló" });
    } catch (e) {
      setTest({ ok: false, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  if (!s) return <div className="row muted"><span className="spinner spinner-dark" /> Cargando…</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -9 }}>
        <ArrowLeft /> Volver al panel
      </Link>

      <div className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Conectá DeepSeek para que el análisis sea profundo. Sin key, el panel usa un modo heurístico de respaldo.</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? "Guardado" : "Guardar"}
        </button>
      </div>

      <div className="stack">
        <section className="card card-pad">
          <div className="row" style={{ marginBottom: 14 }}>
            <KeyRound size={17} style={{ color: "var(--accent)" }} />
            <h2>DeepSeek</h2>
            {s.hasKey && <span className="badge badge-green">conectado</span>}
            {!s.hasKey && <span className="badge badge-amber">sin configurar</span>}
          </div>

          <div className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label className="label">API key</label>
              <input
                className="input"
                type="password"
                placeholder={s.hasKey ? `Configurada (${s.keyHint}) — pegá otra para reemplazarla` : "sk-…"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <span className="hint">
                Se guarda solo en tu base local (<code>data/app.db</code>). También podés usar la variable de entorno
                <code> DEEPSEEK_API_KEY</code>.
                {s.usingEnv && " Ahora mismo está tomando la key del entorno."}
              </span>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="label">Modelo</label>
                <select className="select" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
                  <option value="deepseek-chat">deepseek-chat (recomendado)</option>
                  <option value="deepseek-reasoner">deepseek-reasoner (más lento, más caro)</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Máximo de páginas por análisis</label>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={60}
                  value={s.maxPages}
                  onChange={(e) => setS({ ...s, maxPages: Number(e.target.value) })}
                />
                <span className="hint">Más páginas = más profundo y más lento.</span>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={runTest} disabled={testing || !s.hasKey}>
                {testing ? <span className="spinner spinner-dark" /> : <Zap size={14} />}
                Probar conexión
              </button>
              {test && (
                <span className={`badge ${test.ok ? "badge-green" : "badge-red"}`}>{test.msg}</span>
              )}
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 style={{ marginBottom: 10 }}>Cómo funciona el rastreo</h2>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0, display: "grid", gap: 7, lineHeight: 1.55 }}>
            <li>Usa un Chromium headless para renderizar JavaScript, con user-agent de escritorio.</li>
            <li>Ordena los links por relevancia: bases, reglamento, requisitos, postular, formulario.</li>
            <li>Baja y parsea PDFs; si un PDF es escaneado, avisa que no pudo leerlo.</li>
            <li>Guarda cada página como evidencia con su hash, para auditar cualquier dato del panel.</li>
            <li>Cada campo extraído incluye cita textual y URL; si no hay cita, el dato no se muestra como seguro.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
