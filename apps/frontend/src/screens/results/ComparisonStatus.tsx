import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { FloatingHalos, SCENES, SceneStage } from '../../components/scene';
import { AppText, Button, Enter, ThinkingDots } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { usePointer } from '../../hooks/usePointer';
import { useTranslation } from '../../i18n';
import type { SceneKey } from '../../i18n';
import { USE_NATIVE_DRIVER, colors, fonts, isWeb } from '../../theme';

/** Sand transition of the loader: quicker than the welcome screen's. */
const LOADER_SAND_MS = 1100;
/** Each scene stays this long, sand transition included, while the comparison loads. */
const LOADER_SCENE_MS = LOADER_SAND_MS + 550;
const LOADER_STEP_MS = 2200;
/** Horizontal nudge of a scene inside the round frame, as a share of its size (the hen sits too far left). */
const SCENE_NUDGE: Partial<Record<SceneKey, number>> = { hen: 0.12 };
/** On the web the art fades into the frame instead of being cut by it. */
const feather = isWeb
  ? ({ backgroundImage: 'radial-gradient(circle at center, rgba(247,243,232,0) 55%, rgba(247,243,232,0.9) 66%, #F7F3E8 71%)' } as object)
  : null;

/**
 * Full-screen loader shown before the first comparison arrives. It is the same
 * stage as the welcome screen: the animals and plants turn into sand and into
 * the next one, while each line says what Yago is going through for this query.
 */
export function ComparisonLoader({ thoughts }: { thoughts: string[] }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const pointer = usePointer(!reduced);
  const [scene, setScene] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setScene((current) => (current + 1) % SCENES.length), LOADER_SCENE_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => Math.min(current + 1, thoughts.length - 1)), LOADER_STEP_MS);
    return () => clearInterval(timer);
  }, [thoughts.length]);

  const size = Math.min(width * 0.72, height * 0.42, 380);
  const nudge = useRef(new Animated.Value(0)).current;
  const nudgeTo = (SCENE_NUDGE[SCENES[scene].key] ?? 0) * size;

  // The nudge glides during the sand transition, so the change of place is not seen as a jump.
  useEffect(() => {
    Animated.timing(nudge, { toValue: nudgeTo, duration: reduced ? 0 : LOADER_SAND_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [nudge, nudgeTo, reduced]);

  return (
    <View style={styles.loader} accessibilityRole="progressbar" accessibilityLabel={t.results.comparing}>
      <FloatingHalos pointer={pointer} width={width} height={height} size={size * 0.9} />
      <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
        <Animated.View style={{ transform: [{ translateX: nudge }] }}>
          <SceneStage index={scene} size={size} reduced={reduced} pointer={pointer} transitionMs={LOADER_SAND_MS} />
        </Animated.View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, feather]} />
      </View>
      <View style={styles.caption}>
        <View style={styles.thinking}>
          <AppText variant="lead" color={colors.ink} style={styles.loaderText}>{t.results.comparing}</AppText>
          <ThinkingDots />
        </View>
        <Enter key={step} offsetY={10} duration={380}>
          <AppText variant="body" style={styles.step} accessibilityLiveRegion="polite">{thoughts[step]}</AppText>
        </Enter>
      </View>
    </View>
  );
}

/** Shown when the comparison could not be loaded at all. */
export function ComparisonError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.centered, styles.error]}>
      <AppText variant="title" style={styles.centerText}>{t.results.errorTitle}</AppText>
      <AppText variant="lead" style={styles.centerText}>{t.results.errorText}</AppText>
      <Button label={t.results.retry} onPress={onRetry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', paddingHorizontal: 20 },
  frame: { overflow: 'hidden', borderWidth: 2, borderColor: colors.line, backgroundColor: colors.ivory, marginBottom: 14 },
  // Fixed room for up to three lines, so the frame does not jump when a thought is longer.
  caption: { alignItems: 'center', gap: 6, height: 124 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loaderText: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  step: { textAlign: 'center', color: colors.inkSoft, maxWidth: 360 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  error: { padding: 24 },
  centerText: { textAlign: 'center' },
  retry: { alignSelf: 'stretch' },
});
