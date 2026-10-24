import { NextResponse } from "next/server";
import { getDb, getSetting, nowIso, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM programs GROUP BY status").all() as {
    status: string;
    n: number;
  }[];
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.n]));

  const avgRow = db
    .prepare(
      `SELECT AVG(julianday(analyzed_at) - julianday(started_at)) * 24 * 60 AS mins
       FROM (SELECT analyzed_at, started_at FROM programs
             WHERE analyzed_at IS NOT NULL AND started_at IS NOT NULL
             ORDER BY analyzed_at DESC LIMIT 20)`
    )
    .get() as { mins: number | null };

  const concurrency = Math.max(1, Math.min(4, Number(getSetting("queue_concurrency") || 2)));
  const pending = counts.queued ?? 0;
  const avgMin = avgRow.mins ? Number(avgRow.mins.toFixed(1)) : null;
  const etaMin = avgMin ? Math.ceil((pending * avgMin) / concurrency) : null;

  const heartbeat = getSetting("worker_heartbeat");
  const heartbeatAge = heartbeat ? Math.round((Date.now() - new Date(heartbeat).getTime()) / 1000) : null;

  return NextResponse.json({
    counts,
    pending,
    paused: getSetting("queue_paused") === "1",
    concurrency,
    avgMinutes: avgMin,
    etaMinutes: etaMin,
    workerAlive: heartbeatAge !== null && heartbeatAge < 20,
    heartbeatAge,
    next: db
      .prepare("SELECT id, url FROM programs WHERE status = 'queued' ORDER BY id LIMIT 8")
      .all(),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean; concurrency?: number };
  if (typeof body.paused === "boolean") setSetting("queue_paused", body.paused ? "1" : "0");
  if (body.concurrency != null) {
    setSetting("queue_concurrency", String(Math.max(1, Math.min(4, Number(body.concurrency) || 2))));
  }
  setSetting("queue_updated_at", nowIso());
  return NextResponse.json({ ok: true });
}
