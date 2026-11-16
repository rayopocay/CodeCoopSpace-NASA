import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { useReducedMotion } from '../../../context/ReducedMotionContext';

/** Counts from 0 (or the previous value) up to `target`, so big figures feel alive when they appear. */
export function useCountUp(target: number | null, duration = 900): number | null {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<number | null>(reduced ? target : target === null ? null : 0);

  useEffect(() => {
    if (target === null) {
      setShown(null);
      return;
    }
    if (reduced) {
      setShown(target);
      return;
    }
    const id = value.addListener(({ value: current }) => setShown(current));
    const animation = Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => {
      animation.stop();
      value.removeListener(id);
    };
  }, [target, duration, reduced, value]);

  return shown;
}
