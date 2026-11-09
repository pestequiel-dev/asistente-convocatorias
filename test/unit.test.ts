import { test } from "node:test";
import assert from "node:assert/strict";

import { computeScore } from "../lib/eligibility.ts";
import { validateCitations, detectPlatform } from "../lib/extract.ts";
import { parseDate } from "../lib/dates.ts";

// ---------- fechas ----------

test("parseDate: dd/mm/yyyy se interpreta como día de cierre a las 23:59 ART", () => {
  const r = parseDate("30/11/2026");
  assert.ok(r);
  // 23:59 en Buenos Aires (UTC-3) cae al día siguiente en UTC.
  assert.equal(r.iso, "2026-12-01T02:59:00.000Z");
  assert.equal(r.precision, "day");
});

test("parseDate: fecha textual en español", () => {
  const r = parseDate("cierra el 15 de marzo de 2027");
  assert.ok(r);
  assert.equal(r.iso, "2027-03-16T02:59:00.000Z");
});

test("parseDate: con hora explícita la precisión es de minuto", () => {
  const r = parseDate("30 de noviembre de 2026, 18:00");
  assert.ok(r);
  assert.equal(r.iso, "2026-11-30T21:00:00.000Z");
  assert.equal(r.precision, "minute");
});

test("parseDate: sin fecha devuelve null en vez de inventar", () => {
  assert.equal(parseDate("hasta agotar cupos"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
});

// ---------- score de elegibilidad ----------

const c = (verdict: "cumple" | "no_cumple" | "falta_dato" | "ambiguo" | "no_aplica") => ({ verdict });

test("computeScore: todo cumple → 100 y elegible", () => {
  assert.deepEqual(computeScore([c("cumple"), c("cumple")]), { score: 100, verdict: "eligible" });
});

test("computeScore: un no_cumple hace no elegible aunque el resto cumpla", () => {
  const r = computeScore([c("cumple"), c("cumple"), c("no_cumple")]);
  assert.equal(r.verdict, "not_eligible");
  assert.equal(r.score, 67);
});

test("computeScore: falta_dato y ambiguo cuentan 0,5 y piden info", () => {
  const r = computeScore([c("cumple"), c("falta_dato"), c("ambiguo")]);
  assert.equal(r.verdict, "needs_info");
  assert.equal(r.score, 67);
});

test("computeScore: no_aplica queda fuera del cálculo", () => {
  const r = computeScore([c("cumple"), c("no_aplica")]);
  assert.deepEqual(r, { score: 100, verdict: "eligible" });
});

test("computeScore: sin criterios aplicables no inventa score", () => {
  assert.deepEqual(computeScore([]), { score: null, verdict: "unknown" });
});

// ---------- citas ----------

function extraction(criteria: { quote: string | null }[], closingQuote: string | null = null) {
  return {
    criteria: criteria.map((x) => ({ ...x, source_url: "https://example.com" })),
    closing: { quote: closingQuote, date_iso: closingQuote ? "2026-12-01" : null },
    confidence: 0.9,
  } as never;
}

const page = (text: string) => ({ url: "https://example.com", title: "x", kind: "page" as const, depth: 0, text, hash: "h" });

test("validateCitations: conserva la cita que existe en la fuente", () => {
  const ex = validateCitations(
    extraction([{ quote: "Podrán postular startups con menos de 3 años." }]),
    [page("Bases: podrán postular startups con menos de 3 años. Cierre 30/11.")]
  );
  assert.equal(ex.criteria[0].quote, "Podrán postular startups con menos de 3 años.");
  assert.equal(ex.confidence, 0.9);
});

test("validateCitations: descarta la cita inventada", () => {
  const ex = validateCitations(
    extraction([{ quote: "Requisito que el modelo inventó entero." }]),
    [page("Bases: podrán postular startups con menos de 3 años.")]
  );
  assert.equal(ex.criteria[0].quote, null);
});

test("validateCitations: si más del 40% de las citas falla, baja la confianza", () => {
  const ex = validateCitations(
    extraction([
      { quote: "Texto que sí está en la fuente." },
      { quote: "Cita inventada uno." },
      { quote: "Cita inventada dos." },
    ]),
    [page("Texto que sí está en la fuente.")]
  );
  assert.ok(ex.confidence <= 0.4);
});

// ---------- plataforma del formulario ----------

test("detectPlatform: reconoce los formularios más comunes", () => {
  assert.equal(detectPlatform("https://form.typeform.com/to/abc"), "Typeform");
  assert.equal(detectPlatform("https://forms.gle/xyz"), "Google Forms");
  assert.equal(detectPlatform("https://airtable.com/app123/shr456"), "Airtable");
  assert.equal(detectPlatform("https://mi-sitio.com/postular"), null);
  assert.equal(detectPlatform(null), null);
});
