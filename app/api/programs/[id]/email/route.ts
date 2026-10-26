import { NextResponse } from "next/server";
import { getDb, logEvent } from "@/lib/db";
import { generateEmail } from "@/lib/email";
import { detectLanguage } from "@/lib/lang";
import type { Profile, Program } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const program = db.prepare("SELECT * FROM programs WHERE id = ?").get(Number(id)) as Program | undefined;
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile;
  const docs = db
    .prepare("SELECT label, content FROM profile_docs ORDER BY id")
    .all() as { label: string; content: string | null }[];

  // The fund's own pages say which language they speak.
  const sources = db
    .prepare("SELECT text FROM sources WHERE program_id = ? AND status = 'ok' ORDER BY id LIMIT 4")
    .all(Number(id)) as { text: string | null }[];
  // Sources only: our own summary is always in Spanish and would skew this.
  const corpus = sources.map((s) => s.text ?? "").join(" ").slice(0, 12000);
  const language = detectLanguage(corpus || (program.summary ?? ""));
  try {
    const email = await generateEmail(program, profile, docs, language);
    logEvent(Number(id), "email", `Email preparado (${language})`);
    return NextResponse.json({ email, to: program.contact });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
