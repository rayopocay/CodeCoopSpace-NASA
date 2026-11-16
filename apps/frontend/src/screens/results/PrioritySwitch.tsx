import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Priority } from '../../api/types';
import { Icon, isHovered } from '../../components/ui';
import { PRIORITIES, PRIORITY_ICON } from '../../constants/domain';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { useTranslation } from '../../i18n';
import { USE_NATIVE_DRIVER, colors, fonts } from '../../theme';

interface PrioritySwitchProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  /** true while the comparison is being refreshed. */
  busy: boolean;
}

const GAP = 8;

/**
 * Three large buttons to change what matters most without leaving the results.
 * A dark pill slides to the chosen one and its icon gives a small hop.
 */
export function PrioritySwitch({ value, onChange, busy }: PrioritySwitchProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const index = PRIORITIES.indexOf(value);
  const slot = (rowWidth - GAP * (PRIORITIES.length - 1)) / PRIORITIES.length;
  const position = useRef(new Animated.Value(index)).current;
  const hop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      position.setValue(index);
      return;
    }
    Animated.spring(position, { toValue: index, speed: 14, bounciness: 8, useNativeDriver: USE_NATIVE_DRIVER }).start();
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 160, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(hop, { toValue: 0, speed: 12, bounciness: 14, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [index, position, hop, reduced]);

  return (
    <View
      style={styles.row}
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.results.priorityQuestion}
    >
      {rowWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: slot,
              transform: [{ translateX: position.interpolate({ inputRange: [0, PRIORITIES.length - 1], outputRange: [0, (slot + GAP) * (PRIORITIES.length - 1)] }) }],
            },
          ]}
        />
      ) : null}
      {PRIORITIES.map((priority) => {
        const selected = priority === value;
        return (
          <Pressable
            key={priority}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected, busy }}
            accessibilityLabel={t.priority[priority].name}
            onPress={() => !selected && onChange(priority)}
            style={(state) => [styles.button, selected && styles.buttonSelected, !selected && isHovered(state) && styles.hovered, state.pressed && styles.pressed]}
          >
            <Animated.View style={selected ? { transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { rotate: hop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] }) }] } : null}>
              <Icon name={PRIORITY_ICON[priority]} size={32} />
            </Animated.View>
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {t.priority[priority].short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 28, backgroundColor: colors.ink },
  button: { flex: 1, minHeight: 54, borderRadius: 28, borderWidth: 2, borderColor: colors.ink, backgroundColor: 'rgba(255,253,247,0.7)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 6 },
  // The sliding pill paints the chosen button; the button itself stays transparent.
  buttonSelected: { backgroundColor: 'transparent' },
  hovered: { backgroundColor: colors.sand },
  pressed: { opacity: 0.7 },
  text: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  textSelected: { color: colors.ivory },
});
