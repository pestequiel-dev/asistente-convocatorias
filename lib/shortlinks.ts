/** bit.ly-style links hide the real destination; resolve them before deciding. */
const SHORTENERS = [
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "cutt.ly", "shorturl.at", "rebrand.ly", "rb.gy", "tiny.cc", "lnkd.in", "short.io",
  "t.ly", "s.id", "tr.ee", "urlz.fr", "x.gd",
];

export function isShortener(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return SHORTENERS.some((s) => h === s || h.endsWith("." + s));
  } catch {
    return false;
  }
}

/** Follows redirects (max 5 hops) and returns the final URL, or null. */
export async function resolveShortUrl(url: string): Promise<string | null> {
  let current = url;
  try {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36" },
        signal: AbortSignal.timeout(8000),
      });
      const location = res.headers.get("location");
      if (!location) return current !== url ? current : null;
      current = new URL(location, current).toString();
      if (!isShortener(current) && !/^https?:\/\/(bit\.ly|tinyurl)/i.test(current)) {
        // One more hop is often a consent/interstitial; stop when it's a real site.
        return current;
      }
    }
    return current;
  } catch {
    return null;
  }
}
