import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { useReducedMotion } from '../context/ReducedMotionContext';
import { useSites } from '../hooks/useSites';
import { useTranslation } from '../i18n';
import { ResultsScreen } from '../screens/results/ResultsScreen';
import { WelcomeScreen } from '../screens/welcome/WelcomeScreen';
import { WizardScreen } from '../screens/wizard/WizardScreen';
import { USE_NATIVE_DRIVER } from '../theme';
import { EMPTY_ANSWERS } from '../types/answers';
import type { Answers } from '../types/answers';

type ScreenName = 'welcome' | 'wizard' | 'results';

/** Wizard step to return to when the farmer edits answers from the results: the first question. */
const EDIT_STEP = 0;

/**
 * The whole app is three screens in a row, so a small state machine with a
 * cross-fade is enough. It owns the farmer's answers and hands each screen
 * only what it needs. There are no accounts, profiles or sessions.
 */
export function RootNavigator() {
  const reduced = useReducedMotion();
  const { language } = useTranslation();
  const { sites, loading: sitesLoading, failed: sitesFailed, reload: reloadSites } = useSites(language);
  const [screen, setScreen] = useState<ScreenName>('welcome');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const opacity = useRef(new Animated.Value(1)).current;

  // With a single site there is nothing to choose: preselect it to save a tap.
  const onlySiteId = sites.length === 1 ? sites[0].id : null;
  useEffect(() => {
    if (onlySiteId) setAnswers((current) => (current.siteId ? current : { ...current, siteId: onlySiteId }));
  }, [onlySiteId]);

  /** Fades out, runs `beforeEnter` while nothing is visible, then fades the next screen in. */
  const navigate = useCallback(
    (next: ScreenName, beforeEnter?: () => void) => {
      Animated.timing(opacity, { toValue: 0, duration: reduced ? 80 : 240, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }).start(() => {
        beforeEnter?.();
        setScreen(next);
        Animated.timing(opacity, { toValue: 1, duration: reduced ? 80 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
      });
    },
    [opacity, reduced],
  );

  const updateAnswers = useCallback((patch: Partial<Answers>) => setAnswers((current) => ({ ...current, ...patch })), []);
  const restart = useCallback(
    () =>
      navigate('welcome', () => {
        setAnswers({ ...EMPTY_ANSWERS, siteId: onlySiteId });
        setStep(0);
      }),
    [navigate, onlySiteId],
  );

  const site = sites.find((item) => item.id === answers.siteId) ?? null;

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity,
        transform: [
          { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 18, 0] }) },
          { scale: opacity.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.975, 1] }) },
        ],
      }}
    >
      {screen === 'welcome' ? <WelcomeScreen onStart={() => navigate('wizard', () => setStep(0))} /> : null}
      {screen === 'wizard' ? (
        <WizardScreen
          sites={sites}
          sitesLoading={sitesLoading}
          sitesFailed={sitesFailed}
          onRetrySites={reloadSites}
          answers={answers}
          onChange={updateAnswers}
          step={step}
          onStepChange={setStep}
          onExit={() => navigate('welcome')}
          onDone={() => navigate('results')}
        />
      ) : null}
      {screen === 'results' ? (
        <ResultsScreen
          site={site}
          answers={answers}
          onPriorityChange={(priority) => updateAnswers({ priority })}
          onEdit={() => navigate('wizard', () => setStep(EDIT_STEP))}
          onRestart={restart}
        />
      ) : null}
    </Animated.View>
  );
}
