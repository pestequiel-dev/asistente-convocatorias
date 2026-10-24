import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reevaluateProgram } from "@/lib/pipeline";
import { scoreInvestor } from "@/lib/extract-kind";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-score everything against the current profile + milestones.
 * Convocatorias need the LLM (criteria review); investors are deterministic.
 */
export async function POST() {
  const db = getDb();
  let convocatorias = 0;
  let inversores = 0;

  const opps = db.prepare("SELECT id FROM programs WHERE kind = 'convocatoria' AND status = 'ready'").all() as { id: number }[];
  for (const o of opps) {
    const res = await reevaluateProgram(o.id);
    if (res.ok) convocatorias++;
  }

  const invs = db.prepare("SELECT id, meta FROM programs WHERE kind = 'inversor'").all() as { id: number; meta: string | null }[];
  for (const i of invs) {
    if (!i.meta) continue;
    try {
      const fit = scoreInvestor(JSON.parse(i.meta));
      db.prepare("UPDATE programs SET fit_score = ? WHERE id = ?").run(fit, i.id);
      inversores++;
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true, convocatorias, inversores });
}
