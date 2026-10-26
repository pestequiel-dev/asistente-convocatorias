import { NextResponse } from "next/server";
import { getDb, logEvent, nowIso } from "@/lib/db";
import { statusLabel } from "@/lib/labels";
import { analyzeProgram, reevaluateProgram } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const program = db.prepare("SELECT * FROM programs WHERE id = ?").get(Number(id));
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const sources = db.prepare("SELECT id, url, title, kind, depth, status, fetched_at, error, length(text) AS chars FROM sources WHERE program_id = ? ORDER BY depth, id").all(Number(id));
  const criteria = db.prepare("SELECT * FROM criteria WHERE program_id = ? ORDER BY id").all(Number(id));
  const dates = db.prepare("SELECT * FROM key_dates WHERE program_id = ? ORDER BY id").all(Number(id));
  return NextResponse.json({ program, sources, criteria, dates });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getDb();

  const allowed = ["pipeline_status", "notes", "priority", "title", "closing_at", "kind", "url"] as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key === "url" && key in body) {
      const v = String(body[key] ?? "").trim();
      if (!/^https?:\/\//i.test(v)) return NextResponse.json({ error: "La URL debe empezar con http" }, { status: 400 });
    }
    if (key in body) {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  // Confirming or changing the kind counts as triage: the record leaves the inbox.
  if ("kind" in body) sets.push("kind_confirmed = 1");
  sets.push("updated_at = ?");
  values.push(nowIso(), Number(id));

  if (typeof body.notes === "string" && body.notes.trim()) {
    const prev = db.prepare("SELECT notes FROM programs WHERE id = ?").get(Number(id)) as { notes: string | null } | undefined;
    if ((prev?.notes ?? "") !== body.notes) {
      logEvent(Number(id), "nota", body.notes.trim().slice(0, 400));
    }
  }

  if (body.pipeline_status) {
    const before = db.prepare("SELECT pipeline_status FROM programs WHERE id = ?").get(Number(id)) as { pipeline_status: string } | undefined;
    if (before && before.pipeline_status !== body.pipeline_status) {
      logEvent(Number(id), "estado", `Estado: ${statusLabel(before.pipeline_status)} → ${statusLabel(String(body.pipeline_status))}`);
    }
    // "Pitch enviado" implies it was sent, even if the date wasn't registered.
    if (body.pipeline_status === "applied") {
      db.prepare("UPDATE programs SET applied_at = COALESCE(applied_at, ?) WHERE id = ?").run(nowIso(), Number(id));
    }
  }

  db.prepare(`UPDATE programs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare("DELETE FROM programs WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const db = getDb();

  if (action === "reevaluate") {
    const res = await reevaluateProgram(Number(id));
    return NextResponse.json(res);
  }

  // default: re-analyze from scratch, optionally forcing the kind the user chose
  const forced = url.searchParams.get("kind") || undefined;
  db.prepare("UPDATE programs SET status = 'queued', error = NULL, updated_at = ? WHERE id = ?").run(
    nowIso(),
    Number(id)
  );
  void analyzeProgram(Number(id), { forceKind: forced }).catch((e) => console.error(e));
  return NextResponse.json({ ok: true });
}
