import { Animated } from 'react-native';

import { useLoopAnimation } from '../../hooks/useLoopAnimation';
import type { Pointer } from '../../hooks/usePointer';
import { images } from '../../theme';
import { interpolate } from '../../utils/animation';

interface FloatingHalosProps {
  pointer: Pointer;
  width: number;
  height: number;
  /** Diameter of the larger halo. */
  size: number;
}

/**
 * Two soft color blobs that follow the cursor, drifting together and apart.
 * On touch screens, where there is no cursor, they float on their own.
 */
export function FloatingHalos({ pointer, width, height, size }: FloatingHalosProps) {
  // JS driver: the drift is added to the pointer position, which also runs in JS.
  const drift = useLoopAnimation(7000, false);
  const small = size * 0.7;

  return (
    <>
      <Animated.Image
        source={images.haloLeaf}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          left: width * 0.5 - size / 2,
          top: height * 0.38 - size / 2,
          opacity: 0.5,
          transform: [
            { translateX: Animated.add(interpolate(pointer.slow.x, [-1, 1], [-width * 0.42, width * 0.42]), interpolate(drift, [0, 1], [-width * 0.12, width * 0.16])) },
            { translateY: Animated.add(interpolate(pointer.slow.y, [-1, 1], [-height * 0.4, height * 0.4]), interpolate(drift, [0, 1], [height * 0.05, -height * 0.07])) },
            { scale: interpolate(drift, [0, 1], [0.9, 1.15]) },
          ],
        }}
      />
      <Animated.Image
        source={images.haloMaize}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: small,
          height: small,
          left: width * 0.5 - small / 2,
          top: height * 0.38 - small / 2,
          opacity: 0.6,
          transform: [
            { translateX: Animated.add(interpolate(pointer.fast.x, [-1, 1], [-width * 0.46, width * 0.46]), interpolate(drift, [0, 1], [width * 0.14, -width * 0.1])) },
            { translateY: Animated.add(interpolate(pointer.fast.y, [-1, 1], [-height * 0.44, height * 0.44]), interpolate(drift, [0, 1], [-height * 0.04, height * 0.06])) },
          ],
        }}
      />
    </>
  );
}
