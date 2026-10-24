import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { selectMessengers } from "@/lib/messengers";
import type { Messenger } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { brief?: string };
  const brief = (body.brief ?? "").trim();
  if (!brief) return NextResponse.json({ error: "Escribí el brief o el tema" }, { status: 400 });

  const db = getDb();
  const list = db.prepare("SELECT * FROM messengers").all() as Messenger[];
  const result = await selectMessengers(brief, list);
  return NextResponse.json(result);
}
