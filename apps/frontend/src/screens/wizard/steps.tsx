import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Site } from '../../api/types';
import { AppText } from '../../components/ui';
import { CROPS, CROP_ICON, PRIORITIES, PRIORITY_ICON, SOIL_DRAINAGES, SOIL_TEXTURES } from '../../constants/domain';
import { useTranslation } from '../../i18n';
import { colors } from '../../theme';
import type { Answers } from '../../types/answers';
import { ChoiceCard } from './ChoiceCard';

export interface StepProps {
  sites: Site[];
  answers: Answers;
  onChange: (patch: Partial<Answers>) => void;
}

function SiteStep({ sites, answers, onChange }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {sites.map((site, index) => (
        <ChoiceCard
          key={site.id}
          index={index}
          icon="location"
          title={site.department || site.name}
          hint={site.department ? t.wizard.climateReference(site.name) : undefined}
          selected={answers.siteId === site.id}
          onPress={() => onChange({ siteId: site.id })}
        />
      ))}
      <View style={styles.note}>
        <AppText variant="small">{t.wizard.siteScaleNote}</AppText>
      </View>
    </View>
  );
}

function CropStep({ sites, answers, onChange }: StepProps) {
  const { t } = useTranslation();
  // Only the crops the chosen site supports.
  const crops = sites.find((site) => site.id === answers.siteId)?.crops ?? CROPS;
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {crops.map((crop, index) => (
        <ChoiceCard key={crop} index={index} icon={CROP_ICON[crop]} title={t.crop[crop].name} hint={t.crop[crop].hint} selected={answers.crop === crop} onPress={() => onChange({ crop })} />
      ))}
    </View>
  );
}

/** Soil is optional knowledge: "Not sure" is preselected in both questions. */
function SoilStep({ answers, onChange }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.groups}>
      <View style={styles.group}>
        <AppText variant="label">{t.wizard.textureQuestion}</AppText>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {SOIL_TEXTURES.map((texture, index) => (
            <ChoiceCard key={texture} index={index} compact title={t.texture[texture].name} hint={t.texture[texture].hint} selected={answers.texture === texture} onPress={() => onChange({ texture })} />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label">{t.wizard.drainageQuestion}</AppText>
        <View style={styles.list} accessibilityRole="radiogroup">
          {SOIL_DRAINAGES.map((drainage, index) => (
            <ChoiceCard key={drainage} index={index + SOIL_TEXTURES.length} title={t.drainage[drainage].name} hint={t.drainage[drainage].hint} selected={answers.drainage === drainage} onPress={() => onChange({ drainage })} />
          ))}
        </View>
      </View>
    </View>
  );
}

function PriorityStep({ answers, onChange }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {PRIORITIES.map((priority, index) => (
        <ChoiceCard
          key={priority}
          index={index}
          icon={PRIORITY_ICON[priority]}
          title={t.priority[priority].name}
          hint={t.priority[priority].hint}
          selected={answers.priority === priority}
          onPress={() => onChange({ priority })}
        />
      ))}
    </View>
  );
}

export interface WizardStep {
  /** Body of the step. Titles and help text come from `t.wizard.steps`, in the same order. */
  Component: ComponentType<StepProps>;
  /** Whether the farmer can move on. */
  isComplete: (answers: Answers) => boolean;
  /** Index in `SCENES` of the background art. */
  sceneIndex: number;
}

/** The wizard is this list: add, remove or reorder steps here. */
export const WIZARD_STEPS: WizardStep[] = [
  { Component: SiteStep, isComplete: (answers) => answers.siteId !== null, sceneIndex: 0 },
  { Component: CropStep, isComplete: (answers) => answers.crop !== null, sceneIndex: 1 },
  { Component: SoilStep, isComplete: () => true, sceneIndex: 5 },
  { Component: PriorityStep, isComplete: (answers) => answers.priority !== null, sceneIndex: 3 },
];

const styles = StyleSheet.create({
  list: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  groups: { gap: 22 },
  group: { gap: 10 },
  note: { backgroundColor: colors.sand, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 6 },
});
