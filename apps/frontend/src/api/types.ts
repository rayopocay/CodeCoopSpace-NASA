/**
 * Types of the shared contract (docs/CONTRATO.md).
 * Fields are camelCase, exactly like the API JSON.
 *
 * Every value shown to the farmer comes from the server: there is no bundled
 * data in the app. Free text (reasons, notes, warnings, explanation) arrives
 * already written in the language sent with `Accept-Language` (en | es).
 */

export type CropId = 'maize' | 'bean' | 'sorghum';
export type Priority = 'water' | 'soil' | 'diversification';
export type SoilTexture = 'sandy' | 'loam' | 'clay' | 'unknown';
export type SoilDrainage = 'good' | 'poor' | 'unknown';

export interface Site {
  id: string;
  name: string;
  department: string;
  /** Approximate public coordinates; never a real plot. */
  approxLat: number;
  approxLon: number;
  crops: CropId[];
  isDemo: boolean;
}

export interface CompareRequest {
  siteId: string;
  currentCrop: CropId;
  soil: { texture: SoilTexture; drainage: SoilDrainage };
  /** Order matters: the first one weighs the most. */
  priorities: Priority[];
}

export type SourceKind = 'nasa' | 'local-reference' | 'technical-reference' | 'user-input' | 'demo-assumption';

export interface Source {
  id: string;
  name: string;
  url: string | null;
  version: string | null;
  kind: SourceKind;
  note: string;
}

export type ClimateMetricId = 'seasonRainMean' | 'drySpellYears' | 'tMaxMean' | 'precipTotal' | 'dryDays';

export interface ClimateMetric {
  id: ClimateMetricId;
  value: number | null;
  unit: string;
  /** For "k of n" figures: the total `value` is read against. */
  total: number | null;
  /** What the figure means, already in the UI language. */
  label: string;
  /** Explicit cause when `value` is null. */
  reason: string | null;
  sourceId: string;
}

export interface Climate {
  status: 'available' | 'partial' | 'unavailable';
  /** `saved-sample` is the one-week historical sample used when NASA POWER does not answer. */
  kind: 'season-history' | 'saved-sample';
  period: { start: string; end: string };
  /** The period in words, for example "May to October, 2016–2025". */
  periodLabel: string;
  coverage: { validDays: number; expectedDays: number };
  validYears: number;
  expectedYears: number;
  metrics: ClimateMetric[];
  sourceId: string;
  spatialScale: string | null;
  cacheAgeHours: number | null;
  /** true when the provider failed and the server answered with a saved copy. */
  stale: boolean;
  /** Alert the climate data raises in the comparison, if any. */
  alert: { priority: Priority; text: string } | null;
  note: string;
  /** Each rainy season with complete NASA data. Empty when the server does not send it. */
  years: SeasonYear[];
}

export interface SeasonYear {
  year: number;
  /** Total rain from May to October, mm. */
  seasonRainMm: number;
  /** Longest run of days under 1 mm in July and August. */
  longestDrySpellDays: number;
}

export type CriterionLevel = 'favorable' | 'neutral' | 'unfavorable';

export interface Criterion {
  priority: Priority;
  status: 'evaluable' | 'undetermined';
  /** null when the criterion cannot be determined. */
  level: CriterionLevel | null;
  value: number | null;
  unit: string | null;
  reason: string;
  evidence: string[];
}

export interface Scenario {
  id: string;
  role: 'current' | 'alternative';
  sequence: CropId[];
  summary: string;
  limitation: string;
  missingData: string | null;
  criteria: Criterion[];
  sourceIds: string[];
  /** true when a hard constraint (waterlogged land) keeps it from being highlighted. */
  blocked: boolean;
}

export interface Highlight {
  scenarioId: string;
  priority: Priority;
  reason: string;
}

export type ExplanationFallbackReason = 'not_configured' | 'timeout' | 'rate_limited' | 'provider_error' | 'invalid_output';

/**
 * Plain-language explanation of the calculated result. `groq` means an AI model
 * worded it from the server's figures; `rules` is the server's own short text.
 */
export interface Explanation {
  source: 'groq' | 'rules';
  model: string | null;
  /** Why the AI wording was not used when `source` is "rules". */
  fallbackReason: ExplanationFallbackReason | null;
  consider: string;
  influence: string;
  caution: string;
  verify: string;
}

export interface CompareResponse {
  /** true when the server had to fall back to its saved historical sample. */
  isDemo: boolean;
  climate: Climate;
  scenarios: Scenario[];
  sources: Source[];
  warnings: string[];
  methodVersion: string;
  highlight: Highlight | null;
  explanation: Explanation | null;
}

/**
 * Complementary weather: `GET /v1/climate/meteomatics`.
 * A modelled product from a second provider. It never feeds the comparison.
 */
export interface ComplementaryClimateQuery {
  /** Approximate public point of the chosen area. */
  latitude?: number;
  longitude?: number;
  /** `YYYY-MM-DD`, at most 31 days, ending in the past. */
  start?: string;
  end?: string;
}

/** Why there is no data. `unreachable` is set by this frontend when the server does not answer. */
export type ComplementaryClimateReason = 'not_configured' | 'auth_failed' | 'timeout' | 'upstream_error' | 'invalid_response' | 'unreachable';

export interface WeatherPoint {
  validAt: string;
  temperatureC: number | null;
  rainMm: number | null;
}

export interface CurrentWeather {
  status: 'available' | 'partial' | 'unavailable';
  /** Why there is no forecast (server reason, for example `not_configured`). */
  reason: string | null;
  current: WeatherPoint | null;
  forecast: WeatherPoint[];
}

export interface ComplementaryClimateDay {
  date: string;
  tMaxC: number | null;
  tMinC: number | null;
  precipMm: number | null;
}

export interface ComplementaryClimate {
  source: 'meteomatics';
  status: 'available' | 'partial' | 'unavailable';
  reason: ComplementaryClimateReason | null;
  period: { start: string; end: string };
  coverage: { validDays: number; expectedDays: number };
  days: ComplementaryClimateDay[];
  provenance: { product: string; model: string | null; retrievedAt: string | null; timeStandard: string | null } | null;
  /** true when the provider failed and the server answered with a saved copy. */
  stale: boolean;
}
