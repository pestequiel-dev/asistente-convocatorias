import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { generateDraft } from "@/lib/draft";
import { extractFormQuestions } from "@/lib/form-questions";
import { detectLanguage } from "@/lib/lang";
import type { Criterion, Profile, Program } from "@/lib/types";



export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db
    .prepare("SELECT id, content, source, created_at FROM application_drafts WHERE program_id = ? ORDER BY id DESC LIMIT 1")
    .get(Number(id)) as { id: number; content: string; source: string | null; created_at: string } | undefined;
  if (!row) return NextResponse.json({ draft: null });
  return NextResponse.json({
    draft: { id: row.id, created_at: row.created_at, source: row.source, answers: JSON.parse(row.content) },
  });
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

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { questions?: unknown };
  const manual = Array.isArray(body.questions)
    ? body.questions.map((q) => String(q).trim()).filter((q) => q.length > 3).slice(0, 20)
    : [];
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
    let source: "form" | "generic" | "login" | "blocked" = "generic";
    const formUrl = program.applies_url || program.contact_url;

    if (manual.length) {
      // The user pasted the questions by hand (login-walled forms).
      formQuestions = manual;
      source = "form";
    } else if (formUrl) {
      // Reuse the program's browser profile: if the user logged in there once,
      // we can read a form that requires a session.
      const read = await extractFormQuestions(formUrl, Number(id)).catch(() => null);
      if (read?.status === "ok") {
        formQuestions = read.questions;
        source = "form";
      } else if (read?.status === "login") {
        source = "login";
      } else if (read?.status === "blocked") {
        source = "blocked";
      }
    }

    // If the form itself is in English, the answers must be too.
    let finalLanguage = language;
    if (formQuestions.length) {
      const en = (formQuestions.join(" ").match(/\b(the|your|what|why|which|have|you|is|are|of|to)\b/gi) ?? []).length;
      if (en > formQuestions.length * 1.2) finalLanguage = "en";
    }

    const answers = await generateDraft(program, profile, docs, criteria, finalLanguage, formQuestions);
    const info = db
      .prepare("INSERT INTO application_drafts (program_id, content, source, created_at) VALUES (?, ?, ?, ?)")
      .run(Number(id), JSON.stringify(answers), source, nowIso());
    return NextResponse.json({
      draft: { id: Number(info.lastInsertRowid), created_at: nowIso(), answers, language: finalLanguage, source },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
