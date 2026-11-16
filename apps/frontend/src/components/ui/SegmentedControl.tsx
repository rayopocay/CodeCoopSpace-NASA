import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { useReducedMotion } from '../../context/ReducedMotionContext';
import { colors, fonts } from '../../theme';
import { isHovered } from './hover';

interface SegmentedControlProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill-shaped tabs. The dark pill slides under the chosen option, so the
 * change of view is felt before the content moves.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, style }: SegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<T, { x: number; width: number }>>>({});
  // JS driver: the pill width is a layout property.
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const target = layouts[value];

  useEffect(() => {
    if (!target) return;
    if (!placed.current || reduced) {
      left.setValue(target.x);
      width.setValue(target.width);
      placed.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(left, { toValue: target.x, speed: 16, bounciness: 7, useNativeDriver: false }),
      Animated.spring(width, { toValue: target.width, speed: 16, bounciness: 7, useNativeDriver: false }),
    ]).start();
  }, [target, left, width, reduced]);

  const measure = (id: T) => (event: LayoutChangeEvent) => {
    const { x, width: optionWidth } = event.nativeEvent.layout;
    setLayouts((current) => (current[id]?.x === x && current[id]?.width === optionWidth ? current : { ...current, [id]: { x, width: optionWidth } }));
  };

  return (
    <View style={[styles.track, style]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {target ? <Animated.View pointerEvents="none" style={[styles.pill, { left, width }]} /> : null}
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            onLayout={measure(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => !selected && onChange(option.id)}
            style={(state) => [styles.option, !selected && isHovered(state) && styles.hovered, state.pressed && styles.pressed]}
          >
            <Text style={[styles.label, { color: selected ? colors.ivory : colors.ink }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'center', padding: 4, borderRadius: 26, backgroundColor: 'rgba(23,26,22,0.07)', borderWidth: 1, borderColor: colors.line },
  pill: { position: 'absolute', top: 4, bottom: 4, borderRadius: 22, backgroundColor: colors.ink },
  option: { minHeight: 42, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hovered: { backgroundColor: 'rgba(23,26,22,0.08)' },
  pressed: { opacity: 0.75 },
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
});
