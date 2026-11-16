import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CurrentWeather, Site } from '../../../api/types';
import { SCENES } from '../../../components/scene';
import { Grain, Icon, ThinkingDots, isHovered } from '../../../components/ui';
import { useReducedMotion } from '../../../context/ReducedMotionContext';
import { useLoopAnimation } from '../../../hooks/useLoopAnimation';
import { useTranslation } from '../../../i18n';
import { USE_NATIVE_DRIVER, colors, fonts, images, isWeb } from '../../../theme';
import { interpolate } from '../../../utils/animation';
import { SKY_COLORS, TIME_ZONE, dayPeriod, describe, hourInElSalvador, rainNext6h, skyFor, temperatureRange } from './sky';
import type { DayPeriod, Sky } from './sky';
import { useCountUp } from './useCountUp';

interface WeatherHeroProps {
  site: Site;
  weather: CurrentWeather | null;
  loading: boolean;
  onRefresh: () => void;
  height: number;
}

const MILPA = SCENES.find((scene) => scene.key === 'cornfield') ?? SCENES[0];

/** Sky gradient on the web; a solid colour on native builds. */
function skyStyle(sky: Sky) {
  const [top, middle, bottom] = SKY_COLORS[sky];
  return isWeb ? ({ backgroundImage: `linear-gradient(170deg, ${top} 0%, ${middle} 52%, ${bottom} 100%)` } as object) : { backgroundColor: middle };
}

/**
 * The sun breathes; at dawn and dusk it sits on the horizon, half behind the
 * hill. At night, a moon with a few stars that twinkle.
 */
function Celestial({ period, horizon }: { period: DayPeriod; horizon: number }) {
  const pulse = useLoopAnimation(2400);
  const twinkle = useLoopAnimation(1300);
  if (period === 'night') {
    return (
      <View pointerEvents="none" style={styles.celestial}>
        {[[-90, 30], [-150, 90], [-40, 120], [-200, 20], [-120, 160]].map(([x, y], star) => (
          <Animated.View key={star} style={[styles.star, { left: 110 + x, top: y, opacity: interpolate(twinkle, [0, 1], star % 2 ? [0.25, 0.9] : [0.9, 0.25]) }]} />
        ))}
        <View style={styles.moon}>
          <View style={styles.moonShade} />
        </View>
      </View>
    );
  }
  const low = period !== 'day';
  return (
    <View pointerEvents="none" style={[styles.celestial, low && { top: horizon - 50, right: 40 }]}>
      <Animated.Image source={images.haloMaize} resizeMode="contain" style={[styles.sunGlow, { opacity: interpolate(pulse, [0, 1], [0.55, 0.95]), transform: [{ scale: interpolate(pulse, [0, 1], [0.92, 1.12]) }] }]} />
      <Animated.View style={[styles.sun, { transform: [{ scale: interpolate(pulse, [0, 1], [0.97, 1.05]) }] }]} />
    </View>
  );
}

/** Thin drops falling across the sky when rain is expected. */
function RainCurtain({ heavy, height }: { heavy: boolean; height: number }) {
  const reduced = useReducedMotion();
  const count = heavy ? 26 : 14;
  const drops = useMemo(() => Array.from({ length: count }, (_, drop) => ({ left: `${(drop * 37) % 100}%`, delay: (drop * 173) % 1100, duration: 900 + ((drop * 97) % 600) })), [count]);
  const fall = useRef(drops.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduced) return;
    const loops = drops.map((drop, index) =>
      Animated.loop(Animated.sequence([Animated.delay(drop.delay), Animated.timing(fall[index], { toValue: 1, duration: drop.duration, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER })])),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [drops, fall, reduced]);

  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {drops.map((drop, index) => (
        <Animated.View
          key={index}
          style={[styles.drop, { left: drop.left as `${number}%`, transform: [{ translateY: interpolate(fall[index], [0, 1], [-40, height]) }, { rotate: '12deg' }] }]}
        />
      ))}
    </View>
  );
}

/**
 * Top of the weather view, like opening a weather app: the place, the
 * temperature right now, a word for how the day is, and the milpa standing on
 * its ground under a sky that follows the hour in El Salvador.
 */
export function WeatherHero({ site, weather, loading, onRefresh, height }: WeatherHeroProps) {
  const { t, language } = useTranslation();
  const text = t.weather;
  const sway = useLoopAnimation(2800);
  const spin = useRef(new Animated.Value(0)).current;
  const now = weather?.current ?? null;
  const hour = hourInElSalvador(now?.validAt ?? new Date());
  const period = dayPeriod(hour);
  const rain6h = rainNext6h(weather);
  const sky = skyFor(period, rain6h);
  const condition = describe(now?.temperatureC ?? null, rain6h);
  const range = temperatureRange(weather);
  const temperature = useCountUp(now?.temperatureC != null ? Math.round(now.temperatureC) : null);
  const available = weather !== null && weather.status !== 'unavailable';
  const moment = period === 'night' ? 'night' : period === 'day' ? 'sun' : 'evening';
  const locale = language === 'es' ? 'es-SV' : 'en-US';
  const stampText = now ? new Intl.DateTimeFormat(locale, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE }).format(new Date(now.validAt)) : null;
  const stamp = stampText ? stampText.charAt(0).toUpperCase() + stampText.slice(1) : null;

  const refresh = () => {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
    onRefresh();
  };

  // The ground starts here; the sky (and the rain) end here.
  const groundTop = height - 186;
  const artSize = 210;

  return (
    <View style={[styles.hero, { height }, skyStyle(sky)]}>
      <Celestial period={period} horizon={height - 186} />
      {sky === 'rain' || condition === 'drizzle' ? <RainCurtain heavy={condition === 'downpour'} height={groundTop} /> : null}
      <Grain light opacity={0.14} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.place}>
            <Icon name="location" size={30} />
            <View style={styles.placeText}>
              <Text style={styles.placeName} numberOfLines={1}>{text.hereNow(site.department || site.name)}</Text>
              {stamp ? <Text style={styles.stamp}>{stamp}</Text> : null}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.refresh}
            onPress={refresh}
            disabled={loading}
            hitSlop={8}
            style={(state) => [styles.refresh, isHovered(state) && styles.refreshHovered, state.pressed && { opacity: 0.7 }]}
          >
            <Animated.Text style={[styles.refreshIcon, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>↻</Animated.Text>
          </Pressable>
        </View>

        {loading && !weather ? (
          <View style={styles.loading}>
            <Text style={styles.condition}>{text.loading}</Text>
            <ThinkingDots color={colors.ivory} />
          </View>
        ) : available ? (
          <>
            <Text style={styles.temperature} accessibilityLabel={now?.temperatureC != null ? `${Math.round(now.temperatureC)} °C` : text.noTemperature}>
              {temperature !== null ? `${Math.round(temperature)}°` : '—'}
            </Text>
            {condition ? <Text style={styles.condition}>{text.condition[condition][moment]}</Text> : null}
            <Text style={styles.detail}>{rain6h === null ? text.noRainData : rain6h >= 0.2 ? text.rainSoon(rain6h) : text.dryNext6h}</Text>
          </>
        ) : (
          <>
            <Text style={styles.temperature}>—°</Text>
            <Text style={styles.condition}>{text.unavailableTitle}</Text>
            <Text style={styles.detail}>{weather?.reason === 'not_configured' ? text.notConfigured : text.unreachable}</Text>
          </>
        )}
      </View>

      {/* The ground: a sandy hill where the milpa stands, like the art on the welcome screen. */}
      <View pointerEvents="none" style={[styles.ground, { top: groundTop }]} />
      <Image source={images.haloMaize} resizeMode="contain" style={[styles.artGlow, { width: artSize * 1.2, height: artSize * 1.2, bottom: -artSize * 0.2, right: -artSize * 0.3 }]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.art,
          {
            width: artSize,
            height: artSize,
            // Low enough that the edges of the drawing stay hidden by the hill and the card.
            bottom: -40,
            transformOrigin: 'bottom',
            transform: [{ rotate: interpolate(sway, [0, 1], ['-1.6deg', '1.6deg']) }],
          },
        ]}
      >
        <Image source={MILPA.sharp} style={{ width: artSize, height: artSize }} resizeMode="contain" />
      </Animated.View>
      <View style={[styles.groundText, { top: groundTop + 42 }]}>
        <Text style={styles.rangeLabel}>{text.next24h}</Text>
        <Text style={styles.range}>{range ? `↑ ${range.max}°  ↓ ${range.min}°` : '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 32, overflow: 'hidden', backgroundColor: colors.ink },
  content: { padding: 20, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  placeText: { flexShrink: 1 },
  placeName: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, color: colors.ivory },
  stamp: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18, color: colors.ivorySoft },
  refresh: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.ivoryLine, alignItems: 'center', justifyContent: 'center' },
  refreshHovered: { backgroundColor: 'rgba(247,243,232,0.14)' },
  refreshIcon: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 24, color: colors.ivory },
  loading: { marginTop: 40, gap: 12 },
  temperature: { fontFamily: fonts.display, fontSize: 104, lineHeight: 112, letterSpacing: -4, color: colors.ivory, marginTop: 10 },
  condition: { fontFamily: fonts.displaySoft, fontSize: 30, lineHeight: 34, color: colors.ivory, letterSpacing: -0.6 },
  detail: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 22, color: colors.ivorySoft, marginTop: 6, maxWidth: 260 },
  celestial: { position: 'absolute', top: 70, right: 26, width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  sunGlow: { position: 'absolute', width: 230, height: 230 },
  sun: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.maize },
  moon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.ivory, overflow: 'hidden' },
  moonShade: { position: 'absolute', left: 18, top: -6, width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(11,14,12,0.78)' },
  star: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ivory },
  drop: { position: 'absolute', top: 0, width: 2, height: 18, borderRadius: 1, backgroundColor: 'rgba(247,243,232,0.55)' },
  // A circle three times wider than the card: only its top shows, as a gentle hill.
  ground: { position: 'absolute', left: '-100%', width: '300%', aspectRatio: 1, borderRadius: 9999, backgroundColor: colors.sand, borderWidth: 2, borderColor: 'rgba(23,26,22,0.1)' },
  artGlow: { position: 'absolute', opacity: 0.6 },
  art: { position: 'absolute', right: -34 },
  groundText: { position: 'absolute', left: 22 },
  rangeLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.inkSoft },
  range: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
});
