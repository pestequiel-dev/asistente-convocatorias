import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { generateDraft } from "@/lib/draft";
import { extractFormQuestions } from "@/lib/form-questions";
import type { Criterion, Profile, Program } from "@/lib/types";

/** Very small language probe over what we crawled; enough to pick es/en. */
function detectLanguage(text: string): "es" | "en" {
  const en = (text.match(/\b(the|and|with|for|you|your|we|our|is|are|of|to|in|what|how)\b/gi) ?? []).length;
  const es = (text.match(/\b(el|la|los|las|de|que|y|con|para|por|tu|su|es|son|en|del|una|como)\b/gi) ?? []).length;
  return en > es * 1.15 && en > 8 ? "en" : "es";
}

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

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { answers?: unknown };
  if (!Array.isArray(body.answers)) return NextResponse.json({ error: "Faltan las respuestas" }, { status: 400 });

  const db = getDb();
  const row = db
    .prepare("SELECT id FROM application_drafts WHERE program_id = ? ORDER BY id DESC LIMIT 1")
    .get(Number(id)) as { id: number } | undefined;
  if (!row) return NextResponse.json({ error: "No hay borrador para guardar" }, { status: 404 });

  const clean = (body.answers as { question?: string; answer?: string }[])
    .map((a) => ({
      question: String(a.question ?? "").slice(0, 200),
      answer: String(a.answer ?? "").slice(0, 3000),
      missing: null,
    }))
    .filter((a) => a.question);

  db.prepare("UPDATE application_drafts SET content = ? WHERE id = ?").run(JSON.stringify(clean), row.id);
  return NextResponse.json({ ok: true });
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

  const sources = db
    .prepare("SELECT text FROM sources WHERE program_id = ? AND status = 'ok' ORDER BY id LIMIT 4")
    .all(Number(id)) as { text: string | null }[];
  const corpus = `${program.title ?? ""} ${program.summary ?? ""} ${sources.map((s) => s.text ?? "").join(" ")}`.slice(0, 12000);
  const language =
    /\bingl[eé]s\b/i.test(program.language ?? "") ? "en" : detectLanguage(corpus);

  try {
    // Read the real form first, so the draft answers the questions that are
    // actually asked instead of a generic template.
    let formQuestions: string[] = [];
    const formUrl = program.applies_url || program.contact_url;
    if (formUrl) {
      formQuestions = await extractFormQuestions(formUrl).catch(() => []);
    }

    const answers = await generateDraft(program, profile, docs, criteria, language, formQuestions);
    const info = db
      .prepare("INSERT INTO application_drafts (program_id, content, created_at) VALUES (?, ?, ?)")
      .run(Number(id), JSON.stringify(answers), nowIso());
    return NextResponse.json({
      draft: { id: Number(info.lastInsertRowid), created_at: nowIso(), answers, language },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
