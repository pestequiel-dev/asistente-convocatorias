import Database from "better-sqlite3";
const db = new Database("data/app.db");
const urls = db.prepare("select url from programs where status='error' and error like 'No se pudo leer%' limit 10").all().map((r) => r.url);
for (const u of urls) {
  const host = new URL(u).hostname;
  try {
    const t0 = Date.now();
    const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0" } });
    console.log(host.padEnd(32), "→", res.status, `${Date.now() - t0}ms`);
  } catch (e) {
    console.log(host.padEnd(32), "→ ERROR:", String(e.cause?.code || e.name).slice(0, 40));
  }
}
