import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { analyzeProgram } from "@/lib/pipeline";
import { classify, fetchPreview } from "@/lib/classify";
import { resolveStartUrl } from "@/lib/crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM programs ORDER BY created_at DESC").all();
  return NextResponse.json({ programs: rows });
}

export async function DELETE(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "referencia") {
    return NextResponse.json({ error: "Solo se pueden vaciar las referencias" }, { status: 400 });
  }
  const db = getDb();
  const info = db.prepare("DELETE FROM programs WHERE kind = 'referencia'").run();
  return NextResponse.json({ ok: true, deleted: info.changes });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; text?: string; force?: boolean };
  const url = (body.url || "").trim();
  const text = (body.text || "").trim();
  const force = Boolean(body.force);

  if (!url) return NextResponse.json({ error: "Falta el link" }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "El link tiene que empezar con http:// o https://" }, { status: 400 });
  }

  // Cheap gate before creating anything: if the link has nothing to do with the
  // business, reject it instead of spending 1–3 minutes crawling it.
  let preClassified: {
    kind: string;
    confidence: number;
    reason: string;
    relevant?: boolean;
    relevance_reason?: string;
  } | null = null;
  if (!force) {
    try {
      const { start } = resolveStartUrl(url, text);
      const preview = await fetchPreview(start);
      const cls = await classify({ url: start, pasted: text, preview: preview.text });
      // Being a "referencia" is fine (a VC fund, an article about edtech). What we
      // reject is a link unrelated to the business.
      if (!cls.relevant) {
        return NextResponse.json(
          {
            error: "Ese link no tiene que ver con el negocio.",
            rejected: true,
            reason: cls.relevance_reason || cls.reason,
            confidence: cls.confidence,
          },
          { status: 422 }
        );
      }
      preClassified = cls;
    } catch {
      // If the preview fails we let the normal pipeline decide.
    }
  }

  let origin = "web";
  try {
    origin = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* noop */
  }

  const db = getDb();
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO programs (url, source_text, origin, status, created_at, updated_at, pipeline_status)
       VALUES (?, ?, ?, 'queued', ?, ?, 'reviewing')`
    )
    .run(url, text || null, origin, now, now);

  const id = Number(info.lastInsertRowid);

  // Kick off in the background; the worker also picks up anything left 'queued'.
  void analyzeProgram(id, { preClassified: preClassified ?? undefined }).catch((e) =>
    console.error("analyze error", e)
  );

  return NextResponse.json({ id }, { status: 201 });
}
