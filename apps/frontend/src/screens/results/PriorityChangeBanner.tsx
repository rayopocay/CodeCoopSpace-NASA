import { StyleSheet, Text, View } from 'react-native';

import type { CompareResponse, Priority } from '../../api/types';
import { Enter } from '../../components/ui';
import type { PriorityChange } from '../../hooks/useComparison';
import { useTranslation } from '../../i18n';
import { colors, fonts } from '../../theme';
import { formatSequence } from './formatSequence';

interface PriorityChangeBannerProps {
  change: PriorityChange | null;
  data: CompareResponse;
  priority: Priority;
}

/**
 * Explains what happened after the farmer changed the priority: which rotation
 * stands out now, which one did before, and that only the weights changed.
 * The text is built at render time so it follows the current language.
 */
export function PriorityChangeBanner({ change, data, priority }: PriorityChangeBannerProps) {
  const { t } = useTranslation();
  // Only show it while it still describes what is on screen.
  if (!change || change.previousPriority === priority || change.currentScenarioId !== data.highlight?.scenarioId) return null;
  const current = data.scenarios.find((scenario) => scenario.id === change.currentScenarioId);
  if (!current) return null;
  const previous = data.scenarios.find((scenario) => scenario.id === change.previousScenarioId);

  const goal = t.priority[priority].goal;
  const reason = data.highlight?.reason ?? '';
  const title = previous ? t.results.highlightMoved(formatSequence(current, t)) : t.results.highlightKept(formatSequence(current, t));
  const text = previous
    ? t.results.highlightMovedText(t.priority[change.previousPriority].goal, formatSequence(previous, t), goal, reason)
    : t.results.highlightKeptText(goal, reason);

  return (
    <Enter key={`${change.currentScenarioId}-${priority}`} offsetY={-12} duration={460} style={styles.banner}>
      <View accessibilityLiveRegion="polite" style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </Enter>
  );
}

const styles = StyleSheet.create({
  banner: { marginTop: 16, backgroundColor: colors.sand, borderRadius: 20, padding: 16 },
  content: { gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.ink },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
});
