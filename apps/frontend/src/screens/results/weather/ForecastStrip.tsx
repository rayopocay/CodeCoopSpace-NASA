import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { CurrentWeather, WeatherPoint } from '../../../api/types';
import { Enter, Grain } from '../../../components/ui';
import { useReducedMotion } from '../../../context/ReducedMotionContext';
import { useTranslation } from '../../../i18n';
import { USE_NATIVE_DRIVER, colors, fonts } from '../../../theme';
import { SkyGlyph } from './SkyGlyph';
import { TIME_ZONE, glyphFor } from './sky';

interface ForecastStripProps {
  weather: CurrentWeather;
}

const CHART_HEIGHT = 54;
const CHART_PAD = 10;
const BAR_HEIGHT = 40;
/** Rain that fills a whole bar, mm in 6 hours. More than this is drawn full. */
const FULL_BAR_MM = 20;

/**
 * The next 24 hours in five columns: now, then every 6 hours. A line joins
 * the temperatures and bars show the rain expected in each 6-hour stretch.
 */
export function ForecastStrip({ weather }: ForecastStripProps) {
  const { t, language } = useTranslation();
  const text = t.weather;
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const grow = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const points: (WeatherPoint & { now?: boolean })[] = [...(weather.current ? [{ ...weather.current, now: true }] : []), ...weather.forecast];
  const locale = language === 'es' ? 'es-SV' : 'en-US';
  const hourLabel = new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: TIME_ZONE });

  useEffect(() => {
    if (reduced) return;
    Animated.timing(grow, { toValue: 1, duration: 900, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [grow, reduced]);

  const temps = points.map((point) => point.temperatureC);
  const known = temps.filter((value): value is number => value !== null);
  const min = Math.min(...known);
  const max = Math.max(...known);
  const column = points.length ? width / points.length : 0;
  const y = (value: number) => CHART_PAD + (max === min ? 0.5 : 1 - (value - min) / (max - min)) * (CHART_HEIGHT - CHART_PAD * 2);
  const dots = points.flatMap((point, index) => (point.temperatureC === null ? [] : [{ index, x: column * (index + 0.5), y: y(point.temperatureC) }]));
  const segments = dots.slice(1).map((dot, index) => {
    const previous = dots[index];
    const dx = dot.x - previous.x;
    const dy = dot.y - previous.y;
    return { key: dot.index, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx), cx: (dot.x + previous.x) / 2, cy: (dot.y + previous.y) / 2 };
  });

  return (
    <View style={styles.card}>
      <Grain light opacity={0.1} />
      <Text style={styles.title}>{text.forecastTitle}</Text>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.row}>
          {points.map((point, index) => (
            <Enter key={point.validAt} delay={120 + index * 90} offsetY={14} style={styles.column}>
              <Text style={[styles.hour, point.now && styles.hourNow]}>{point.now ? text.now : hourLabel.format(new Date(point.validAt))}</Text>
              <SkyGlyph kind={glyphFor(point)} />
              <Text style={styles.temp}>{point.temperatureC === null ? '—' : `${Math.round(point.temperatureC)}°`}</Text>
            </Enter>
          ))}
        </View>

        {width > 0 && dots.length > 1 ? (
          <Animated.View style={[styles.chart, { opacity: grow }]}>
            {segments.map((segment) => (
              <View
                key={segment.key}
                style={[styles.segment, { width: segment.length, left: segment.cx - segment.length / 2, top: segment.cy - 1, transform: [{ rotate: `${segment.angle}rad` }] }]}
              />
            ))}
            {dots.map((dot) => (
              <View key={dot.index} style={[styles.dot, { left: dot.x - 5, top: dot.y - 5 }, points[dot.index].now && styles.dotNow]} />
            ))}
          </Animated.View>
        ) : null}

        <View style={styles.row}>
          {points.map((point, index) => {
            const share = point.rainMm === null ? 0 : Math.max(0.06, Math.min(point.rainMm / FULL_BAR_MM, 1));
            return (
              <View key={point.validAt} style={styles.column}>
                <View style={styles.barTrack}>
                  {point.rainMm !== null ? (
                    <Animated.View
                      style={[
                        styles.bar,
                        { height: BAR_HEIGHT * share, transformOrigin: 'bottom', transform: [{ scaleY: grow.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }) }] },
                        point.rainMm >= 2 && styles.barWet,
                      ]}
                    />
                  ) : null}
                </View>
                <Text style={styles.rain}>{point.rainMm === null ? (index === 0 && point.now ? ' ' : '—') : `${formatMm(point.rainMm)} mm`}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={styles.caption}>{text.rainCaption}</Text>
    </View>
  );
}

const formatMm = (value: number) => (value < 10 ? value.toFixed(1).replace(/\.0$/, '') : Math.round(value).toString());

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderRadius: 28, padding: 18, gap: 12, overflow: 'hidden' },
  title: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.maize },
  row: { flexDirection: 'row' },
  column: { flex: 1, alignItems: 'center', gap: 6 },
  hour: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 18, color: colors.ivorySoft },
  hourNow: { color: colors.maize, fontFamily: fonts.bold },
  temp: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ivory },
  chart: { height: CHART_HEIGHT, marginVertical: 2 },
  segment: { position: 'absolute', height: 2, borderRadius: 1, backgroundColor: 'rgba(247,243,232,0.55)' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ivory },
  dotNow: { backgroundColor: colors.maize },
  barTrack: { height: BAR_HEIGHT, width: 14, borderRadius: 7, backgroundColor: 'rgba(247,243,232,0.1)', justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: 14, borderRadius: 7, backgroundColor: 'rgba(247,243,232,0.6)' },
  barWet: { backgroundColor: colors.maize },
  rain: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 17, color: colors.ivorySoft },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ivorySoft },
});
