/** Finds a live page for a dead domain by searching DuckDuckGo (no API key). */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function registrable(host: string) {
  return host.replace(/^www\./, "").split(".").slice(-2).join(".");
}

const PREFERRED = /(convocatoria|postul|aplica|bases|concurso|programa|comunidad|startups|es\/|chile|colombia|mexico|m[eé]xico|argentina|latam)/i;

export async function findLiveAlternative(rawUrl: string): Promise<{ url: string; candidates: string[] } | null> {
  let base: string;
  try {
    base = registrable(new URL(rawUrl).hostname);
  } catch {
    return null;
  }

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${base}`)}`, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.log(`[search] ${base}: HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();

    const found: string[] = [];
    for (const m of html.matchAll(/uddg=([^&"]+)/g)) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(m[1]);
      } catch {
        continue;
      }
      try {
        const u = new URL(decoded);
        if (registrable(u.hostname) !== base) continue;
        if (/\.(pdf|jpg|png|zip|mp4)$/i.test(u.pathname)) continue;
        if (/(wp-admin|wp-login|feed|\.xml)/i.test(u.pathname)) continue;
        if (!found.includes(decoded)) found.push(decoded);
      } catch {
        /* ignore */
      }
    }

    console.log(`[search] ${base}: ${found.length} resultado(s)`);
    if (!found.length) return null;

    const ranked = [...found].sort((a, b) => Number(PREFERRED.test(b)) - Number(PREFERRED.test(a)));
    return { url: ranked[0], candidates: ranked.slice(0, 5) };
  } catch (e) {
    console.log(`[search] ${base}: fallo ${(e as Error).message.slice(0, 80)}`);
    return null;
  }
}
