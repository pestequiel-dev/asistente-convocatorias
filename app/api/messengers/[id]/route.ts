import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const messenger = db.prepare("SELECT * FROM messengers WHERE id = ?").get(Number(id));
  if (!messenger) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const touchpoints = db
    .prepare("SELECT * FROM messenger_touchpoints WHERE messenger_id = ? ORDER BY happened_at DESC, id DESC")
    .all(Number(id));
  return NextResponse.json({ messenger, touchpoints });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getDb();

  const allowed = [
    "name", "role", "organization", "country", "platform", "handle", "audience",
    "audience_size", "topics", "status", "rate_usd", "rate_notes", "notes",
  ];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`);
      const v = body[key];
      values.push(v === "" ? null : v);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  sets.push("updated_at = ?");
  values.push(nowIso(), Number(id));
  db.prepare(`UPDATE messengers SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  return NextResponse.json({ ok: true, messenger: db.prepare("SELECT * FROM messengers WHERE id = ?").get(Number(id)) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare("DELETE FROM messengers WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
