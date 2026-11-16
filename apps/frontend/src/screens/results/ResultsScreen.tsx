import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Priority, Scenario, Site } from '../../api/types';
import { AppText, Button, DemoBadge, Enter, LanguageToggle, Logo, SegmentedControl, isHovered } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { useComparison } from '../../hooks/useComparison';
import { useTranslation } from '../../i18n';
import { USE_NATIVE_DRIVER, WIDE_BREAKPOINT, colors, fonts, isWeb } from '../../theme';
import type { Answers } from '../../types/answers';
import { ComparisonError, ComparisonLoader } from './ComparisonStatus';
import { Disclosure } from './Disclosure';
import { ExplanationCard } from './ExplanationCard';
import { PriorityChangeBanner } from './PriorityChangeBanner';
import { PrioritySwitch } from './PrioritySwitch';
import { ScenarioCard } from './ScenarioCard';
import { analysisThoughts, loadingThoughts } from './thoughts';
import { WeatherView } from './weather/WeatherView';

interface ResultsScreenProps {
  site: Site | null;
  answers: Answers;
  onPriorityChange: (priority: Priority) => void;
  onEdit: () => void;
  onRestart: () => void;
}

type Tab = 'comparison' | 'weather';

/** Frosted-glass effect for the bottom dock (web only; native keeps the translucent fill). */
const glass = isWeb ? ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as object) : null;
/** Room left under the content so the last button is never hidden by the dock. */
const DOCK_CLEARANCE = 28;

/**
 * Order of the cards. On phones the highlighted alternative goes first so it
 * is seen without scrolling; on desktop every rotation keeps its column.
 */
function orderScenarios(scenarios: Scenario[], highlightedId: string | null, wide: boolean): Scenario[] {
  const rank = (scenario: Scenario) => {
    if (wide) return scenario.role === 'current' ? 0 : 1;
    if (scenario.id === highlightedId) return 0;
    return scenario.role === 'alternative' ? 1 : 2;
  };
  return [...scenarios].sort((a, b) => rank(a) - rank(b));
}

/** The comparison and the weather, with the priority switch always at hand. */
export function ResultsScreen({ site, answers, onPriorityChange, onEdit, onRestart }: ResultsScreenProps) {
  const { language, t } = useTranslation();
  const reduced = useReducedMotion();
  const text = t.results;
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [tab, setTab] = useState<Tab>('comparison');
  const tabs = [
    { id: 'comparison', label: text.title },
    { id: 'weather', label: text.weatherTab },
  ] as const;
  const priority = answers.priority ?? 'water';
  const { data, loading, failed, change, reload } = useComparison(answers, priority, language);
  const [showOptions, setShowOptions] = useState(false);
  const [dockHeight, setDockHeight] = useState(150);
  const dockIn = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Bring the explanation into view when the priority change produced one.
  useEffect(() => {
    if (change) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [change]);

  // The dock rises from the bottom edge once the results are on screen.
  const ready = data !== null;
  useEffect(() => {
    if (!ready || reduced) return;
    Animated.sequence([Animated.delay(280), Animated.spring(dockIn, { toValue: 1, speed: 10, bounciness: 9, useNativeDriver: USE_NATIVE_DRIVER })]).start();
  }, [ready, reduced, dockIn]);

  const changeTab = (next: Tab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  if (!data) {
    return (
      <View style={styles.root}>
        {failed ? <ComparisonError onRetry={reload} /> : <ComparisonLoader thoughts={loadingThoughts({ t, answers, site, priority, data: null })} />}
      </View>
    );
  }

  const highlightedId = data.highlight?.scenarioId ?? null;
  const scenarios = orderScenarios(data.scenarios, highlightedId, wide);
  const soilIsIncomplete = answers.texture === 'unknown' || answers.drainage === 'unknown';
  const tabBar = <SegmentedControl options={tabs} value={tab} onChange={changeTab} accessibilityLabel={text.title} />;
  // Content enters from the side of the tab that was chosen.
  const slide = tab === 'weather' ? 44 : -44;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, wide ? styles.scrollWide : { paddingBottom: dockHeight + DOCK_CLEARANCE }]}
        showsVerticalScrollIndicator={wide}
      >
        <Enter offsetY={-12} style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.backToStart} onPress={onRestart} hitSlop={8}>
            <Logo height={wide ? 40 : 34} />
          </Pressable>
          {wide ? tabBar : null}
          <LanguageToggle />
        </Enter>

        <Enter key={`title-${tab}`} offsetX={slide * 0.5} offsetY={0} duration={420} style={{ marginTop: wide ? 28 : 18 }}>
          {data.isDemo ? <DemoBadge style={styles.demoBadge} /> : null}
          <AppText variant="title" accessibilityRole="header" style={wide ? styles.titleWide : undefined}>
            {tab === 'comparison' ? text.title : text.weatherTab}
          </AppText>
          <View style={styles.answers}>
            <View style={styles.answersText}>
              <AppText variant="body" style={styles.answersMain}>
                {site?.department || site?.name || text.area} · {text.currentCrop(answers.crop ? t.crop[answers.crop].inline : '')}
              </AppText>
              <AppText variant="small">{text.soilSummary(t.texture[answers.texture].inline, t.drainage[answers.drainage].inline)}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.changeAnswers}
              onPress={onEdit}
              hitSlop={8}
              style={(state) => [styles.editButton, isHovered(state) && styles.editHovered, state.pressed && styles.pressed]}
            >
              <Text style={styles.editText}>{text.change}</Text>
            </Pressable>
          </View>
          {tab === 'comparison' && soilIsIncomplete && showOptions ? (
            <View style={styles.note}>
              <AppText variant="small" color={colors.ink}>{text.missingSoil}</AppText>
            </View>
          ) : null}
        </Enter>

        <Enter key={`body-${tab}`} offsetX={reduced ? 0 : slide} offsetY={0} duration={460}>
          {tab === 'comparison' ? (
            <>
              {wide ? (
                <Enter delay={80} style={styles.switchWide}>
                  <AppText variant="label" color={colors.ink}>{text.priorityQuestion}</AppText>
                  <PrioritySwitch value={priority} onChange={onPriorityChange} busy={loading} />
                </Enter>
              ) : null}

              <PriorityChangeBanner change={change} data={data} priority={priority} />

              {data.explanation ? (
                <Enter delay={60} offsetY={20} style={styles.explanation}>
                  <ExplanationCard explanation={data.explanation} thinking={loading} thoughts={analysisThoughts({ t, answers, site, priority, data })} />
                </Enter>
              ) : null}

              <Enter delay={220} offsetY={16}>
                <Disclosure label={showOptions ? text.hideDetails : text.otherOptions} expanded={showOptions} onToggle={() => setShowOptions(!showOptions)} />
              </Enter>
              {showOptions ? (
                <View style={[wide ? styles.cardsWide : styles.cards, loading && styles.refreshing]}>
                  {scenarios.map((scenario, position) => {
                    const highlighted = scenario.id === highlightedId;
                    return (
                      <Enter key={`${scenario.id}-${highlighted ? 'on' : 'off'}-${priority}`} delay={60 + position * 110} offsetY={26} style={wide ? styles.cardColumn : undefined}>
                        <ScenarioCard scenario={scenario} sources={data.sources} priority={priority} highlighted={highlighted} />
                      </Enter>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : site ? (
            <WeatherView site={site} climate={data.climate} sources={data.sources} wide={wide} />
          ) : null}
        </Enter>

        <View style={styles.footer}>
          {data.warnings.map((warning) => (
            <AppText key={warning} variant="small">• {warning}</AppText>
          ))}
          <AppText variant="small" style={styles.disclaimer}>{text.disclaimer(data.methodVersion)}</AppText>
          <Button label={text.startOver} variant="ghost" onPress={onRestart} style={[styles.startOver, { alignSelf: wide ? 'flex-start' : 'stretch' }]} />
        </View>
      </ScrollView>

      {/* On phones the switch and the tabs stay at the bottom, within reach of the thumb. */}
      {!wide ? (
        <Animated.View
          onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
          style={[
            styles.dock,
            glass,
            {
              opacity: dockIn.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ translateY: dockIn.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) }],
            },
          ]}
        >
          {tab === 'comparison' ? (
            <Enter offsetY={14} duration={360}>
              <PrioritySwitch value={priority} onChange={onPriorityChange} busy={loading} />
            </Enter>
          ) : null}
          {tabBar}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  scroll: { paddingHorizontal: 16, paddingTop: 16, width: '100%' },
  scrollWide: { maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 40, paddingTop: 32, paddingBottom: 64 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  demoBadge: { marginBottom: 10 },
  titleWide: { fontSize: 48, lineHeight: 52, letterSpacing: -1.2 },
  answers: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  answersText: { flex: 1 },
  answersMain: { fontFamily: fonts.semiBold },
  editButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  editHovered: { backgroundColor: colors.sand },
  editText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  pressed: { opacity: 0.6 },
  note: { marginTop: 12, backgroundColor: colors.sand, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  switchWide: { marginTop: 24, gap: 10, maxWidth: 560 },
  cards: { marginTop: 16, gap: 14 },
  cardsWide: { marginTop: 24, flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  cardColumn: { flex: 1 },
  refreshing: { opacity: 0.45 },
  explanation: { marginTop: 16 },
  footer: { marginTop: 24, gap: 4 },
  disclaimer: { marginTop: 6 },
  startOver: { marginTop: 14 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 10, backgroundColor: 'rgba(247,243,232,0.94)', borderTopWidth: 1, borderTopColor: colors.line },
});
