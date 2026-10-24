import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get();
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getDb();

  const fields = [
    "name", "url", "country", "city", "founder_name", "founder_last", "email", "linkedin", "phone", "role", "deck_url", "round_details", "legal_status", "legal_structure_detail", "can_invoice", "founded", "stage", "sector", "description",
    "team_size", "founders", "revenue_usd", "customers", "languages", "tech_stack", "has_product", "notes",
  ] as const;

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      const v = body[f];
      values.push(v === "" || v == null ? null : v);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  sets.push("updated_at = ?");
  values.push(nowIso());

  // Empty strings for NOT NULL columns are normalised to "" instead of NULL.
  const textCols = new Set(["name", "url", "country", "city", "founder_name", "founder_last", "email", "linkedin", "phone", "role", "deck_url", "round_details", "legal_status", "legal_structure_detail", "can_invoice", "founded", "stage", "sector", "description", "languages", "tech_stack", "has_product", "notes"]);

  const stmt = db.prepare(
    `UPDATE profile SET ${sets.map((s) => {
      const col = s.split(" ")[0];
      return textCols.has(col) ? `${col} = COALESCE(?, '')` : s;
    }).join(", ")} WHERE id = 1`
  );
  stmt.run(...values);

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get();
  return NextResponse.json({ ok: true, profile });
}
