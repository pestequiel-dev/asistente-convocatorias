import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getDb();

  const summary = String(body.summary ?? "").trim();
  if (!summary) return NextResponse.json({ error: "Contá qué pasó en este contacto" }, { status: 400 });

  const happenedAt = String(body.happened_at ?? "").trim() || nowIso();
  const now = nowIso();
  db.prepare(
    `INSERT INTO messenger_touchpoints (messenger_id, channel, kind, summary, cost_usd, happened_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(id),
    body.channel ?? null,
    body.kind ?? null,
    summary,
    body.cost_usd == null || body.cost_usd === "" ? null : Number(body.cost_usd),
    happenedAt,
    now
  );

  db.prepare("UPDATE messengers SET last_contact_at = ?, updated_at = ? WHERE id = ?").run(happenedAt, now, Number(id));

  return NextResponse.json({ ok: true }, { status: 201 });
}
