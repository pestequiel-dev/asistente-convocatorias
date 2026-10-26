import { NextResponse } from "next/server";
import { getDb, logEvent, nowIso } from "@/lib/db";
import { reevaluateProgram } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "Escribí la corrección." }, { status: 400 });

  const db = getDb();
  const program = db.prepare("SELECT id FROM programs WHERE id = ?").get(Number(id));
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // La corrección manda: se guarda y se re-verifica con ella.
  db.prepare("UPDATE programs SET correction = ?, corrected_at = ?, updated_at = ? WHERE id = ?").run(
    text,
    nowIso(),
    nowIso(),
    Number(id)
  );

  logEvent(Number(id), "correccion", text);
  const result = await reevaluateProgram(Number(id)).catch((e) => ({ ok: false, error: (e as Error).message }));
  return NextResponse.json({ correction: text, result });
}
