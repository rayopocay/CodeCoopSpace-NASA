import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import type { Explanation } from '../../api/types';
import { AppText, Enter, ThinkingDots } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { useLoopAnimation } from '../../hooks/useLoopAnimation';
import { useTranslation } from '../../i18n';
import { colors, fonts, images, isWeb } from '../../theme';
import { interpolate } from '../../utils/animation';

interface ExplanationCardProps {
  explanation: Explanation;
  /** true while a new comparison is on its way (for example, after changing the priority). */
  thinking: boolean;
  /** What Yago is going through, one line at a time, built from the data of this query. */
  thoughts: string[];
}

const PARTS = ['consider', 'influence', 'caution', 'verify'] as const;
/** Short pause before the text starts, so the change reads as "thinking, then writing". */
const THINK_MS = 1100;
const WORD_MS = 38;
/** Each thought stays this long on screen. */
const THOUGHT_MS = 1700;

/** Writes `text` word by word, like an answer being typed. Shows it whole with reduced motion. */
function useTypewriter(text: string, start: boolean): string {
  const reduced = useReducedMotion();
  const words = text.split(' ');
  const [count, setCount] = useState(reduced ? words.length : 0);

  useEffect(() => {
    if (reduced) {
      setCount(words.length);
      return;
    }
    setCount(0);
    if (!start) return;
    const timer = setInterval(() => {
      setCount((current) => {
        if (current >= words.length) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, WORD_MS);
    return () => clearInterval(timer);
  }, [text, start, reduced]);

  return words.slice(0, count).join(' ');
}

/** Small Yago mark that breathes while the answer is being prepared. */
function ThinkingMark({ active }: { active: boolean }) {
  const pulse = useLoopAnimation(700);
  return (
    <Animated.View style={{ transform: [{ scale: active ? interpolate(pulse, [0, 1], [0.9, 1.12]) : 1 }], opacity: active ? interpolate(pulse, [0, 1], [0.6, 1]) : 1 }}>
      <Image source={images.symbol} style={styles.mark} resizeMode="contain" />
    </Animated.View>
  );
}

/** Soft, low shadow on the web; a light elevation on native. */
const elevation = isWeb
  ? ({ boxShadow: '0 1px 2px rgba(23,26,22,0.04), 0 10px 28px rgba(23,26,22,0.07)' } as object)
  : { elevation: 2 };

/** A thin line that runs along the top edge while Yago is working. */
function ProgressLine() {
  const reduced = useReducedMotion();
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    // JS driver: it moves a percentage position.
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [sweep, reduced]);
  return (
    <View pointerEvents="none" style={styles.progressTrack}>
      <Animated.View style={[styles.progressBar, { left: reduced ? '31%' : sweep.interpolate({ inputRange: [0, 1], outputRange: ['-38%', '100%'] }) }]} />
    </View>
  );
}

/** Grey bars that shimmer in place of the text that is still coming. */
function SkeletonLines() {
  const shimmer = useLoopAnimation(650);
  return (
    <View style={styles.skeleton}>
      {[0.92, 0.78, 0.86, 0.5].map((width, line) => (
        <Animated.View key={line} style={[styles.skeletonLine, { width: `${width * 100}%`, opacity: interpolate(shimmer, [0, 1], line % 2 ? [0.55, 0.25] : [0.25, 0.55]) }]} />
      ))}
    </View>
  );
}

/**
 * Plain-language explanation of the calculated comparison: what is worth
 * considering, what weighed most, the main caution and what to confirm before
 * sowing. It "thinks" for a moment, then writes the answer, and always says
 * whether an AI model or the rules wrote the wording.
 */
export function ExplanationCard({ explanation, thinking, thoughts }: ExplanationCardProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const text = t.results;
  const byAi = explanation.source === 'groq';
  // Every new answer starts with a short "thinking" moment before it is written.
  const [readyFor, setReadyFor] = useState<string | null>(reduced ? explanation.consider : null);
  const warmingUp = readyFor !== explanation.consider;
  const showThinking = thinking || warmingUp;
  const lead = useTypewriter(explanation.consider, !showThinking);

  useEffect(() => {
    if (reduced) {
      setReadyFor(explanation.consider);
      return;
    }
    const timer = setTimeout(() => setReadyFor(explanation.consider), THINK_MS);
    return () => clearTimeout(timer);
  }, [explanation.consider, reduced]);

  // While thinking, the thoughts go by one after the other; the last one stays.
  const [thought, setThought] = useState(0);
  useEffect(() => {
    if (!showThinking) return;
    setThought(0);
    const timer = setInterval(() => setThought((current) => Math.min(current + 1, thoughts.length - 1)), THOUGHT_MS);
    return () => clearInterval(timer);
  }, [showThinking, thoughts.length]);

  return (
    <View style={[styles.card, elevation]}>
      {showThinking ? <ProgressLine /> : null}

      <View style={styles.heading}>
        <View style={styles.headingTitle}>
          <View style={styles.markWell}>
            <ThinkingMark active={showThinking} />
          </View>
          <AppText variant="label" color={colors.ink}>{text.explanationTitle}</AppText>
        </View>
        <View style={[styles.chip, byAi && styles.chipAi]}>
          {byAi ? <View style={styles.chipDot} /> : null}
          <Text style={[styles.chipText, byAi && { color: colors.ivory }]}>{byAi ? text.explanationAiChip : text.explanationRulesChip}</Text>
        </View>
      </View>

      {showThinking ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ThinkingDots color={colors.ink} size={6} />
          <Enter key={thought} offsetY={8} duration={360} style={styles.thoughtBox}>
            <Text style={styles.thinkingText}>{thoughts[thought] ?? text.thinking}</Text>
          </Enter>
        </View>
      ) : null}

      {showThinking && warmingUp && !thinking ? (
        <SkeletonLines />
      ) : (
        <View style={[styles.parts, thinking && styles.stale]}>
          {PARTS.map((part, position) => (
            <Enter key={`${part}-${explanation[part]}`} delay={part === 'consider' ? 0 : 260 + position * 170} offsetY={12} duration={460}>
              <View style={[styles.part, position > 0 && styles.partDivided]}>
                <Text style={styles.partLabel}>{text.explanationLabels[part]}</Text>
                {part === 'consider' ? (
                  <Text style={styles.lead} accessibilityLabel={explanation.consider}>
                    {thinking ? explanation.consider : lead}
                    {!thinking && lead.length < explanation.consider.length ? <Text style={styles.caret}>▍</Text> : null}
                  </Text>
                ) : (
                  <Text style={styles.body}>{explanation[part]}</Text>
                )}
              </View>
            </Enter>
          ))}
          <Text style={styles.footnote}>
            {byAi
              ? text.explanationByAi(explanation.model ?? 'Groq')
              : `${text.explanationByRules}${explanation.fallbackReason ? ` ${text.explanationFallback[explanation.fallbackReason]}` : ''}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 16, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(23,26,22,0.06)' },
  progressBar: { position: 'absolute', top: 0, bottom: 0, width: '38%', borderRadius: 2, backgroundColor: colors.ink },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  headingTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markWell: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 24, height: 23 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  chipAi: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.maize },
  chipText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.ivory },
  thoughtBox: { flexShrink: 1 },
  thinkingText: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 21, color: colors.ink },
  skeleton: { gap: 12, paddingVertical: 4 },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: colors.sand },
  parts: { gap: 16 },
  stale: { opacity: 0.4 },
  part: { gap: 4 },
  // A hairline separates the parts instead of coloured edges.
  partDivided: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
  partLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase', color: colors.inkFaint },
  lead: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 30, color: colors.ink, letterSpacing: -0.2 },
  caret: { color: colors.inkFaint },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.ink },
  footnote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkFaint },
});
