import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Enter, Icon, isHovered } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { USE_NATIVE_DRIVER, colors, fonts } from '../../theme';
import type { IconName } from '../../theme';

interface ChoiceCardProps {
  title: string;
  hint?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  /** Half-width card for two-column grids. */
  compact?: boolean;
  /** Position in its list: cards come in one after the other. */
  index?: number;
}

/**
 * Large radio option: the whole card is the touch target. Cards arrive one
 * after the other; choosing one fills it with ink, makes it hop and draws the
 * check mark.
 */
export function ChoiceCard({ title, hint, icon, selected, onPress, compact = false, index = 0 }: ChoiceCardProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  // JS driver: it animates colours.
  const fill = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const check = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const iconHop = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  // Clamped: the card never grows past its own size, so the list never cuts it at the sides.
  const springTo = (toValue: number) => Animated.spring(scale, { toValue, speed: 40, bounciness: 5, overshootClamping: true, useNativeDriver: USE_NATIVE_DRIVER }).start();

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      fill.setValue(selected ? 1 : 0);
      check.setValue(selected ? 1 : 0);
      return;
    }
    Animated.timing(fill, { toValue: selected ? 1 : 0, duration: 240, useNativeDriver: false }).start();
    Animated.spring(check, { toValue: selected ? 1 : 0, speed: 14, bounciness: 14, useNativeDriver: USE_NATIVE_DRIVER }).start();
    if (selected) {
      // It dips and springs back to its size; growing past it would be cut at the sides of the list.
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.965, duration: 110, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(scale, { toValue: 1, speed: 16, bounciness: 10, overshootClamping: true, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      iconHop.setValue(0);
      Animated.sequence([
        Animated.timing(iconHop, { toValue: 1, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(iconHop, { toValue: 0, speed: 12, bounciness: 16, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [selected, reduced, fill, check, scale, iconHop]);

  return (
    <Enter delay={90 + Math.min(index, 8) * 60} offsetY={18} duration={480} style={compact ? styles.compactWrapper : undefined}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected, checked: selected }}
          accessibilityLabel={hint ? `${title}. ${hint}` : title}
          onPress={onPress}
          onPressIn={() => springTo(0.97)}
          onPressOut={() => springTo(1)}
          style={[styles.card, compact && styles.cardCompact]}
        >
          {(state) => (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.surface,
                  {
                    backgroundColor: fill.interpolate({ inputRange: [0, 1], outputRange: [isHovered(state) ? colors.sand : colors.paper, colors.ink] }),
                    borderColor: fill.interpolate({ inputRange: [0, 1], outputRange: [isHovered(state) ? 'rgba(23,26,22,0.32)' : colors.line, colors.ink] }),
                  },
                ]}
              />
              {icon ? (
                <Animated.View style={{ transform: [{ translateY: iconHop.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }, { rotate: iconHop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-9deg'] }) }] }}>
                  <Icon name={icon} size={54} />
                </Animated.View>
              ) : null}
              <View style={styles.text}>
                <Text style={[styles.title, compact && styles.titleCompact, selected && styles.titleSelected]}>{title}</Text>
                {hint ? <Text style={[styles.hint, selected && styles.hintSelected]}>{hint}</Text> : null}
              </View>
              <View style={[styles.radio, compact && styles.radioCorner, selected && styles.radioSelected]}>
                <Animated.Text style={[styles.check, { opacity: check, transform: [{ scale: check }] }]}>✓</Animated.Text>
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </Enter>
  );
}

const styles = StyleSheet.create({
  compactWrapper: { flexGrow: 1, flexBasis: '46%' },
  card: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22 },
  cardCompact: { minHeight: 104, alignItems: 'flex-start' },
  surface: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 22, borderWidth: 2 },
  text: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, color: colors.ink },
  // Leaves room for the radio mark pinned to the corner.
  titleCompact: { paddingRight: 30 },
  titleSelected: { color: colors.ivory },
  hint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.inkSoft, marginTop: 1 },
  hintSelected: { color: colors.ivorySoft },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(23,26,22,0.4)', alignItems: 'center', justifyContent: 'center' },
  radioCorner: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12 },
  radioSelected: { backgroundColor: colors.maize, borderColor: colors.maize },
  check: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 18, color: colors.ink },
});
