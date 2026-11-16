import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { CurrentWeather } from '../../../api/types';
import { Enter, Grain } from '../../../components/ui';
import { useReducedMotion } from '../../../context/ReducedMotionContext';
import { useLoopAnimation } from '../../../hooks/useLoopAnimation';
import { useTranslation } from '../../../i18n';
import { colors, fonts } from '../../../theme';
import { interpolate } from '../../../utils/animation';
import { rainNext24h, temperatureRange } from './sky';
import { useCountUp } from './useCountUp';

/** Rain that fills the jar, mm in 24 hours. */
const FULL_JAR_MM = 40;
/** Thermometer scale, °C. */
const THERMO_MIN = 15;
const THERMO_MAX = 40;

/** A level that rises from empty to `share` (0–1) when it appears. JS driver: it animates a height. */
function useFill(share: number) {
  const reduced = useReducedMotion();
  const level = useRef(new Animated.Value(reduced ? share : 0)).current;
  useEffect(() => {
    if (reduced) {
      level.setValue(share);
      return;
    }
    Animated.timing(level, { toValue: share, duration: 1200, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [share, level, reduced]);
  return level;
}

/** A jar that fills with the rain to come; the surface wobbles a little. */
function RainJar({ share }: { share: number }) {
  const level = useFill(share);
  const wobble = useLoopAnimation(1100, false);
  return (
    <View style={styles.jar}>
      <Animated.View style={[styles.water, { height: level.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }) }]}>
        <Animated.View style={[styles.surface, { transform: [{ translateY: interpolate(wobble, [0, 1], [-1.5, 1.5]) }, { scaleX: interpolate(wobble, [0, 1], [0.92, 1.04]) }] }]} />
      </Animated.View>
    </View>
  );
}

/** A thermometer whose column climbs to the highest temperature. */
function Thermometer({ share }: { share: number }) {
  const level = useFill(share);
  return (
    <View style={styles.thermo}>
      <View style={styles.tube}>
        <Animated.View style={[styles.mercury, { height: level.interpolate({ inputRange: [0, 1], outputRange: ['6%', '100%'] }) }]} />
      </View>
      <View style={styles.bulb} />
    </View>
  );
}

/**
 * Two big tiles with what a farmer looks at first in the next 24 hours: how
 * much water is coming and how hot it will get.
 */
export function FarmTiles({ weather }: { weather: CurrentWeather }) {
  const { t } = useTranslation();
  const text = t.weather;
  const rain = rainNext24h(weather);
  const range = temperatureRange(weather);
  const rainShown = useCountUp(rain);
  const heatShown = useCountUp(range?.max ?? null);

  return (
    <View style={styles.grid}>
      <Enter delay={120} offsetY={18} style={styles.cell}>
        <View style={[styles.tile, styles.tileLeaf]}>
          <Grain light opacity={0.12} />
          <View style={styles.tileTop}>
            <Text style={[styles.label, styles.onDark]}>{text.waterComing}</Text>
            <RainJar share={rain === null ? 0 : Math.min(rain / FULL_JAR_MM, 1)} />
          </View>
          <Text style={[styles.value, styles.onDarkStrong]}>{rainShown === null ? '—' : `${formatOne(rainShown)} mm`}</Text>
          <Text style={[styles.caption, styles.onDark]}>{rain === 0 ? text.noRain24h : text.in24h}</Text>
        </View>
      </Enter>
      <Enter delay={220} offsetY={18} style={styles.cell}>
        <View style={[styles.tile, styles.tileMaize]}>
          <Grain opacity={0.12} />
          <View style={styles.tileTop}>
            <Text style={styles.label}>{text.hottest}</Text>
            <Thermometer share={range === null ? 0 : Math.max(0, Math.min((range.max - THERMO_MIN) / (THERMO_MAX - THERMO_MIN), 1))} />
          </View>
          <Text style={styles.value}>{heatShown === null ? '—' : `${Math.round(heatShown)}°`}</Text>
          <Text style={styles.caption}>{text.in24h}</Text>
        </View>
      </Enter>
    </View>
  );
}

const formatOne = (value: number) => (Math.round(value * 10) / 10).toString();

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
  tile: { borderRadius: 26, padding: 16, gap: 4, minHeight: 176, overflow: 'hidden', justifyContent: 'space-between' },
  tileLeaf: { backgroundColor: colors.leaf },
  tileMaize: { backgroundColor: colors.maize },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink },
  value: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -1, color: colors.ink, marginTop: 8 },
  caption: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 19, color: colors.inkSoft },
  onDark: { color: colors.ivorySoft },
  onDarkStrong: { color: colors.ivory },
  jar: { width: 34, height: 52, borderRadius: 10, borderWidth: 2, borderColor: colors.ivory, borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  water: { backgroundColor: 'rgba(247,243,232,0.85)', width: '100%' },
  surface: { height: 4, marginTop: -2, borderRadius: 2, backgroundColor: colors.maize },
  thermo: { alignItems: 'center' },
  tube: { width: 14, height: 46, borderRadius: 7, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: 'rgba(255,253,247,0.6)' },
  mercury: { width: '100%', backgroundColor: colors.ink },
  bulb: { width: 22, height: 22, borderRadius: 11, marginTop: -5, backgroundColor: colors.ink },
});
