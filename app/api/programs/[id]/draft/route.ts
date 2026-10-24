import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { generateDraft } from "@/lib/draft";
import type { Criterion, Profile, Program } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db
    .prepare("SELECT id, content, created_at FROM application_drafts WHERE program_id = ? ORDER BY id DESC LIMIT 1")
    .get(Number(id)) as { id: number; content: string; created_at: string } | undefined;
  if (!row) return NextResponse.json({ draft: null });
  return NextResponse.json({ draft: { id: row.id, created_at: row.created_at, answers: JSON.parse(row.content) } });
}

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const program = db.prepare("SELECT * FROM programs WHERE id = ?").get(Number(id)) as Program | undefined;
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile;
  const criteria = db.prepare("SELECT * FROM criteria WHERE program_id = ?").all(Number(id)) as Criterion[];
  const docs = db
    .prepare("SELECT label, content FROM profile_docs ORDER BY id")
    .all() as { label: string; content: string | null }[];

  try {
    const answers = await generateDraft(program, profile, docs, criteria);
    const info = db
      .prepare("INSERT INTO application_drafts (program_id, content, created_at) VALUES (?, ?, ?)")
      .run(Number(id), JSON.stringify(answers), nowIso());
    return NextResponse.json({
      draft: { id: Number(info.lastInsertRowid), created_at: nowIso(), answers },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
