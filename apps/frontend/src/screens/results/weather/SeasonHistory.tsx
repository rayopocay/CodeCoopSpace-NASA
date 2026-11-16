import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Climate, ClimateMetric, ClimateMetricId, SeasonYear, Source } from '../../../api/types';
import { Enter, Icon, isHovered } from '../../../components/ui';
import { useReducedMotion } from '../../../context/ReducedMotionContext';
import { useTranslation } from '../../../i18n';
import { USE_NATIVE_DRIVER, colors, fonts } from '../../../theme';
import type { IconName } from '../../../theme';
import { SourceKindChip } from '../SourceKindChip';
import { DRY_SPELL_DAYS } from './sky';

interface SeasonHistoryProps {
  climate: Climate;
  sources: Source[];
}

const METRIC_ICON: Record<ClimateMetricId, IconName> = {
  seasonRainMean: 'rain',
  precipTotal: 'rain',
  drySpellYears: 'dry',
  dryDays: 'dry',
  tMaxMean: 'sun',
};
const CHART_HEIGHT = 150;

/** One bar per rainy season; seasons with a dry spell are painted maize. Tap one to read it. */
function SeasonBars({ years, mean }: { years: SeasonYear[]; mean: number | null }) {
  const { t } = useTranslation();
  const text = t.weather;
  const reduced = useReducedMotion();
  const grow = useRef(years.map(() => new Animated.Value(reduced ? 1 : 0))).current;
  const [selected, setSelected] = useState(years.length - 1);
  const top = Math.max(...years.map((year) => year.seasonRainMm), mean ?? 0) * 1.08;
  const chosen = years[selected];

  useEffect(() => {
    if (reduced) return;
    Animated.stagger(70, grow.map((value) => Animated.spring(value, { toValue: 1, speed: 9, bounciness: 7, useNativeDriver: USE_NATIVE_DRIVER }))).start();
  }, [grow, reduced]);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{text.seasonBarsTitle}</Text>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutYear}>{chosen.year}</Text>
        <Text style={styles.readoutText}>{text.seasonReadout(Math.round(chosen.seasonRainMm), chosen.longestDrySpellDays)}</Text>
      </View>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {mean !== null ? (
          <View pointerEvents="none" style={[styles.meanLine, { bottom: (mean / top) * CHART_HEIGHT }]} />
        ) : null}
        {years.map((year, index) => {
          const dry = year.longestDrySpellDays >= DRY_SPELL_DAYS;
          const active = index === selected;
          return (
            <Pressable
              key={year.year}
              accessibilityRole="button"
              accessibilityLabel={`${year.year}: ${text.seasonReadout(Math.round(year.seasonRainMm), year.longestDrySpellDays)}`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(index)}
              style={(state) => [styles.barSlot, isHovered(state) && styles.barHovered]}
            >
              <Animated.View
                style={[
                  styles.bar,
                  { height: (year.seasonRainMm / top) * CHART_HEIGHT, transformOrigin: 'bottom', transform: [{ scaleY: grow[index] }] },
                  dry && styles.barDry,
                  active && styles.barActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {years.map((year, index) => (
          <Text key={year.year} style={[styles.axisLabel, index === selected && styles.axisActive]}>{`’${String(year.year).slice(2)}`}</Text>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendSwatch, styles.barDry]} />
        <Text style={styles.legendText}>{text.drySpellLegend(DRY_SPELL_DAYS)}</Text>
      </View>
      {mean !== null ? (
        <View style={styles.legend}>
          <View style={styles.legendDash} />
          <Text style={styles.legendText}>{text.meanLabel(Math.round(mean))}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * How the rainy season ("el invierno") has been in this area, from NASA
 * POWER: three key figures and a bar for every year, with source, period,
 * coverage and scale always visible.
 */
export function SeasonHistory({ climate, sources }: SeasonHistoryProps) {
  const { t } = useTranslation();
  const text = t.weather;
  const results = t.results;
  const source = sources.find((item) => item.id === climate.sourceId);
  const sourceUrl = source?.url;
  const isSample = climate.kind === 'saved-sample';
  const mean = climate.metrics.find((metric) => metric.id === 'seasonRainMean')?.value ?? null;
  const coverage = isSample ? results.coverage(climate.coverage.validDays, climate.coverage.expectedDays) : results.yearsCoverage(climate.validYears, climate.expectedYears);

  const formatValue = (metric: ClimateMetric) => {
    if (metric.value === null) return results.noData;
    if (metric.total !== null) return results.outOf(metric.value, metric.total);
    return `${metric.value} ${metric.unit}`;
  };

  return (
    <View style={styles.section}>
      <Enter offsetY={18}>
        <Text style={styles.kicker}>{text.historyKicker}</Text>
        <Text style={styles.heading}>{isSample ? results.climateSampleTitle : text.historyTitle}</Text>
        <Text style={styles.sub}>{climate.periodLabel ? text.historySub(climate.periodLabel) : ''}</Text>
      </Enter>

      <View style={styles.stats}>
        {climate.metrics.map((metric, index) => (
          <Enter key={metric.id} delay={100 + index * 110} offsetY={16} style={styles.stat}>
            <Icon name={METRIC_ICON[metric.id] ?? 'rain'} size={42} />
            <Text style={styles.statTitle}>{text.metricTitle[metric.id] ?? metric.label}</Text>
            <Text style={styles.statValue}>{formatValue(metric)}</Text>
            <Text style={styles.statCaption}>{metric.value === null && metric.reason ? metric.reason : metric.label}</Text>
          </Enter>
        ))}
      </View>

      {climate.alert ? (
        <Enter delay={300} offsetY={16}>
          <View style={styles.alert}>
            <Text style={styles.alertTitle}>{results.waterAlert}</Text>
            <Text style={styles.alertText}>{climate.alert.text}</Text>
          </View>
        </Enter>
      ) : null}

      {climate.years.length > 1 ? (
        <Enter delay={380} offsetY={18}>
          <SeasonBars years={climate.years} mean={mean} />
        </Enter>
      ) : null}

      <View style={styles.sourceCard}>
        <View style={styles.sourceHeading}>
          <SourceKindChip kind={source?.kind ?? 'nasa'} />
          <Text style={styles.sourceName}>
            {source?.name ?? results.source}
            {source?.version ? ` · ${source.version}` : ''}
          </Text>
        </View>
        <Text style={styles.sourceText}>
          {[climate.periodLabel, coverage, climate.spatialScale].filter(Boolean).join(' · ')}
        </Text>
        {climate.note ? <Text style={styles.sourceText}>{climate.note}</Text> : null}
        {sourceUrl ? (
          <Pressable accessibilityRole="link" accessibilityLabel={results.openNasaQueryLabel} onPress={() => Linking.openURL(sourceUrl)} hitSlop={8} style={(state) => [styles.link, isHovered(state) && styles.linkHovered]}>
            <Text style={styles.linkText}>{results.openNasaQuery}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  kicker: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.leaf },
  heading: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: colors.ink, marginTop: 2 },
  sub: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.inkSoft, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 150, backgroundColor: colors.paper, borderRadius: 22, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.line },
  statTitle: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkSoft, marginTop: 6 },
  statValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  statCaption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.inkSoft },
  alert: { backgroundColor: colors.ink, borderRadius: 20, padding: 18, gap: 4 },
  alertTitle: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.maize },
  alertText: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 24, color: colors.ivory },
  chartCard: { backgroundColor: colors.sand, borderRadius: 26, padding: 18, gap: 10 },
  chartTitle: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.inkSoft },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  readoutYear: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.ink },
  readoutText: { flexShrink: 1, fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20, color: colors.inkSoft },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', borderRadius: 8 },
  barHovered: { backgroundColor: 'rgba(23,26,22,0.06)' },
  bar: { width: '100%', borderRadius: 8, backgroundColor: 'rgba(23,26,22,0.78)' },
  barDry: { backgroundColor: colors.maize },
  barActive: { borderWidth: 2, borderColor: colors.ink },
  meanLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.leaf, zIndex: 1 },
  axis: { flexDirection: 'row', gap: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16, color: colors.inkFaint },
  axisActive: { color: colors.ink, fontFamily: fonts.bold },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4 },
  legendDash: { width: 14, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.leaf },
  legendText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.inkSoft },
  sourceCard: { borderRadius: 22, padding: 16, gap: 6, borderWidth: 1, borderColor: colors.line },
  sourceHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sourceName: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  sourceText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  link: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 8, marginLeft: -8, borderRadius: 10 },
  linkHovered: { backgroundColor: colors.sand },
  linkText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink, textDecorationLine: 'underline' },
});
