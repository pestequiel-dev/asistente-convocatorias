import { getDb, getSetting, nowIso } from "./db";
import { crawlSite, resolveStartUrl, type CrawledPage } from "./crawler";
import { classify, fetchPreview } from "./classify";
import { extract, type ExtractionDate } from "./extract";
import { extractCompetitor, extractEvent, extractInvestor, scoreEventRelevance, scoreInvestor } from "./extract-kind";
import { applyOverrides, computeScore, matchHeuristic, matchWithLlm } from "./eligibility";
import { diffSnapshots, formatDiff } from "./diff";
import { findLiveAlternative } from "./search";
import type { Criterion, Profile, Program } from "./types";

function log(id: number, msg: string) {
  console.log(`[programa ${id}] ${msg}`);
}

function loadDocs(): { label: string; url: string; content: string | null }[] {
  const db = getDb();
  const docs = db
    .prepare("SELECT label, url, content FROM profile_docs ORDER BY id")
    .all() as { label: string; url: string; content: string | null }[];

  // Milestones are the startup's evolution: they belong in the same context block,
  // so every future analysis is scored against the current state.
  const milestones = db
    .prepare("SELECT title, kind, description, metric, achieved_at FROM milestones ORDER BY achieved_at DESC, id DESC")
    .all() as { title: string; kind: string | null; description: string | null; metric: string | null; achieved_at: string }[];

  if (milestones.length) {
    const content = milestones
      .map(
        (m) =>
          `${m.achieved_at.slice(0, 10)} — ${m.title}${m.metric ? ` (${m.metric})` : ""}${m.kind ? ` [${m.kind}]` : ""}${
            m.description ? `. ${m.description}` : ""
          }`
      )
      .join("\n");
    docs.push({ label: "Hitos de la startup (historial, lo más reciente primero)", url: "", content });
  }

  return docs;
}

function maxPagesFor(kind: string): number {
  const configured = Number(getSetting("max_pages") || 24) || 24;
  if (kind === "referencia") return 4;
  if (kind === "evento" || kind === "competidor" || kind === "inversor") return Math.min(8, configured);
  return configured;
}

export async function analyzeProgram(
  id: number,
  opts: {
    maxPages?: number;
    forceKind?: string;
    preClassified?: { kind: string; confidence: number; reason: string; relevant?: boolean; relevance_reason?: string };
  } = {}
) {
  const db = getDb();

  // Claim the job atomically so the web process and worker never duplicate work.
  const claimed = db
    .prepare(
      "UPDATE programs SET status = 'crawling', error = NULL, started_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'"
    )
    .run(nowIso(), nowIso(), id);
  if (claimed.changes === 0) {
    log(id, "no se pudo reclamar (ya está en curso o terminó)");
    return;
  }

  const program = db.prepare("SELECT * FROM programs WHERE id = ?").get(id) as Program | undefined;
  if (!program) return;

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile;

  try {
    // Keep the previous snapshot so competitors can be diffed after re-crawling.
    const previousSnapshot = (
      db.prepare("SELECT text FROM sources WHERE program_id = ? AND status = 'ok' ORDER BY id").all(id) as { text: string }[]
    )
      .map((r) => r.text)
      .join("\n");

    db.prepare("DELETE FROM sources WHERE program_id = ?").run(id);
    db.prepare("DELETE FROM criteria WHERE program_id = ?").run(id);
    db.prepare("DELETE FROM key_dates WHERE program_id = ?").run(id);

    const { start, note } = resolveStartUrl(program.url, program.source_text ?? "");
    log(id, `rastreando ${start}${note ? ` (${note})` : ""}`);

    // 1. Triage BEFORE the expensive crawl. The ingest route already classified
    //    it, so don't pay twice.
    const preview = opts.preClassified ? { text: "", title: null, description: null } : await fetchPreview(start);
    const cls = opts.preClassified
      ? opts.preClassified
      : opts.forceKind
        ? {
            kind: opts.forceKind as never,
            confidence: 1,
            reason: "Tipo elegido manualmente por el usuario.",
            relevant: true,
            relevance_reason: "",
          }
        : await classify({ url: start, pasted: program.source_text ?? "", preview: preview.text });
    db.prepare(
      "UPDATE programs SET kind = ?, kind_reason = ?, kind_confidence = ?, updated_at = ? WHERE id = ?"
    ).run(cls.kind, cls.reason, cls.confidence, nowIso(), id);
    log(id, `clasificado como ${cls.kind} (${Math.round(cls.confidence * 100)}%) — ${cls.reason}`);

    // Out of scope: don't spend a single page of crawling on it.
    if (cls.relevant === false && !opts.forceKind) {
      db.prepare(
        "UPDATE programs SET status = 'rejected', kind_reason = ?, error = ?, updated_at = ? WHERE id = ?"
      ).run(cls.relevance_reason ?? cls.reason, "Descartado: no tiene que ver con el negocio", nowIso(), id);
      log(id, "descartado por irrelevante");
      return;
    }

    const isOpportunity = cls.kind === "convocatoria";

    const insertSource = db.prepare(
      `INSERT INTO sources (program_id, url, title, kind, depth, status, hash, text, fetched_at)
       VALUES (?, ?, ?, ?, ?, 'ok', ?, ?, ?)`
    );
    const insertError = db.prepare(
      `INSERT INTO sources (program_id, url, title, kind, depth, status, hash, text, fetched_at, error)
       VALUES (?, ?, NULL, 'page', ?, 'error', NULL, NULL, ?, ?)`
    );

    let seen = 0;
    let crawled = await crawlSite(start, {
      maxPages: opts.maxPages ?? maxPagesFor(cls.kind),
      maxDepth: isOpportunity ? 2 : 1,
      onLog: (m) => log(id, m),
      onPage: (page: CrawledPage) => {
        seen++;
        insertSource.run(id, page.url, page.title, page.kind, page.depth, page.hash, page.text, nowIso());
        db.prepare("UPDATE programs SET pages_crawled = ?, updated_at = ? WHERE id = ?").run(seen, nowIso(), id);
      },
    });

    for (const err of crawled.errors.slice(0, 10)) {
      insertError.run(id, err.url, 0, nowIso(), err.error);
    }

    // Dead root domain but live subdomains (socialab.com → comunidad.socialab.com):
    // look up the domain and retry from a page that actually exists.
    if (!crawled.pages.length) {
      const firstErr = crawled.errors[0]?.error ?? "";
      const code = firstErr.match(/net::(ERR_[A-Z_]+)/)?.[1] ?? (/(Timeout \d+ms exceeded)/i.test(firstErr) ? "TIMEOUT" : null);
      const navigationFailed =
        !!code && /NAME_NOT_RESOLVED|CONNECTION|TIMED_OUT|ADDRESS_UNREACHABLE|TIMEOUT|REFUSED/i.test(code);
      if (navigationFailed) {
        const alt = await findLiveAlternative(start);
        if (alt) {
          log(id, `dominio caído; se reintenta desde ${alt.url}`);
          const retry = await crawlSite(alt.url, {
            maxPages: opts.maxPages ?? maxPagesFor(cls.kind),
            maxDepth: isOpportunity ? 2 : 1,
            onLog: (m) => console.log(`[programa ${id}] ${m}`),
            onPage: (page: CrawledPage) => {
              seen++;
              insertSource.run(id, page.url, page.title, page.kind, page.depth, page.hash, page.text, nowIso());
              db.prepare("UPDATE programs SET pages_crawled = ?, updated_at = ? WHERE id = ?").run(seen, nowIso(), id);
            },
          });
          if (retry.pages.length) {
            crawled = {
              ...retry,
              errors: [
                { url: start, error: `El dominio original no respondía (${code}); se analizó ${alt.url}` },
                ...retry.errors,
              ],
            };
            db.prepare("UPDATE programs SET url = ?, error = ? WHERE id = ?").run(
              alt.url,
              `Se usó ${alt.url} porque el dominio original no respondía (${code}).`,
              id
            );
          }
        }
      }
    }

    db.prepare("UPDATE programs SET status = 'extracting', updated_at = ? WHERE id = ?").run(nowIso(), id);

    if (!crawled.pages.length) {
      const first = crawled.errors[0]?.error ?? "";
      const netCode = first.match(/net::(ERR_[A-Z_]+)/)?.[1];
      if (netCode && /NAME_NOT_RESOLVED|CONNECTION|CERT|TIMED_OUT|ADDRESS_UNREACHABLE|SSL/.test(netCode)) {
        throw new Error(
          `El sitio no responde (${netCode}). Puede que el dominio ya no exista o esté caído; revisá el link antes de reintentar.`
        );
      }
      if (/Timeout \d+ms exceeded/i.test(first)) {
        throw new Error(
          "El sitio no respondió a tiempo y no encontré una versión viva del dominio. Puede estar caído o bloqueando el acceso."
        );
      }
      throw new Error(
        "No se pudo leer ninguna página con contenido. Puede estar bloqueada, requerir login o ser solo una imagen. Pegá el texto de las bases en el campo de notas y reintentá."
      );
    }

    if (isOpportunity) {
      await saveOpportunity(id, profile, crawled.pages, crawled.formCandidates, crawled.contactCandidates, crawled.startUrl);
    } else if (cls.kind === "evento") {
      await saveEvent(id, profile, crawled.pages, crawled.startUrl, crawled.formCandidates, crawled.contactCandidates);
    } else if (cls.kind === "competidor") {
      await saveCompetitor(id, crawled.pages, crawled.startUrl, previousSnapshot);
    } else if (cls.kind === "inversor") {
      await saveInvestor(id, crawled.pages, crawled.startUrl, crawled.formCandidates, crawled.contactCandidates);
    } else {
      saveReference(id, crawled.pages, crawled.startUrl, preview, cls.reason);
    }

    db.prepare("UPDATE programs SET status = 'ready', analyzed_at = ?, updated_at = ? WHERE id = ?").run(
      nowIso(),
      nowIso(),
      id
    );
  } catch (e) {
    const msg = (e as Error).message || "Error desconocido";
    db.prepare("UPDATE programs SET status = 'error', error = ?, updated_at = ? WHERE id = ?").run(
      msg.slice(0, 800),
      nowIso(),
      id
    );
    log(id, `ERROR: ${msg}`);
  }
}

/* -------------------------- convocatoria / funding ------------------------- */

async function saveOpportunity(
  id: number,
  profile: Profile,
  pages: CrawledPage[],
  formCandidates: string[],
  contactCandidates: string[],
  startUrl: string
) {
  const db = getDb();
  const docs = loadDocs();
  const { extraction, tokens, mode, warning } = await extract(pages, profile, formCandidates, startUrl, docs);
  log(id, `extracción ${mode} (${tokens} tokens, ${pages.length} páginas)`);

  // Not every program has an application form. When there isn't one, a contact
  // or partnerships form is still the actionable link.
  const contactUrl =
    (extraction.contact && /^https?:\/\//i.test(extraction.contact) ? extraction.contact : null) ??
    contactCandidates.find((u) => u !== extraction.applies_url) ??
    null;

  const insertDate = db.prepare(
    `INSERT INTO key_dates (program_id, label, kind, value_raw, value_iso, tz, source_url, quote)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const dates: ExtractionDate[] = [...(extraction.dates ?? [])];
  if (extraction.closing && !dates.some((d) => d.date_iso === extraction.closing?.date_iso)) dates.unshift(extraction.closing);
  if (extraction.opening && !dates.some((d) => d.date_iso === extraction.opening?.date_iso)) dates.push(extraction.opening);
  for (const d of dates) insertDate.run(id, d.label, d.kind, d.raw, d.date_iso, d.timezone, d.url, d.quote);

  const insertCriterion = db.prepare(
    `INSERT INTO criteria (program_id, text, category, source_url, quote, verdict, reason, confidence)
     VALUES (?, ?, ?, ?, ?, 'falta_dato', NULL, ?)`
  );
  for (const c of extraction.criteria) {
    insertCriterion.run(id, c.text, c.category, c.url, c.quote, extraction.confidence);
  }

  const stored = db.prepare("SELECT * FROM criteria WHERE program_id = ?").all(id) as Criterion[];
  const llmResults = await matchWithLlm(
    stored.map((c) => ({ text: c.text, category: c.category ?? "otro", quote: c.quote, note: c.user_note })),
    profile,
    docs
  );
  const updateCriterion = db.prepare("UPDATE criteria SET verdict = ?, reason = ? WHERE id = ?");
  const finalVerdicts = stored.map((c, i) => {
    const r = applyOverrides(c, llmResults?.[i] ?? matchHeuristic(c, profile));
    updateCriterion.run(r.verdict, r.reason, c.id);
    return { verdict: r.verdict };
  });
  const { score, verdict } = computeScore(finalVerdicts);

  db.prepare(
    `UPDATE programs SET
      error = ?, kind = 'convocatoria', title = ?, organization = ?, type = ?, scope = ?,
      sector_focus = ?, stage_focus = ?, equity = ?, funding = ?, duration = ?, modality = ?,
      language = ?, applies_url = ?, contact_url = ?, form_platform = ?, docs_required = ?, contact = ?, summary = ?,
      closing_at = ?, closing_raw = ?, closing_tz = ?, opened_at = ?, confidence = ?, mode = ?,
      eligibility_score = ?, verdict = ?, tokens = ?, relevance_score = NULL, fit_score = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    warning ?? null,
    extraction.title,
    extraction.organization,
    extraction.type,
    extraction.scope,
    extraction.sector_focus,
    extraction.stage_focus,
    extraction.equity,
    extraction.funding,
    extraction.duration,
    extraction.modality,
    extraction.language,
    extraction.applies_url,
    contactUrl && contactUrl !== extraction.applies_url ? contactUrl : null,
    extraction.form_platform,
    JSON.stringify(extraction.docs_required),
    extraction.contact,
    extraction.summary,
    extraction.closing?.date_iso ?? null,
    extraction.closing?.raw ?? null,
    extraction.closing?.timezone ?? null,
    extraction.opening?.date_iso ?? null,
    extraction.confidence,
    mode,
    score,
    verdict,
    tokens,
    score,
    nowIso(),
    id
  );

  db.prepare(
    "UPDATE programs SET pipeline_status = ? WHERE id = ? AND pipeline_status = 'reviewing'"
  ).run(verdict === "not_eligible" ? "not_eligible" : "reviewing", id);

  log(id, `listo: ${score ?? "s/c"}% · ${verdict}`);
}

/* ---------------------------------- evento -------------------------------- */

const JUNK_URL = /(recaptcha|hcaptcha|turnstile|gstatic|googleapis|doubleclick|googletagmanager|google-analytics|facebook\.com\/tr|hotjar|youtube\.com\/embed)/i;

function pickAction(formCandidates: string[], contactCandidates: string[], startUrl: string) {
  const usable = formCandidates.filter((u) => !JUNK_URL.test(u));
  const apply =
    usable.find((u) => /airtable|typeform|forms\.|jotform|tally|google\.com\/forms/i.test(u)) ??
    usable[0] ??
    null;
  const contact = contactCandidates.find((u) => u !== apply && u !== startUrl && !JUNK_URL.test(u)) ?? null;
  return { apply, contact };
}

async function saveEvent(
  id: number,
  profile: Profile,
  pages: CrawledPage[],
  startUrl: string,
  formCandidates: string[] = [],
  contactCandidates: string[] = []
) {
  const db = getDb();
  const event = await extractEvent(pages, startUrl);
  const { score: relevance, access_note } = scoreEventRelevance(event, profile);
  event.access_note = access_note;

  const insertDate = db.prepare(
    `INSERT INTO key_dates (program_id, label, kind, value_raw, value_iso, tz, source_url, quote)
     VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)`
  );
  if (event.event_date) insertDate.run(id, "Fecha del evento", "event", event.event_date, event.event_date, event.url);
  if (event.registration_deadline)
    insertDate.run(id, "Cierre de inscripción", "closing", event.registration_deadline, event.registration_deadline, event.url);

  const action = pickAction(formCandidates, contactCandidates, startUrl);

  db.prepare(
    `UPDATE programs SET
      title = ?, organization = ?, type = 'evento', scope = ?, modality = ?, funding = ?,
      summary = ?, applies_url = ?, contact_url = ?, meta = ?, relevance_score = ?, fit_score = ?, confidence = ?,
      closing_at = ?, closing_raw = ?, eligibility_score = NULL, verdict = NULL, diff_summary = NULL, updated_at = ?
     WHERE id = ?`
  ).run(
    event.title,
    event.organizer,
    event.city,
    event.format,
    event.cost,
    event.summary,
    action.apply ?? event.url,
    action.contact,
    JSON.stringify(event),
    relevance,
    relevance,
    event.confidence,
    event.registration_deadline ?? event.event_date,
    event.registration_deadline ? "Cierre de inscripción" : "Fecha del evento",
    nowIso(),
    id
  );
  log(id, `evento: relevancia ${relevance} · ${event.city ?? "sin ciudad"}`);
}

/* --------------------------------- inversor ------------------------------- */

async function saveInvestor(
  id: number,
  pages: CrawledPage[],
  startUrl: string,
  formCandidates: string[] = [],
  contactCandidates: string[] = []
) {
  const db = getDb();
  const inv = await extractInvestor(pages, startUrl);
  const fit = scoreInvestor(inv);
  const action = pickAction(formCandidates, contactCandidates, startUrl);

  db.prepare(
    `UPDATE programs SET
      title = ?, organization = ?, type = 'inversor', scope = ?, sector_focus = ?,
      summary = ?, applies_url = ?, contact_url = ?, meta = ?, confidence = ?, fit_score = ?,
      eligibility_score = NULL, verdict = NULL, closing_at = NULL, updated_at = ?
     WHERE id = ?`
  ).run(
    inv.fund,
    inv.fund,
    inv.geographies.join(", ") || inv.country,
    inv.sector_focus.join(", "),
    inv.thesis,
    action.apply ?? inv.url,
    action.contact,
    JSON.stringify(inv),
    inv.confidence,
    fit,
    nowIso(),
    id
  );
  log(id, `inversor: fit ${fit}${inv.invests_latam ? " · invierte en LatAm" : ""}`);
}

/* -------------------------------- competidor ------------------------------ */

async function saveCompetitor(id: number, pages: CrawledPage[], startUrl: string, previousSnapshot: string) {
  const db = getDb();
  const competitor = await extractCompetitor(pages, startUrl);

  const nextSnapshot = pages.map((p) => p.text).join("\n");
  const diff = diffSnapshots(previousSnapshot, nextSnapshot);
  const diffText = formatDiff(diff);

  db.prepare(
    `UPDATE programs SET
      title = ?, organization = ?, type = 'competidor', scope = ?, sector_focus = ?,
      summary = ?, applies_url = ?, meta = ?, confidence = ?, eligibility_score = NULL, verdict = NULL,
      diff_summary = ?, diff_at = ?, closing_at = NULL, updated_at = ?
     WHERE id = ?`
  ).run(
    competitor.product && competitor.product !== competitor.company
      ? `${competitor.company ?? "Competidor"} — ${competitor.product}`
      : competitor.company,
    competitor.company,
    competitor.country,
    competitor.segment,
    competitor.summary,
    competitor.url,
    JSON.stringify(competitor),
    competitor.confidence,
    diffText || null,
    diffText ? nowIso() : null,
    nowIso(),
    id
  );
  log(id, `competidor guardado${diffText ? " · cambios detectados" : ""}`);
}

/* -------------------------------- referencia ------------------------------ */

function saveReference(
  id: number,
  pages: CrawledPage[],
  startUrl: string,
  preview: { title: string | null; description: string | null },
  reason: string
) {
  const db = getDb();
  // Never dump the raw page text here: on a corporate homepage that is just the
  // navigation menu. The meta description or the classifier verdict is the summary.
  const title = preview.title || pages[0]?.title || startUrl;
  const summary = preview.description || reason;
  db.prepare(
    `UPDATE programs SET title = ?, summary = ?, applies_url = ?, eligibility_score = NULL, verdict = NULL,
      closing_at = NULL, meta = NULL, fit_score = NULL, updated_at = ? WHERE id = ?`
  ).run(title, summary, startUrl, nowIso(), id);
  log(id, "referencia guardada (sin análisis profundo)");
}

/* ------------------------------ shared ------------------------------------ */

export async function reevaluateProgram(id: number) {
  const db = getDb();
  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile;
  const stored = db.prepare("SELECT * FROM criteria WHERE program_id = ?").all(id) as Criterion[];
  if (!stored.length) return { ok: false, error: "No hay criterios para re-evaluar" };

  const docs = loadDocs();
  const llmResults = await matchWithLlm(
    stored.map((c) => ({ text: c.text, category: c.category ?? "otro", quote: c.quote, note: c.user_note })),
    profile,
    docs
  );
  const update = db.prepare("UPDATE criteria SET verdict = ?, reason = ? WHERE id = ?");
  const verdicts = stored.map((c, i) => {
    const r = applyOverrides(c, llmResults?.[i] ?? matchHeuristic(c, profile));
    update.run(r.verdict, r.reason, c.id);
    return { verdict: r.verdict };
  });
  const { score, verdict } = computeScore(verdicts);
  db.prepare("UPDATE programs SET eligibility_score = ?, verdict = ?, updated_at = ? WHERE id = ?").run(
    score,
    verdict,
    nowIso(),
    id
  );
  return { ok: true, score, verdict };
}

/**
 * Re-evaluate ONE criterion with a note the user typed, then recompute the
 * program score. Used by the inline "aportar dato" form.
 */
export async function reevaluateCriterion(criterionId: number, note: string) {
  const db = getDb();
  const c = db.prepare("SELECT * FROM criteria WHERE id = ?").get(criterionId) as Criterion | undefined;
  if (!c) return { ok: false as const, error: "Criterio no encontrado" };

  const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get() as Profile;
  const clean = note.trim().slice(0, 1200) || null;
  db.prepare("UPDATE criteria SET user_note = ? WHERE id = ?").run(clean, criterionId);

  const withNote: Criterion = { ...c, user_note: clean };
  const llmResults = await matchWithLlm(
    [{ text: c.text, category: c.category ?? "otro", quote: c.quote, note: clean }],
    profile,
    loadDocs()
  );
  const r = applyOverrides(withNote, llmResults?.[0] ?? matchHeuristic(withNote, profile));
  db.prepare("UPDATE criteria SET verdict = ?, reason = ? WHERE id = ?").run(r.verdict, r.reason, criterionId);

  const all = db.prepare("SELECT * FROM criteria WHERE program_id = ?").all(c.program_id) as Criterion[];
  const { score, verdict } = computeScore(all);
  db.prepare("UPDATE programs SET eligibility_score = ?, verdict = ?, updated_at = ? WHERE id = ?").run(
    score,
    verdict,
    nowIso(),
    c.program_id
  );

  return {
    ok: true as const,
    criterion: { ...withNote, verdict: r.verdict, reason: r.reason },
    score,
    verdict,
    programId: c.program_id,
  };
}

export async function processQueueOnce(): Promise<boolean> {
  const db = getDb();
  const next = db.prepare("SELECT id FROM programs WHERE status = 'queued' ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (!next) return false;
  await analyzeProgram(next.id);
  return true;
}
