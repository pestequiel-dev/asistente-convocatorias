import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const program = db
    .prepare("SELECT applies_url, contact_url FROM programs WHERE id = ?")
    .get(Number(id)) as { applies_url: string | null; contact_url: string | null } | undefined;
  if (!program?.applies_url && !program?.contact_url) {
    return NextResponse.json({ error: "Esta ficha no tiene un formulario detectado." }, { status: 400 });
  }
  const draft = db
    .prepare("SELECT id FROM application_drafts WHERE program_id = ? ORDER BY id DESC LIMIT 1")
    .get(Number(id));
  if (!draft) return NextResponse.json({ error: "Generá el borrador primero." }, { status: 400 });

  const bin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
  const script = path.join(process.cwd(), "scripts", "prefill.ts");
  if (!fs.existsSync(bin)) return NextResponse.json({ error: "No encontré tsx." }, { status: 500 });

  const child = spawn(bin, [script, String(id)], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  return NextResponse.json({ ok: true, message: "Se está abriendo el navegador con el formulario." });
}
