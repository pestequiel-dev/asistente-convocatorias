import crypto from "node:crypto";

export interface CrawledPage {
  url: string;
  title: string;
  kind: "page" | "pdf";
  depth: number;
  text: string;
  hash: string;
  /** Anchors found on the page: needed to turn names into real links. */
  links?: { anchor: string; url: string }[];
}

export interface CrawlResult {
  pages: CrawledPage[];
  startUrl: string;
  formCandidates: string[];
  contactCandidates: string[];
  errors: { url: string; error: string }[];
  truncated: boolean;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  onPage?: (page: CrawledPage) => void;
  onLog?: (msg: string) => void;
}

const FORM_HOSTS = [
  "typeform.com",
  "forms.gle",
  "forms.office.com",
  "docs.google.com",
  "airtable.com",
  "jotform.com",
  "f6s.com",
  "younoodle.com",
  "lu.ma",
  "luma.com",
  "notion.site",
  "form.jotform.com",
  "tally.so",
  "surveymonkey.com",
  "google.com",
];

const SOCIAL_HOSTS = [
  "linkedin.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "wa.me",
  "whatsapp.com",
];

const HIGH_VALUE = [
  /bases?\s*(y|e)\s*condiciones/i,
  /bases?\b/i,
  /reglamento/i,
  /t[eé]rminos\s*(y|e)\s*condiciones/i,
  /t[eé]rminos/i,
  /convocatoria/i,
  /guidelines/i,
  /rules/i,
  /terms/i,
  /legal/i,
];

const APPLY_VALUE = [
  /postul/i,
  /aplic/i,
  /apply/i,
  /inscri/i,
  /registro/i,
  /formulario/i,
  /application/i,
  /solicitud/i,
];

const ELIG_VALUE = [
  /elegibilidad/i,
  /eligibility/i,
  /requisitos/i,
  /criterios/i,
  /qui[eé]nes\s+pueden/i,
  /who\s+can\s+apply/i,
  /faq/i,
  /preguntas\s+frecuentes/i,
];

const BOILERPLATE = /\/(nosotros|about|equipo|team|blog|prensa|press|contacto|contact|trabaja|careers|empleos|legal|privacidad|privacy|aviso-legal|terminos-de-uso|newsletter)(\/|$)/i;

const SKIP = [
  /mailto:/i,
  /tel:/i,
  /javascript:/i,
  /^#/,
  /\.(jpg|jpeg|png|gif|svg|webp|ico|mp4|mp3|zip|rar|dmg|exe)(\?|$)/i,
  /(login|signin|sign-in|signup|register\/?$|auth|password|account\/)/i,
  /(privacy|privacidad|cookies|terminos-de-uso\/?$|unsubscribe)/i,
  /(facebook|twitter|x)\.com\/(sharer|intent)/i,
  /share\/(article|post)/i,
];

function host(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function registrable(h: string) {
  const parts = h.split(".");
  return parts.slice(-2).join(".");
}

function isFormHost(u: string) {
  const h = host(u);
  return FORM_HOSTS.some((f) => h === f || h.endsWith("." + f));
}

function isSocial(u: string) {
  const h = host(u);
  return SOCIAL_HOSTS.some((f) => h === f || h.endsWith("." + f));
}

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ref", "ref_src"]) {
      u.searchParams.delete(p);
    }
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

function pathPrefix(u: string) {
  try {
    const segs = new URL(u).pathname.split("/").filter(Boolean);
    return segs.length ? "/" + segs[0] : "/";
  } catch {
    return "/";
  }
}

function linkScore(anchor: string, url: string, sameDomain: boolean, depth: number, startPrefix: string) {
  const blob = `${anchor} ${url}`;
  let score = 0;
  for (const re of HIGH_VALUE) if (re.test(blob)) { score += 12; break; }
  for (const re of APPLY_VALUE) if (re.test(blob)) { score += 10; break; }
  for (const re of ELIG_VALUE) if (re.test(blob)) { score += 8; break; }
  if (/\.pdf(\?|$)/i.test(url)) score += 6;
  if (sameDomain) score += 4;
  if (isFormHost(url)) score += 9;
  if (BOILERPLATE.test(url)) score -= 14;
  if (startPrefix !== "/" && pathPrefix(url) === startPrefix) score += 7;
  score -= depth * 2;
  return score;
}

function cleanText(t: string) {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hash(text: string) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

async function extractPdf(buffer: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const res = await extractText(pdf, { mergePages: true });
  return Array.isArray(res.text) ? res.text.join("\n\n") : res.text;
}

export async function crawlSite(startUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 24;
  const maxDepth = opts.maxDepth ?? 2;
  const log = opts.onLog ?? (() => {});

  const { chromium } = await import("playwright");

  const launchOptions: Record<string, unknown> = {
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  };

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch {
    const fallbacks = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    const fs = await import("node:fs");
    const exe = fallbacks.find((p) => fs.existsSync(p));
    if (!exe) throw new Error("No se encontró Chromium. Corré: npx playwright install chromium");
    browser = await chromium.launch({ ...launchOptions, executablePath: exe });
  }

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "es-AR",
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
  });

  const start = normalizeUrl(startUrl);
  if (!start) throw new Error("URL inválida");

  let baseDomain = registrable(host(start));
  let startPrefix = pathPrefix(start);
  const seen = new Set<string>([start]);
  const pages: CrawledPage[] = [];
  const errors: { url: string; error: string }[] = [];
  const formCandidates = new Set<string>();
  const contactCandidates = new Set<string>();
  const queue: { url: string; depth: number; score: number }[] = [{ url: start, depth: 0, score: 100 }];

  let truncated = false;

  try {
    while (queue.length) {
      if (pages.length >= maxPages) {
        truncated = true;
        break;
      }
      queue.sort((a, b) => b.score - a.score);
      const item = queue.shift()!;
      if (item.depth > maxDepth) continue;

      log(`Fetch ${item.url}`);
      const isPdf = /\.pdf(\?|$)/i.test(item.url);

      try {
        if (isPdf) {
          const res = await context.request.get(item.url, { timeout: 30000 });
          if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
          const buf = new Uint8Array(await res.body());
          const text = cleanText(await extractPdf(buf));
          if (!text || text.length < 80) throw new Error("PDF sin texto extraíble (¿escaneado?)");
          const page: CrawledPage = { url: item.url, title: item.url.split("/").pop() || item.url, kind: "pdf", depth: item.depth, text: text.slice(0, 60000), hash: hash(text) };
          pages.push(page);
          opts.onPage?.(page);
          continue;
        }

        const page = await context.newPage();
        let html = "";
        try {
          await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(1800);

          // If the site redirects to another domain (500mexicocity.com → 500.co),
          // adopt the final domain as the crawl scope or every real link is dropped.
          const landed = normalizeUrl(page.url());
          if (landed && registrable(host(landed)) !== baseDomain) {
            log(`redirigido a ${landed}: se adopta ese dominio`);
            baseDomain = registrable(host(landed));
            startPrefix = pathPrefix(landed);
          }
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 3);
          }).catch(() => {});
          await page.waitForTimeout(600);

          const title = cleanText(await page.title().catch(() => ""));

          let text = cleanText(
            (await page.evaluate(() => document.body?.innerText || "").catch(() => "")) as string
          );

          // SPA shells render after the first paint: if we only got the footer,
          // give the app a second chance before declaring the page empty.
          if (text.length < 220) {
            await page.waitForTimeout(2600);
            text = cleanText(
              (await page.evaluate(() => document.body?.innerText || "").catch(() => "")) as string
            );
          }

          const links = (await page
            .evaluate(() =>
              Array.from(document.querySelectorAll("a[href], iframe[src]")).map((el) => {
                const a = el as HTMLAnchorElement;
                const href = a.getAttribute("href") || (el as HTMLIFrameElement).getAttribute("src") || "";
                return { href, anchor: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 120) };
              })
            )
            .catch(() => [])) as { href: string; anchor: string }[];

          if (!text || text.length < 60) {
            html = await page.content().catch(() => "");
          }

          if (text && text.length >= 60) {
            const normalized = text.slice(0, 60000);
            const pageLinks = links
              .map((l) => ({ anchor: (l.anchor || "").trim(), url: l.href || "" }))
              .filter((l) => /^https?:/i.test(l.url) && l.anchor.length > 1)
              .slice(0, 120);
            const cp: CrawledPage = {
              url: item.url,
              title: title || item.url,
              kind: "page",
              depth: item.depth,
              text: normalized,
              hash: hash(normalized),
              links: pageLinks,
            };
            if (!pages.some((p) => p.hash === cp.hash)) {
              pages.push(cp);
              opts.onPage?.(cp);
            }
          } else {
            errors.push({ url: item.url, error: "Página sin texto visible (posible bloqueo o JS pesado)" });
          }

          for (const l of links) {
            const abs = normalizeUrl(l.href, page.url() || item.url);
            if (!abs) continue;
            if (SKIP.some((re) => re.test(abs))) continue;

            if (isFormHost(abs)) {
              formCandidates.add(abs);
              continue;
            }

            const blob = `${l.anchor} ${abs}`.toLowerCase();
            if (/contact|contacto|connect|partnership|colabor|sumate|involucr|hablar con|consulta/.test(blob)) {
              contactCandidates.add(abs);
            }
            if (/(^|\.)aplica\.|\/aplica|apply|postul|inscri|registro/.test(abs)) {
              formCandidates.add(abs);
              continue;
            }
            if (isSocial(abs)) continue;
            if (BOILERPLATE.test(abs) && pathPrefix(abs) !== startPrefix) continue;
            const same = registrable(host(abs)) === baseDomain;
            if (!same) continue;
            if (seen.has(abs)) continue;
            if (!/^https?:/i.test(abs)) continue;
            seen.add(abs);
            queue.push({ url: abs, depth: item.depth + 1, score: linkScore(l.anchor, abs, same, item.depth + 1, startPrefix) });
          }
        } finally {
          await page.close().catch(() => {});
        }
      } catch (e) {
        errors.push({ url: item.url, error: (e as Error).message.slice(0, 300) });
        log(`Error ${item.url}: ${(e as Error).message}`);
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return {
    pages,
    startUrl: start,
    formCandidates: [...formCandidates],
    contactCandidates: [...contactCandidates],
    errors,
    truncated,
  };
}

export function prioritizePages(pages: CrawledPage[], startUrl: string) {
  const prefix = pathPrefix(startUrl);
  const weight = (p: CrawledPage) => {
    let w = 0;
    if (p.url === startUrl) w += 10;
    if (prefix !== "/" && pathPrefix(p.url) === prefix) w += 5;
    if (/bases|condiciones|reglamento|terminos|términos|guidelines|rules/i.test(p.url)) w += 6;
    if (/postul|aplic|apply|formulario|inscri|requisitos|eligibility|faq/i.test(p.url)) w += 4;
    if (p.kind === "pdf") w += 3;
    return w;
  };
  return [...pages].sort((a, b) => weight(b) - weight(a));
}

export function resolveStartUrl(url: string, pastedText: string): { start: string; note?: string } {
  const raw = url.trim();
  if (!raw) throw new Error("Falta el link");
  const normalized = normalizeUrl(raw);
  if (!normalized) throw new Error("El link no es una URL válida");

  if (isSocial(normalized)) {
    const found = (pastedText.match(/https?:\/\/[^\s"'<>)\]]+/g) || [])
      .map((u) => normalizeUrl(u))
      .filter((u): u is string => !!u && !isSocial(u));
    const preferred = found.find((u) => !/\.(jpg|png|gif|mp4)/i.test(u));
    if (preferred) {
      return {
        start: preferred,
        note: `El link era de una red social (bloquea el rastreo): se usó el link que aparecía en el texto → ${preferred}`,
      };
    }
    throw new Error(
      "El link es de LinkedIn/Instagram, que no permiten rastreo automático. Pegá también el texto del posteo e incluí el link real de la convocatoria (o el link directo a las bases)."
    );
  }
  return { start: normalized };
}
