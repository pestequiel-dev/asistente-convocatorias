import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Saves the version the founder actually sent as a new example document. */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();

  const program = db
    .prepare("SELECT id, title, organization, type, applies_url, contact_url, kind FROM programs WHERE id = ?")
    .get(Number(id)) as
    | {
        id: number;
        title: string | null;
        organization: string | null;
        type: string | null;
        applies_url: string | null;
        contact_url: string | null;
        kind: string;
      }
    | undefined;
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const draft = db
    .prepare("SELECT content FROM application_drafts WHERE program_id = ? ORDER BY id DESC LIMIT 1")
    .get(Number(id)) as { content: string } | undefined;
  if (!draft) return NextResponse.json({ error: "No hay borrador para guardar" }, { status: 400 });

  const answers = JSON.parse(draft.content) as { question: string; answer: string }[];
  const body = answers
    .map((a) => `${a.question}\n${a.answer}`)
    .join("\n\n")
    .slice(0, 9000);

  const where = [program.organization, program.type].filter(Boolean).join(" · ");
  const label = `Aplicación — ${program.title || "programa"}${where ? ` (${where})` : ""} — ${nowIso().slice(0, 10)}`;

  const info = db
    .prepare("INSERT INTO profile_docs (label, url, kind, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(label, program.applies_url || program.contact_url || "", "Aplicación anterior", body, nowIso());

  // Any kind with a real form (convocatoria, inversor) can be "sent".
  db.prepare("UPDATE programs SET pipeline_status = 'applied', applied_at = ?, updated_at = ? WHERE id = ?").run(
    nowIso(),
    nowIso(),
    Number(id)
  );

  return NextResponse.json({
    ok: true,
    doc: { id: Number(info.lastInsertRowid), label, chars: body.length },
  });
}
