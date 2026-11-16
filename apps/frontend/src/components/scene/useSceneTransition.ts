import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { USE_NATIVE_DRIVER } from '../../theme';

/** Duration of the sand transition between two scenes. */
export const SAND_TRANSITION_MS = 1900;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 950;
const REDUCED_MS = 220;

interface SceneTransition {
  /** 0 (hidden, about to enter) → 1 (visible) → 2 (hidden, already left). Drives halo and mist. */
  progress: Animated.Value;
  /** Opacity of the sharp image. */
  sharpOpacity: Animated.Value;
  /** Slide of the sharp image, same 0 → 1 → 2 range. Stays at 1 during sand transitions. */
  slide: Animated.Value;
}

/**
 * Enter and exit animation of one scene.
 *
 * Without sand the sharp image fades and slides. With sand it does not slide:
 * it switches off quickly while the grains take its shape, and the incoming
 * image appears once the grains have settled.
 */
export function useSceneTransition(active: boolean, reduced: boolean, sand: boolean, sandMs: number = SAND_TRANSITION_MS): SceneTransition {
  const progress = useRef(new Animated.Value(0)).current;
  const sharpOpacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const wasShown = useRef(false);
  // Read through a ref: the sand mode becoming available must not replay the transition.
  const sandRef = useRef(sand);
  sandRef.current = sand;

  useEffect(() => {
    const withSand = sandRef.current && !reduced;
    const animate = (value: Animated.Value, toValue: number, duration: number, delay = 0, easing = Easing.out(Easing.cubic)) =>
      Animated.timing(value, { toValue, duration, delay, easing, useNativeDriver: USE_NATIVE_DRIVER }).start();

    if (active) {
      wasShown.current = true;
      const duration = reduced ? REDUCED_MS : withSand ? sandMs : FADE_IN_MS;
      progress.setValue(0);
      sharpOpacity.setValue(0);
      animate(progress, 1, duration);
      if (withSand) {
        slide.setValue(1);
        animate(sharpOpacity, 1, sandMs * 0.36, sandMs * 0.6, Easing.inOut(Easing.quad));
      } else {
        slide.setValue(0);
        animate(slide, 1, duration);
        animate(sharpOpacity, 1, duration * 0.7, duration * 0.3);
      }
    } else if (wasShown.current) {
      wasShown.current = false;
      const duration = reduced ? REDUCED_MS : withSand ? sandMs * 0.7 : FADE_OUT_MS;
      animate(progress, 2, duration, 0, Easing.inOut(Easing.quad));
      if (withSand) {
        animate(sharpOpacity, 0, 300, 0, Easing.out(Easing.quad));
      } else {
        animate(slide, 2, duration, 0, Easing.inOut(Easing.quad));
        animate(sharpOpacity, 0, duration * 0.5, 0, Easing.inOut(Easing.quad));
      }
    }
  }, [active, reduced, progress, sharpOpacity, slide, sandMs]);

  return { progress, sharpOpacity, slide };
}
