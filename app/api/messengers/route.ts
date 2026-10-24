import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

const FIELDS = [
  "name", "role", "organization", "country", "platform", "handle", "audience",
  "audience_size", "topics", "status", "rate_usd", "rate_notes", "notes",
] as const;

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM messenger_touchpoints t WHERE t.messenger_id = m.id) AS touches,
              (SELECT COALESCE(SUM(cost_usd),0) FROM messenger_touchpoints t WHERE t.messenger_id = m.id) AS spent
       FROM messengers m ORDER BY m.updated_at DESC`
    )
    .all();
  return NextResponse.json({ messengers: rows });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const db = getDb();
  const cols = ["name", ...FIELDS.filter((f) => f !== "name")];
  const values = cols.map((c) => {
    const v = body[c];
    return v === "" || v == null ? null : v;
  });
  const now = nowIso();
  const info = db
    .prepare(`INSERT INTO messengers (${cols.join(", ")}, status, created_at, updated_at)
              VALUES (${cols.map(() => "?").join(", ")}, COALESCE(?, 'nuevo'), ?, ?)`)
    .run(...values, String(body.status ?? "nuevo"), now, now);

  const messenger = db.prepare("SELECT * FROM messengers WHERE id = ?").get(Number(info.lastInsertRowid));
  return NextResponse.json({ messenger }, { status: 201 });
}
