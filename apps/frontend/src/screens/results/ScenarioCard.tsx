import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Priority, Scenario, Source } from '../../api/types';
import { Enter, Grain, Icon } from '../../components/ui';
import { CROP_ICON } from '../../constants/domain';
import { useTranslation } from '../../i18n';
import { colors, fonts } from '../../theme';
import { LevelPill } from './LevelPill';
import { SourceKindChip } from './SourceKindChip';
import { SourceRow } from './SourceRow';
import { formatSequence } from './formatSequence';

interface ScenarioCardProps {
  scenario: Scenario;
  /** Every source of the response; the card shows the ones this scenario cites. */
  sources: Source[];
  /** The priority the farmer put first. */
  priority: Priority;
  /** The highlighted alternative is drawn as a dark card. */
  highlighted: boolean;
}

/**
 * One rotation: sequence, short explanation, level per criterion, one
 * limitation and where the data comes from. Reasons and sources are one tap away.
 */
export function ScenarioCard({ scenario, sources, priority, highlighted }: ScenarioCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const onDark = highlighted;
  const foreground = onDark ? colors.ivory : colors.ink;
  const soft = onDark ? colors.ivorySoft : colors.inkSoft;
  const divider = onDark ? colors.ivoryLine : colors.line;
  const cited = sources.filter((source) => scenario.sourceIds.includes(source.id));
  const tag = highlighted ? t.results.tagBestFit(t.priority[priority].goal) : scenario.role === 'current' ? t.results.tagCurrent : t.results.tagOther;

  return (
    <View style={[styles.card, onDark && styles.cardDark]}>
      {onDark ? <Grain light opacity={0.1} /> : null}

      <View style={[styles.tag, highlighted ? styles.tagHighlighted : styles.tagPlain]}>
        <Text style={styles.tagText}>{tag}</Text>
      </View>

      <View style={styles.sequence} accessibilityLabel={t.results.rotation(formatSequence(scenario, t))}>
        {scenario.sequence.map((crop, position) => (
          <Fragment key={`${crop}-${position}`}>
            {position > 0 ? <Text style={[styles.sequenceArrow, { color: onDark ? colors.maize : colors.inkFaint }]}>→</Text> : null}
            <View style={styles.sequenceItem}>
              <Icon name={CROP_ICON[crop]} size={38} />
              <Text style={[styles.sequenceText, { color: foreground }]}>{t.crop[crop].name}</Text>
            </View>
          </Fragment>
        ))}
      </View>

      {scenario.summary ? <Text style={[styles.summary, { color: foreground }]}>{scenario.summary}</Text> : null}

      <View style={styles.pills}>
        {scenario.criteria.map((criterion) => (
          <LevelPill key={criterion.priority} criterion={criterion} onDark={onDark} isTopPriority={criterion.priority === priority} />
        ))}
      </View>

      {scenario.limitation || scenario.missingData ? (
        <View style={[styles.limitation, { backgroundColor: onDark ? 'rgba(247,243,232,0.08)' : colors.sand }]}>
          <Text style={[styles.sectionLabel, { color: soft }]}>{t.results.watchOut}</Text>
          {scenario.limitation ? <Text style={[styles.limitationText, { color: foreground }]}>{scenario.limitation}</Text> : null}
          {scenario.missingData ? <Text style={[styles.missingData, { color: soft }]}>{scenario.missingData}</Text> : null}
        </View>
      ) : null}

      <View style={styles.chips}>
        {cited.map((source) => (
          <SourceKindChip key={source.id} kind={source.kind} onDark={onDark} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? t.results.hideDetailsLabel : t.results.showDetails}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.toggle, { borderColor: divider }, pressed && styles.pressed]}
      >
        <Text style={[styles.toggleText, { color: foreground }]}>{expanded ? t.results.hideDetails : t.results.showDetails}</Text>
        <Text style={[styles.toggleSign, { color: foreground }]}>{expanded ? '−' : '+'}</Text>
      </Pressable>

      {expanded ? (
        <Enter offsetY={10} duration={320} style={styles.details}>
          {scenario.criteria.map((criterion) => (
            <View key={criterion.priority} style={styles.reason}>
              <Text style={[styles.reasonTitle, { color: foreground }]}>
                {t.priority[criterion.priority].short}: {t.level[criterion.level ?? 'undetermined'].toLowerCase()}
              </Text>
              <Text style={[styles.reasonText, { color: soft }]}>{criterion.reason}</Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: divider }]} />
          <Text style={[styles.sectionLabel, { color: soft }]}>{t.results.whereFrom}</Text>
          {cited.map((source) => (
            <SourceRow key={source.id} source={source} onDark={onDark} />
          ))}
        </Enter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 26, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  cardDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagHighlighted: { backgroundColor: colors.maize },
  tagPlain: { borderWidth: 1, borderColor: colors.line },
  tagText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: colors.ink },
  sequence: { flexDirection: 'row', alignItems: 'center', columnGap: 7, rowGap: 6, flexWrap: 'wrap' },
  sequenceItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sequenceText: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, letterSpacing: -0.4 },
  sequenceArrow: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 28 },
  summary: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25 },
  pills: { flexDirection: 'row', gap: 8 },
  limitation: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase' },
  limitationText: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 23 },
  missingData: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { minHeight: 52, borderRadius: 26, borderWidth: 2, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  toggleSign: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.6 },
  details: { gap: 16, marginTop: 4 },
  reason: { gap: 2 },
  reasonTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  reasonText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  divider: { height: 1 },
});
