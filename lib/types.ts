export type ProgramStatus =
  | "queued"
  | "crawling"
  | "extracting"
  | "ready"
  | "error";

export type Kind = "convocatoria" | "evento" | "competidor" | "inversor" | "referencia";

export type PipelineStatus =
  | "idea"
  | "reviewing"
  | "eligible"
  | "not_eligible"
  | "applying"
  | "applied"
  | "won"
  | "lost";

export type CriterionVerdict =
  | "cumple"
  | "no_cumple"
  | "falta_dato"
  | "ambiguo"
  | "no_aplica";

export interface Citation {
  url: string;
  quote: string;
}

export interface SourcePage {
  id: number;
  program_id: number;
  url: string;
  title: string | null;
  kind: "page" | "pdf";
  depth: number;
  status: "ok" | "error";
  hash: string | null;
  text: string | null;
  fetched_at: string;
  error: string | null;
}

export interface Criterion {
  id: number;
  program_id: number;
  text: string;
  category: string;
  source_url: string | null;
  quote: string | null;
  verdict: CriterionVerdict;
  reason: string | null;
  confidence: number | null;
  user_note: string | null;
}

export interface KeyDate {
  id: number;
  program_id: number;
  label: string;
  kind: "closing" | "opening" | "event" | "other";
  value_raw: string | null;
  value_iso: string | null;
  tz: string | null;
  source_url: string | null;
  quote: string | null;
}

export interface Program {
  id: number;
  url: string;
  source_text: string | null;
  origin: string | null;
  status: ProgramStatus;
  error: string | null;
  title: string | null;
  organization: string | null;
  type: string | null;
  scope: string | null;
  sector_focus: string | null;
  stage_focus: string | null;
  equity: string | null;
  funding: string | null;
  duration: string | null;
  modality: string | null;
  language: string | null;
  applies_url: string | null;
  contact_url: string | null;
  form_platform: string | null;
  docs_required: string | null;
  contact: string | null;
  summary: string | null;
  closing_at: string | null;
  closing_raw: string | null;
  closing_tz: string | null;
  opened_at: string | null;
  confidence: number | null;
  mode: "llm" | "heuristic" | null;
  eligibility_score: number | null;
  verdict: string | null;
  pages_crawled: number | null;
  tokens: number | null;
  pipeline_status: PipelineStatus;
  kind: Kind;
  kind_reason: string | null;
  kind_confidence: number | null;
  kind_confirmed: number;
  relevance_score: number | null;
  fit_score: number | null;
  meta: string | null;
  diff_summary: string | null;
  diff_at: string | null;
  applied_at: string | null;
  notes: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
}

export type MessengerStatus =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "negociando"
  | "acuerdo"
  | "publico"
  | "descartado";

export interface Messenger {
  id: number;
  name: string;
  role: string | null;
  organization: string | null;
  country: string | null;
  platform: string | null;
  handle: string | null;
  audience: string | null;
  audience_size: number | null;
  topics: string | null;
  status: MessengerStatus;
  rate_usd: number | null;
  rate_notes: string | null;
  notes: string | null;
  score: number | null;
  score_reason: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  title: string;
  kind: string | null;
  description: string | null;
  metric: string | null;
  achieved_at: string;
  created_at: string;
}

export interface Touchpoint {
  id: number;
  messenger_id: number;
  channel: string | null;
  kind: string | null;
  summary: string | null;
  cost_usd: number | null;
  happened_at: string;
  created_at: string;
}

export interface Profile {
  id: number;
  name: string;
  url: string;
  country: string;
  city: string;
  founder_name: string;
  founder_last: string;
  email: string;
  linkedin: string;
  phone: string;
  role: string;
  legal_status: string;
  legal_structure_detail: string;
  can_invoice: string;
  founded: string;
  stage: string;
  sector: string;
  description: string;
  team_size: number | null;
  founders: number | null;
  revenue_usd: number | null;
  customers: number | null;
  languages: string;
  tech_stack: string;
  has_product: string;
  notes: string;
  updated_at: string;
}
