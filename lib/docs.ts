/** Reads a public doc (Google Doc, PDF or HTML page) and returns plain text for the LLM. */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function normaliseUrl(raw: string): string {
  const url = raw.trim();
  // Public Google Docs render via JS; the export endpoint returns plain text.
  const gdoc = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (gdoc) return `https://docs.google.com/document/d/${gdoc[1]}/export?format=txt`;
  const gsheet = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (gsheet) return `https://docs.google.com/spreadsheets/d/${gsheet[1]}/export?format=csv`;
  return url;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchDocText(rawUrl: string): Promise<{ content: string; error?: string }> {
  const url = normaliseUrl(rawUrl);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(25_000),
      redirect: "follow",
    });
    if (!res.ok) return { content: "", error: `El documento respondió ${res.status}` };

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("pdf")) {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const buf = new Uint8Array(await res.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const out = await extractText(pdf, { mergePages: true });
      const text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
      return { content: text.slice(0, 9000) };
    }

    const body = await res.text();
    if (ct.includes("text/plain") || ct.includes("text/csv")) return { content: body.slice(0, 9000) };
    return { content: stripHtml(body).slice(0, 9000) };
  } catch (e) {
    return { content: "", error: (e as Error).message.slice(0, 200) };
  }
}
