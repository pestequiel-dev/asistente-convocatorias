import { NextResponse } from "next/server";
import { reevaluateCriterion } from "@/lib/pipeline";
import { logEvent } from "@/lib/db";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const note = (body.note || "").trim();
  if (!note) return NextResponse.json({ error: "Escribí el dato antes de re-analizar" }, { status: 400 });

  const res = await reevaluateCriterion(Number(id), note);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json(res);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await reevaluateCriterion(Number(id), "");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json(res);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const criterion = db.prepare("SELECT * FROM criteria WHERE id = ?").get(Number(id));
  if (!criterion) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ criterion });
}
