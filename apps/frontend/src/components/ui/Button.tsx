import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useReducedMotion } from '../../context/ReducedMotionContext';
import { USE_NATIVE_DRIVER, colors, fonts } from '../../theme';
import { isHovered } from './hover';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  /** Shows a round arrow badge after the label. */
  showArrow?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Large button, easy to hit with the thumb (60 px tall). */
export function Button({ label, onPress, variant = 'primary', disabled = false, showArrow = false, style }: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue: number) => Animated.spring(scale, { toValue, speed: 40, bounciness: 6, useNativeDriver: USE_NATIVE_DRIVER }).start();
  const primary = variant === 'primary';
  const reduced = useReducedMotion();
  const wasDisabled = useRef(disabled);

  // When the button becomes available it gives a small hop, so the next step is noticed.
  useEffect(() => {
    if (wasDisabled.current && !disabled && !reduced) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.045, duration: 140, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(scale, { toValue: 1, speed: 14, bounciness: 14, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
    wasDisabled.current = disabled;
  }, [disabled, reduced, scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
        style={(state) => [
          styles.base,
          primary ? styles.primary : styles.ghost,
          !disabled && isHovered(state) && (primary ? styles.primaryHovered : styles.ghostHovered),
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.label, { color: primary ? colors.ivory : colors.ink }]} numberOfLines={1}>
          {label}
        </Text>
        {showArrow ? (
          <View style={styles.arrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 60, borderRadius: 30, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primary: { backgroundColor: colors.ink },
  ghost: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.ink },
  primaryHovered: { backgroundColor: '#2C312A' },
  ghostHovered: { backgroundColor: colors.sand },
  disabled: { opacity: 0.38 },
  label: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  arrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.maize, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  arrowText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.ink },
});
