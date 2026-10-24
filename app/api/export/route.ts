import { getDb } from "@/lib/db";
import type { Program } from "@/lib/types";

export const dynamic = "force-dynamic";

function esc(v: unknown) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM programs ORDER BY created_at DESC").all() as Program[];

  const header = [
    "Programa", "Organización", "Tipo", "Alcance", "Sector", "Etapa", "Equity", "Beneficios",
    "Cierre", "Cierre (texto)", "Elegibilidad %", "Veredicto", "Estado pipeline", "Formulario",
    "Plataforma", "Documentos", "Fuente", "Modo", "Páginas", "Analizado", "Notas",
  ];

  const lines = [header.map(esc).join(",")];
  for (const p of rows) {
    let docs: string[] = [];
    try {
      docs = JSON.parse(p.docs_required || "[]");
    } catch {
      /* noop */
    }
    lines.push(
      [
        p.title || p.url, p.organization, p.type, p.scope, p.sector_focus, p.stage_focus,
        p.equity, p.funding, p.closing_at, p.closing_raw, p.eligibility_score, p.verdict,
        p.pipeline_status, p.applies_url, p.form_platform, docs.join(" | "), p.url, p.mode,
        p.pages_crawled, p.analyzed_at, p.notes,
      ]
        .map(esc)
        .join(",")
    );
  }

  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="convocatorias-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
