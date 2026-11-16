/**
 * Boundary between the backend JSON and the UI.
 *
 * Required fields are checked, and a missing one fails with a message that
 * names it, so a contract mismatch is obvious in the console. Optional fields
 * get a safe default and the UI simply hides that piece.
 */
import { ApiError } from './ApiError';
import type {
  Climate,
  ClimateMetric,
  CompareResponse,
  ComplementaryClimate,
  ComplementaryClimateDay,
  ComplementaryClimateReason,
  Criterion,
  CurrentWeather,
  Explanation,
  ExplanationFallbackReason,
  Priority,
  Scenario,
  Site,
  Source,
} from './types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

function fail(path: string, problem: string): never {
  throw new ApiError(`Response of ${path} does not match the contract: ${problem}`, 0, path);
}

function requireArray(parent: Json, key: string, path: string): unknown[] {
  const value = parent[key];
  if (!Array.isArray(value)) fail(path, `"${key}" must be an array`);
  return value;
}

function requireString(parent: Json, key: string, path: string, where: string): string {
  const value = parent[key];
  if (typeof value !== 'string') fail(path, `"${where}.${key}" must be a string`);
  return value;
}

const optionalString = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const numberOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function normalizeCurrentWeather(payload: unknown, path: string): CurrentWeather {
  if (!isObject(payload)) fail(path, 'expected weather object');
  const status = payload.status;
  if (status !== 'available' && status !== 'partial' && status !== 'unavailable') fail(path, 'invalid weather status');
  const point = (value: unknown) => {
    if (!isObject(value)) fail(path, 'invalid weather point');
    const validAt = requireString(value, 'validAt', path, 'weather');
    if (!Number.isFinite(Date.parse(validAt))) fail(path, 'invalid weather time');
    return { validAt, temperatureC: numberOrNull(value.temperatureC), rainMm: numberOrNull(value.rainMm) };
  };
  return {
    status,
    reason: optionalString(payload.reason),
    current: payload.current == null ? null : point(payload.current),
    forecast: requireArray(payload, 'forecast', path).map(point),
  };
}

export function normalizeSites(payload: unknown, path: string): Site[] {
  if (!Array.isArray(payload)) fail(path, 'expected an array of sites');
  return payload.map((item, index) => {
    if (!isObject(item)) fail(path, `sites[${index}] must be an object`);
    return {
      id: requireString(item, 'id', path, `sites[${index}]`),
      name: requireString(item, 'name', path, `sites[${index}]`),
      department: optionalString(item.department) ?? '',
      approxLat: Number(item.approxLat),
      approxLon: Number(item.approxLon),
      // Optional catalog: without it the wizard offers every crop.
      crops: Array.isArray(item.crops) ? (item.crops as Site['crops']) : ['maize', 'bean', 'sorghum'],
      isDemo: item.isDemo === true,
    };
  });
}

function normalizeCriterion(item: unknown, path: string, where: string): Criterion {
  if (!isObject(item)) fail(path, `${where} must be an object`);
  const level = item.level === 'favorable' || item.level === 'neutral' || item.level === 'unfavorable' ? item.level : null;
  return {
    priority: requireString(item, 'priority', path, where) as Criterion['priority'],
    status: item.status === 'undetermined' || level === null ? 'undetermined' : 'evaluable',
    level,
    value: numberOrNull(item.value),
    unit: optionalString(item.unit),
    reason: optionalString(item.reason) ?? '',
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  };
}

function normalizeScenario(item: unknown, path: string, index: number): Scenario {
  const where = `scenarios[${index}]`;
  if (!isObject(item)) fail(path, `${where} must be an object`);
  const sequence = requireArray(item, 'sequence', path) as Scenario['sequence'];
  const criteria = requireArray(item, 'criteria', path).map((criterion, criterionIndex) => normalizeCriterion(criterion, path, `${where}.criteria[${criterionIndex}]`));
  // Without `role`, repeating the same crop is the current rotation.
  const repeatsCrop = sequence.length > 1 && sequence.every((crop) => crop === sequence[0]);
  return {
    id: requireString(item, 'id', path, where),
    role: item.role === 'current' || item.role === 'alternative' ? item.role : repeatsCrop ? 'current' : 'alternative',
    sequence,
    summary: optionalString(item.summary) ?? '',
    limitation: optionalString(item.limitation) ?? '',
    missingData: optionalString(item.missingData),
    criteria,
    sourceIds: Array.isArray(item.sourceIds) ? (item.sourceIds as string[]) : Array.from(new Set(criteria.flatMap((criterion) => criterion.evidence))),
    blocked: item.blocked === true,
  };
}

function normalizeMetric(item: unknown, path: string, index: number): ClimateMetric {
  if (!isObject(item)) fail(path, `climate.metrics[${index}] must be an object`);
  return {
    id: requireString(item, 'id', path, `climate.metrics[${index}]`) as ClimateMetric['id'],
    value: numberOrNull(item.value),
    unit: optionalString(item.unit) ?? '',
    total: numberOrNull(item.total),
    label: optionalString(item.label) ?? '',
    reason: optionalString(item.reason),
    sourceId: optionalString(item.sourceId) ?? '',
  };
}

function normalizeClimate(value: unknown, path: string): Climate {
  if (!isObject(value)) fail(path, '"climate" must be an object');
  const period = isObject(value.period) ? value.period : {};
  const coverage = isObject(value.coverage) ? value.coverage : {};
  const alert = isObject(value.alert) && typeof value.alert.text === 'string' ? { priority: value.alert.priority as Priority, text: value.alert.text } : null;
  return {
    status: value.status === 'available' || value.status === 'partial' ? value.status : 'unavailable',
    kind: value.kind === 'saved-sample' ? 'saved-sample' : 'season-history',
    period: { start: optionalString(period.start) ?? '', end: optionalString(period.end) ?? '' },
    periodLabel: optionalString(value.periodLabel) ?? '',
    coverage: { validDays: Number(coverage.validDays ?? 0), expectedDays: Number(coverage.expectedDays ?? 0) },
    validYears: Number(value.validYears ?? 0),
    expectedYears: Number(value.expectedYears ?? 0),
    metrics: Array.isArray(value.metrics) ? value.metrics.map((metric, index) => normalizeMetric(metric, path, index)) : [],
    sourceId: optionalString(value.sourceId) ?? '',
    spatialScale: optionalString(value.spatialScale),
    cacheAgeHours: numberOrNull(value.cacheAgeHours),
    stale: value.stale === true,
    alert,
    note: optionalString(value.note) ?? '',
    years: Array.isArray(value.years)
      ? value.years.filter(isObject).flatMap((item) => {
          const year = numberOrNull(item.year);
          const rain = numberOrNull(item.seasonRainMm);
          const spell = numberOrNull(item.longestDrySpellDays);
          return year !== null && rain !== null && spell !== null ? [{ year, seasonRainMm: rain, longestDrySpellDays: spell }] : [];
        })
      : [],
  };
}

const FALLBACK_REASONS: ExplanationFallbackReason[] = ['not_configured', 'timeout', 'rate_limited', 'provider_error', 'invalid_output'];

function normalizeExplanation(value: unknown): Explanation | null {
  if (!isObject(value)) return null;
  const texts = [value.consider, value.influence, value.caution, value.verify].map(optionalString);
  if (texts.some((text) => text === null)) return null;
  const [consider, influence, caution, verify] = texts as string[];
  return {
    source: value.source === 'groq' ? 'groq' : 'rules',
    model: optionalString(value.model),
    fallbackReason: FALLBACK_REASONS.find((reason) => reason === value.fallbackReason) ?? null,
    consider,
    influence,
    caution,
    verify,
  };
}

export function normalizeCompareResponse(payload: unknown, path: string): CompareResponse {
  if (!isObject(payload)) fail(path, 'expected an object');
  const scenarios = requireArray(payload, 'scenarios', path).map((scenario, index) => normalizeScenario(scenario, path, index));
  const highlight = isObject(payload.highlight) && typeof payload.highlight.scenarioId === 'string' ? payload.highlight : null;
  return {
    isDemo: payload.isDemo === true,
    climate: normalizeClimate(payload.climate, path),
    scenarios,
    sources: requireArray(payload, 'sources', path) as Source[],
    warnings: Array.isArray(payload.warnings) ? (payload.warnings as string[]) : [],
    methodVersion: optionalString(payload.methodVersion) ?? '',
    highlight: highlight
      ? { scenarioId: highlight.scenarioId as string, priority: highlight.priority as Priority, reason: optionalString(highlight.reason) ?? '' }
      : null,
    explanation: normalizeExplanation(payload.explanation),
  };
}

const SERVER_REASONS: ComplementaryClimateReason[] = ['not_configured', 'auth_failed', 'timeout', 'upstream_error', 'invalid_response'];

export function normalizeComplementaryClimate(payload: unknown, path: string): ComplementaryClimate {
  if (!isObject(payload)) fail(path, 'expected an object');
  const status = requireString(payload, 'status', path, 'response');
  if (status !== 'available' && status !== 'partial' && status !== 'unavailable') fail(path, `unknown "status": ${status}`);
  const days = requireArray(payload, 'days', path).map((item, index): ComplementaryClimateDay => {
    if (!isObject(item)) fail(path, `days[${index}] must be an object`);
    return {
      date: requireString(item, 'date', path, `days[${index}]`),
      tMaxC: numberOrNull(item.tMaxC),
      tMinC: numberOrNull(item.tMinC),
      precipMm: numberOrNull(item.precipMm),
    };
  });
  const coverage = isObject(payload.coverage) ? payload.coverage : {};
  const provenance = isObject(payload.provenance) ? payload.provenance : null;
  const reason = SERVER_REASONS.find((item) => item === payload.reason) ?? null;
  return {
    source: 'meteomatics',
    status,
    // An unavailable answer without a known reason is still shown as a provider error.
    reason: status === 'unavailable' ? (reason ?? 'upstream_error') : null,
    period: { start: requireString(payload, 'start', path, 'response'), end: requireString(payload, 'end', path, 'response') },
    coverage: { validDays: Number(coverage.validDays ?? 0), expectedDays: Number(coverage.expectedDays ?? days.length) },
    days,
    provenance: provenance
      ? {
          product: optionalString(provenance.product) ?? 'Meteomatics Weather API',
          model: optionalString(provenance.model),
          retrievedAt: optionalString(provenance.retrievedAt),
          timeStandard: optionalString(provenance.timeStandard),
        }
      : null,
    stale: payload.stale === true,
  };
}
