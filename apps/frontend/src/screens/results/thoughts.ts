/**
 * What Yago shows while the AI is working: each line names a piece of data it
 * is actually going through for THIS query (the NASA figures of the area, the
 * farmer's answers, the options being compared). Nothing here is made up: if
 * a figure is missing, its line is left out.
 */
import type { CompareResponse, Priority, Site } from '../../api/types';
import type { Translations } from '../../i18n';
import type { Answers } from '../../types/answers';
import { formatSequence } from './formatSequence';

interface ThoughtInput {
  t: Translations;
  answers: Answers;
  site: Site | null;
  priority: Priority;
  /** The comparison already on screen, if any (its NASA figures do not change with the priority). */
  data: CompareResponse | null;
}

const round = (value: number) => (Math.abs(value) >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString());

/** Lines about the farmer's own answers. */
function answerThoughts({ t, answers, priority }: ThoughtInput): string[] {
  const text = t.results.thoughts;
  const lines: string[] = [];
  if (answers.crop) lines.push(text.currentCrop(t.crop[answers.crop].inline));
  lines.push(text.drainage[answers.drainage]);
  if (answers.texture !== 'unknown') lines.push(text.texture(t.texture[answers.texture].inline));
  lines.push(text.priority(t.priority[priority].goal));
  return lines;
}

/** Lines about the NASA figures and the options, once the comparison exists. */
function dataThoughts({ t, site, priority, data }: ThoughtInput): string[] {
  if (!data) return [];
  const text = t.results.thoughts;
  const place = site?.department || site?.name || t.results.area;
  const climate = data.climate;
  const metric = (id: string) => climate.metrics.find((item) => item.id === id);
  const lines: string[] = [];

  const rain = metric('seasonRainMean');
  if (rain?.value != null) lines.push(text.seasonRain(place, round(rain.value), climate.periodLabel));
  const spells = metric('drySpellYears');
  if (spells?.value != null && spells.total != null) lines.push(text.drySpells(round(spells.value), spells.total, spells.label));
  const wettest = climate.years.length > 1 ? climate.years.reduce((a, b) => (b.seasonRainMm > a.seasonRainMm ? b : a)) : null;
  const driest = climate.years.length > 1 ? climate.years.reduce((a, b) => (b.seasonRainMm < a.seasonRainMm ? b : a)) : null;
  if (wettest && driest) lines.push(text.extremes(driest.year, round(driest.seasonRainMm), wettest.year, round(wettest.seasonRainMm)));
  const heat = metric('tMaxMean');
  if (heat?.value != null) lines.push(text.heat(round(heat.value)));
  if (climate.status === 'unavailable') lines.push(text.noNasa);

  const sequences = data.scenarios.map((scenario) => formatSequence(scenario, t));
  if (sequences.length > 1) lines.push(text.comparing(sequences, t.priority[priority].goal));
  return lines;
}

/** First load: the comparison is not here yet, so only the answers and the request to NASA. */
export function loadingThoughts(input: ThoughtInput): string[] {
  const text = input.t.results.thoughts;
  const place = input.site?.department || input.site?.name || input.t.results.area;
  return [text.askingNasa(place), ...answerThoughts(input), text.writing];
}

/** Thinking over a comparison: real NASA figures and the options, then the answers. */
export function analysisThoughts(input: ThoughtInput): string[] {
  return [...dataThoughts(input), ...answerThoughts(input), input.t.results.thoughts.writing];
}
