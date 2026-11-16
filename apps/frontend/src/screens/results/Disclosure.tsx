import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { isHovered } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { USE_NATIVE_DRIVER, colors, fonts } from '../../theme';

interface DisclosureProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}

/** Full-width row that opens or closes a section; the arrow turns with it. */
export function Disclosure({ label, expanded, onToggle }: DisclosureProps) {
  const reduced = useReducedMotion();
  const turn = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(turn, { toValue: expanded ? 1 : 0, speed: reduced ? 40 : 14, bounciness: reduced ? 0 : 8, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [expanded, turn, reduced]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={(state) => [styles.row, isHovered(state) && styles.hovered, state.pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <Animated.Text style={[styles.arrow, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}>⌄</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: 'rgba(255,253,247,0.6)' },
  hovered: { backgroundColor: colors.sand },
  pressed: { opacity: 0.7 },
  label: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23, color: colors.ink },
  arrow: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 26, color: colors.ink },
});
