/**
 * Background queue worker: claims up to N jobs at once, honours the pause flag,
 * and survives restarts (everything lives in SQLite).
 */
import fs from "node:fs";
import path from "node:path";
import { getDb, getSetting, nowIso, setSetting } from "./lib/db";
import { analyzeProgram } from "./lib/pipeline";

// Next.js loads .env.local automatically; the worker runs standalone.
try {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

const POLL_MS = 1500;
const STALE_MS = 8 * 60 * 1000;

let stopping = false;
let inflight = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function recoverStale() {
  const db = getDb();
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const res = db
    .prepare(
      "UPDATE programs SET status = 'queued', error = 'Se reintentó automáticamente (proceso interrumpido)' WHERE status IN ('crawling','extracting') AND updated_at < ?"
    )
    .run(cutoff);
  if (res.changes) console.log(`[worker] ${res.changes} trabajo(s) colgado(s) reencolado(s)`);
}

function concurrency() {
  const n = Number(getSetting("queue_concurrency") || 2);
  return Math.max(1, Math.min(4, Number.isFinite(n) ? n : 2));
}

function paused() {
  return getSetting("queue_paused") === "1";
}

async function loop() {
  console.log("[worker] listo");
  recoverStale();

  while (!stopping) {
    setSetting("worker_heartbeat", nowIso());

    if (paused() || inflight >= concurrency()) {
      await sleep(POLL_MS);
      continue;
    }

    const db = getDb();
    const next = db.prepare("SELECT id FROM programs WHERE status = 'queued' ORDER BY id LIMIT 1").get() as
      | { id: number }
      | undefined;

    if (!next) {
      await sleep(POLL_MS);
      continue;
    }

    inflight++;
    const t0 = Date.now();
    analyzeProgram(next.id)
      .then(() => console.log(`[worker] #${next.id} en ${Math.round((Date.now() - t0) / 1000)}s`))
      .catch((e) => console.error(`[worker] #${next.id} falló`, e))
      .finally(() => {
        inflight--;
      });
  }
}

process.on("SIGINT", () => {
  stopping = true;
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopping = true;
  process.exit(0);
});

loop().catch((e) => {
  console.error("[worker] error fatal", e);
  process.exit(1);
});
