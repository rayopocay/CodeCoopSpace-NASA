import { useEffect, useRef } from 'react';
import type { ComponentRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Site } from '../../api/types';
import { SCENES } from '../../components/scene';
import { AppText, Button, Enter, LanguageToggle, Logo, RoundButton } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { useTranslation } from '../../i18n';
import { WIDE_BREAKPOINT, colors } from '../../theme';
import type { Answers } from '../../types/answers';
import { AmbientArt } from './AmbientArt';
import { WIZARD_STEPS } from './steps';

interface WizardScreenProps {
  sites: Site[];
  /** The areas come from the server; these describe that request. */
  sitesLoading: boolean;
  sitesFailed: boolean;
  onRetrySites: () => void;
  answers: Answers;
  onChange: (patch: Partial<Answers>) => void;
  step: number;
  onStepChange: (step: number) => void;
  onExit: () => void;
  onDone: () => void;
}

/** One question per screen, with the actions at the bottom, within reach of the thumb. */
export function WizardScreen({ sites, sitesLoading, sitesFailed, onRetrySites, answers, onChange, step, onStepChange, onExit, onDone }: WizardScreenProps) {
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  // 1 when moving forward, -1 when going back: content slides in from that side.
  const direction = useRef(1);
  const progress = useRef(new Animated.Value(step)).current;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const total = WIZARD_STEPS.length;
  const { Component: StepBody, isComplete, sceneIndex } = WIZARD_STEPS[step];
  const copy = t.wizard.steps[step];
  const ready = isComplete(answers);
  const isLast = step === total - 1;

  useEffect(() => {
    // Width is a layout property, so this one cannot use the native driver.
    Animated.timing(progress, { toValue: step, duration: reduced ? 0 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, progress, reduced]);

  const goNext = () => {
    if (!ready) return;
    direction.current = 1;
    if (isLast) onDone();
    else onStepChange(step + 1);
  };
  const goBack = () => {
    direction.current = -1;
    if (step === 0) onExit();
    else onStepChange(step - 1);
  };

  const artSize = wide ? Math.min(560, height * 0.8) : 230;
  const artPosition = wide ? { right: -artSize * 0.12, top: (height - artSize) / 2, opacity: 0.9 } : { right: -70, top: -34, opacity: 0.2 };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={[styles.art, artPosition]}>
        <Enter key={`art-${step}`} offsetX={40} offsetY={0} duration={900}>
          <AmbientArt source={SCENES[sceneIndex].sharp} size={artSize} />
        </Enter>
      </View>

      <View style={[styles.column, wide && styles.columnWide]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.backToStart} onPress={onExit} hitSlop={8}>
            <Logo height={34} />
          </Pressable>
          <LanguageToggle />
        </View>

        <View style={styles.progress}>
          <View style={styles.progressHeader}>
            <AppText variant="label" color={colors.ink}>{t.wizard.stepOf(step + 1, total)}</AppText>
          </View>
          <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step + 1 }}>
            <Animated.View style={[styles.trackFill, { width: progress.interpolate({ inputRange: [0, total - 1], outputRange: [`${100 / total}%`, '100%'] }) }]} />
          </View>
        </View>

        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Enter key={`question-${step}`} offsetX={28 * direction.current} offsetY={0} duration={420}>
            <AppText variant="title" accessibilityRole="header" style={wide ? styles.titleWide : undefined}>{copy.title}</AppText>
            <AppText variant="lead" style={styles.help}>{copy.help}</AppText>
          </Enter>
          <Enter key={`body-${step}`} offsetX={44 * direction.current} offsetY={0} delay={70} duration={460} style={styles.body}>
            {sites.length === 0 ? (
              <View style={styles.sitesStatus}>
                <AppText variant="body">{sitesFailed ? t.wizard.sitesError : sitesLoading ? t.wizard.sitesLoading : t.wizard.sitesEmpty}</AppText>
                {sitesFailed ? <Button label={t.results.retry} variant="ghost" onPress={onRetrySites} /> : null}
              </View>
            ) : (
              <StepBody sites={sites} answers={answers} onChange={onChange} />
            )}
          </Enter>
        </ScrollView>

        <View style={styles.footer}>
          <RoundButton symbol="←" label={step === 0 ? t.backToStart : t.wizard.previousStep} onPress={goBack} size={60} />
          <Button
            label={!ready ? t.wizard.chooseOption : isLast ? t.wizard.seeComparison : t.wizard.next}
            showArrow={ready}
            disabled={!ready}
            onPress={goNext}
            style={styles.nextButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory, overflow: 'hidden' },
  art: { position: 'absolute' },
  column: { flex: 1, width: '100%', paddingHorizontal: 20, paddingTop: 16 },
  columnWide: { maxWidth: 640, marginLeft: '9%', paddingTop: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progress: { marginTop: 16, gap: 8 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(23,26,22,0.14)', overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 22, paddingBottom: 24 },
  titleWide: { fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  help: { marginTop: 6, fontSize: 17, lineHeight: 24 },
  body: { marginTop: 20 },
  sitesStatus: { gap: 14, backgroundColor: colors.sand, borderRadius: 16, padding: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderTopColor: colors.line },
  nextButton: { flex: 1 },
});
