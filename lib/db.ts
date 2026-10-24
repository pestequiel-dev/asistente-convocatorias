import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "app.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 8000;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  founder_name TEXT NOT NULL DEFAULT '',
  founder_last TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  deck_url TEXT NOT NULL DEFAULT '',
  round_details TEXT NOT NULL DEFAULT '',
  market_size TEXT NOT NULL DEFAULT '',
  market_plan TEXT NOT NULL DEFAULT '',
  traction_metrics TEXT NOT NULL DEFAULT '',
  legal_status TEXT NOT NULL DEFAULT '',
  legal_structure_detail TEXT NOT NULL DEFAULT '',
  can_invoice TEXT NOT NULL DEFAULT '',
  founded TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  team_size INTEGER,
  founders INTEGER,
  revenue_usd REAL,
  customers INTEGER,
  languages TEXT NOT NULL DEFAULT '',
  tech_stack TEXT NOT NULL DEFAULT '',
  has_product TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  source_text TEXT,
  origin TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  title TEXT,
  organization TEXT,
  type TEXT,
  scope TEXT,
  sector_focus TEXT,
  stage_focus TEXT,
  equity TEXT,
  funding TEXT,
  duration TEXT,
  modality TEXT,
  language TEXT,
  applies_url TEXT,
  contact_url TEXT,
  form_platform TEXT,
  docs_required TEXT,
  contact TEXT,
  summary TEXT,
  closing_at TEXT,
  closing_raw TEXT,
  closing_tz TEXT,
  opened_at TEXT,
  confidence REAL,
  mode TEXT,
  eligibility_score INTEGER,
  verdict TEXT,
  pages_crawled INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  pipeline_status TEXT NOT NULL DEFAULT 'reviewing',
  kind TEXT NOT NULL DEFAULT 'convocatoria',
  kind_reason TEXT,
  kind_confidence REAL,
  kind_confirmed INTEGER NOT NULL DEFAULT 0,
  relevance_score INTEGER,
  fit_score INTEGER,
  meta TEXT,
  diff_summary TEXT,
  diff_at TEXT,
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  analyzed_at TEXT,
  started_at TEXT,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_pipeline ON programs(pipeline_status);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  kind TEXT NOT NULL DEFAULT 'page',
  depth INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  hash TEXT,
  text TEXT,
  fetched_at TEXT NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sources_program ON sources(program_id);

CREATE TABLE IF NOT EXISTS criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT,
  source_url TEXT,
  quote TEXT,
  verdict TEXT NOT NULL DEFAULT 'falta_dato',
  reason TEXT,
  confidence REAL,
  user_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_criteria_program ON criteria(program_id);

CREATE TABLE IF NOT EXISTS application_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  kind TEXT,
  description TEXT,
  metric TEXT,
  achieved_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT,
  content TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  organization TEXT,
  country TEXT,
  platform TEXT,
  handle TEXT,
  audience TEXT,
  audience_size INTEGER,
  topics TEXT,
  status TEXT NOT NULL DEFAULT 'nuevo',
  rate_usd REAL,
  rate_notes TEXT,
  notes TEXT,
  score INTEGER,
  score_reason TEXT,
  last_contact_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messenger_touchpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messenger_id INTEGER NOT NULL REFERENCES messengers(id) ON DELETE CASCADE,
  channel TEXT,
  kind TEXT,
  summary TEXT,
  cost_usd REAL,
  happened_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_touch_messenger ON messenger_touchpoints(messenger_id);

CREATE TABLE IF NOT EXISTS key_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  value_raw TEXT,
  value_iso TEXT,
  tz TEXT,
  source_url TEXT,
  quote TEXT
);

CREATE INDEX IF NOT EXISTS idx_dates_program ON key_dates(program_id);
`;

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (globalThis.__db) return globalThis.__db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 8000");
  db.exec(SCHEMA);
  migrate(db);
  seedProfile(db);
  applyLegalDefaults(db);
  cleanReferenceSummaries(db);
  syncFitScores(db);
  globalThis.__db = db;
  return db;
}

/** Adds columns introduced after the first version, without losing data. */
function migrate(db: Database.Database) {
  const cols = (db.prepare("PRAGMA table_info(profile)").all() as { name: string }[]).map((c) => c.name);
  const additions: [string, string][] = [
    ["legal_structure_detail", "TEXT NOT NULL DEFAULT ''"],
    ["can_invoice", "TEXT NOT NULL DEFAULT ''"],
    ["city", "TEXT NOT NULL DEFAULT ''"],
    ["founder_name", "TEXT NOT NULL DEFAULT ''"],
    ["founder_last", "TEXT NOT NULL DEFAULT ''"],
    ["email", "TEXT NOT NULL DEFAULT ''"],
    ["linkedin", "TEXT NOT NULL DEFAULT ''"],
    ["phone", "TEXT NOT NULL DEFAULT ''"],
    ["role", "TEXT NOT NULL DEFAULT ''"],
    ["deck_url", "TEXT NOT NULL DEFAULT ''"],
    ["round_details", "TEXT NOT NULL DEFAULT ''"],
    ["market_size", "TEXT NOT NULL DEFAULT ''"],
    ["market_plan", "TEXT NOT NULL DEFAULT ''"],
    ["traction_metrics", "TEXT NOT NULL DEFAULT ''"],
  ];
  const programCols = (db.prepare("PRAGMA table_info(programs)").all() as { name: string }[]).map((c) => c.name);
  const programAdditions: [string, string][] = [
    ["kind", "TEXT NOT NULL DEFAULT 'convocatoria'"],
    ["kind_reason", "TEXT"],
    ["kind_confidence", "REAL"],
    ["kind_confirmed", "INTEGER NOT NULL DEFAULT 0"],
    ["relevance_score", "INTEGER"],
    ["fit_score", "INTEGER"],
    ["started_at", "TEXT"],
    ["applied_at", "TEXT"],
    ["contact_url", "TEXT"],
    ["meta", "TEXT"],
    ["diff_summary", "TEXT"],
    ["diff_at", "TEXT"],
  ];
  for (const [name, def] of programAdditions) {
    if (!programCols.includes(name)) db.exec(`ALTER TABLE programs ADD COLUMN ${name} ${def}`);
  }

  const criteriaCols = (db.prepare("PRAGMA table_info(criteria)").all() as { name: string }[]).map((c) => c.name);
  if (!criteriaCols.includes("user_note")) db.exec("ALTER TABLE criteria ADD COLUMN user_note TEXT");

  const draftCols = (db.prepare("PRAGMA table_info(application_drafts)").all() as { name: string }[]).map((c) => c.name);
  if (!draftCols.includes("source")) db.exec("ALTER TABLE application_drafts ADD COLUMN source TEXT");
  for (const [name, def] of additions) {
    if (!cols.includes(name)) db.exec(`ALTER TABLE profile ADD COLUMN ${name} ${def}`);
  }
}

/** Mehmiro operates under a cooperative's legal/tax umbrella; prefill it once. */
/** fit_score mirrors the kind-specific score; keep it from going stale. */
function syncFitScores(db: Database.Database) {
  db.prepare(
    "UPDATE programs SET fit_score = eligibility_score WHERE kind = 'convocatoria' AND eligibility_score IS NOT NULL AND (fit_score IS NULL OR fit_score != eligibility_score)"
  ).run();
  db.prepare(
    "UPDATE programs SET fit_score = relevance_score WHERE kind = 'evento' AND relevance_score IS NOT NULL AND (fit_score IS NULL OR fit_score != relevance_score)"
  ).run();
}

/** References used to store the raw page text (nav menus). Clean those up once. */
function cleanReferenceSummaries(db: Database.Database) {
  db.prepare(
    "UPDATE programs SET summary = kind_reason WHERE kind = 'referencia' AND length(coalesce(summary, '')) > 240"
  ).run();
}

function applyLegalDefaults(db: Database.Database) {
  db.prepare(
    `UPDATE profile SET
       legal_status = 'Opera bajo la estructura legal de un tercero',
       legal_structure_detail = ?,
       can_invoice = ?
     WHERE id = 1 AND (legal_status IS NULL OR legal_status = '')`
  ).run(
    "Una cooperativa (Lara Ltda.) nos aporta la estructura legal e impositiva. Mehmiro es el emprendimiento/proyecto, sin personería jurídica propia.",
    "Sí, a través de un tercero"
  );
}

function seedProfile(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) as n FROM profile").get() as { n: number };
  if (row.n > 0) return;
  db.prepare(
    `INSERT INTO profile (id, name, url, country, sector, description, stage, has_product, languages, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "Mehmiro",
    "https://mehmiro.com",
    "Argentina",
    "EdTech · IA pedagógica",
    "Asistente de IA pedagógico que transforma las evaluaciones formativas: analiza las observaciones del docente según el contexto único de cada estudiante.",
    "Pre-seed",
    "Sí, producto en producción",
    "Español",
    new Date().toISOString()
  );
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function allSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function nowIso() {
  return new Date().toISOString();
}

export { DB_FILE, DATA_DIR };
