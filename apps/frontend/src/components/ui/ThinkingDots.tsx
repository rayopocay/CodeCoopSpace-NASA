import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useReducedMotion } from '../../context/ReducedMotionContext';
import { USE_NATIVE_DRIVER, colors } from '../../theme';

interface ThinkingDotsProps {
  color?: string;
  size?: number;
}

/** Three dots that hop one after the other, as while someone is thinking. */
export function ThinkingDots({ color = colors.ink, size = 7 }: ThinkingDotsProps) {
  const reduced = useReducedMotion();
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 1150, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }));
    loop.start();
    return () => loop.stop();
  }, [phase, reduced]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.7, height: size * 2.4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((dot) => {
        const start = 0.05 + dot * 0.16;
        const inputRange = [0, start, start + 0.18, start + 0.36, 1];
        return (
          <Animated.View
            key={dot}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: reduced ? 0.7 : phase.interpolate({ inputRange, outputRange: [0.3, 0.3, 1, 0.3, 0.3] }),
              transform: [{ translateY: reduced ? 0 : phase.interpolate({ inputRange, outputRange: [0, 0, -size * 0.8, 0, 0] }) }],
            }}
          />
        );
      })}
    </View>
  );
}
