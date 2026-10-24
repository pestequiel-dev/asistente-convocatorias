import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContactMessage } from "@/lib/email";
import { detectLanguage } from "@/lib/lang";
import type { Profile, Program } from "@/lib/types";
import { nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const program = db.prepare("SELECT * FROM programs WHERE id = ?").get(Number(id)) as Program | undefined;
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile;
  const docs = db.prepare("SELECT label, content FROM profile_docs ORDER BY id").all() as {
    label: string;
    content: string | null;
  }[];
  const sources = db
    .prepare("SELECT text FROM sources WHERE program_id = ? AND status = 'ok' ORDER BY id LIMIT 4")
    .all(Number(id)) as { text: string | null }[];
  const language = detectLanguage(sources.map((s) => s.text ?? "").join(" ").slice(0, 12000) || (program.summary ?? ""));

  try {
    const message = await generateContactMessage(program, profile, docs, language);
    // Stored as a draft so the prefill can fill the contact form's message box.
    db.prepare(
      "INSERT INTO application_drafts (program_id, content, source, created_at) VALUES (?, ?, 'contact', ?)"
    ).run(Number(id), JSON.stringify([{ question: "Mensaje", answer: message, missing: null }]), nowIso());
    return NextResponse.json({ message });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
