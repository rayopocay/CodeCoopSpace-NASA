import { Animated, View } from 'react-native';

import type { Pointer } from '../../hooks/usePointer';
import { images } from '../../theme';
import { interpolate } from '../../utils/animation';
import { SCENE_MOTION } from './sceneMotion';
import type { SceneDefinition } from './scenes';
import { useSceneLife } from './useSceneLife';
import { useSceneTransition } from './useSceneTransition';

interface SceneLayerProps {
  scene: SceneDefinition;
  active: boolean;
  size: number;
  reduced: boolean;
  pointer: Pointer;
  /** true when the sand transition is available (web, images already sampled). */
  sand: boolean;
  /** Length of the sand transition, ms. */
  sandMs?: number;
}

/** Parallax strength of each depth layer, in px at full cursor travel. */
const DEPTH = { halo: -30, mist: -12, sharp: 16 };
const MIST_SCALE = 1.16;

/**
 * One scene = color halo + pre-blurred mist + sharp image + eyelid.
 * Only opacity and position are animated; the blur is baked into the images.
 */
export function SceneLayer({ scene, active, size, reduced, pointer, sand, sandMs }: SceneLayerProps) {
  const motion = SCENE_MOTION[scene.kind];
  const { progress, sharpOpacity, slide } = useSceneTransition(active, reduced, sand, sandMs);
  const life = useSceneLife(motion, active && !reduced, Boolean(scene.eye));

  // No displacement at all when the person asked for less motion.
  const travel = reduced ? 0 : 1;

  const sharpTransition = {
    opacity: sharpOpacity,
    transform: [
      { translateX: interpolate(slide, [0, 1, 2], [70 * travel, 0, -56 * travel]) },
      { scale: interpolate(slide, [0, 1, 2], [1 + 0.08 * travel, 1, 1 - 0.04 * travel]) },
    ],
  };
  // With sand the mist stays still and faint: the grains provide the movement.
  const mistTransition = {
    opacity: sand ? interpolate(progress, [0, 0.55, 1, 1.4, 2], [0, 0.1, 0.16, 0.08, 0]) : interpolate(progress, [0, 0.4, 1, 1.5, 2], [0, 0.9, 0.16, 0.7, 0]),
    transform: [
      { translateX: interpolate(progress, [0, 1, 2], sand ? [0, 0, 0] : [-30 * travel, 0, 40 * travel]) },
      { scale: interpolate(progress, [0, 1, 2], sand ? [MIST_SCALE, MIST_SCALE, MIST_SCALE] : [MIST_SCALE - 0.3 * travel, MIST_SCALE, MIST_SCALE + 0.26 * travel]) },
    ],
  };
  const haloTransition = {
    opacity: interpolate(progress, [0, 0.6, 1, 2], [0, 0.5, 1, 0]),
    transform: [{ scale: interpolate(progress, [0, 1, 2], [1 - 0.4 * travel, 1, 1 + 0.3 * travel]) }],
  };

  // Depth that follows the cursor: layers shift by different amounts (near-3D).
  const parallax = (value: Animated.ValueXY, strength: number) => [
    { translateX: interpolate(value.x, [-1, 1], [-strength * travel, strength * travel]) },
    { translateY: interpolate(value.y, [-1, 1], [-strength * 0.7 * travel, strength * 0.7 * travel]) },
  ];
  const tilt = [
    { perspective: 900 },
    { rotateY: interpolate(pointer.fast.x, [-1, 1], [`${-5 * travel}deg`, `${5 * travel}deg`]) },
    { rotateX: interpolate(pointer.fast.y, [-1, 1], [`${4 * travel}deg`, `${-4 * travel}deg`]) },
  ];

  const fill = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  const haloSize = size * 0.62;
  const { eye } = scene;

  return (
    <View pointerEvents="none" style={fill}>
      <Animated.View style={[fill, { transform: parallax(pointer.slow, DEPTH.halo) }]}>
        <Animated.Image
          source={scene.halo === 'maize' ? images.haloMaize : images.haloLeaf}
          resizeMode="contain"
          style={[{ position: 'absolute', width: haloSize, height: haloSize, left: scene.haloAt.x * size - haloSize / 2, top: scene.haloAt.y * size - haloSize / 2 }, haloTransition]}
        />
      </Animated.View>

      <Animated.View style={[fill, { transform: parallax(pointer.slow, DEPTH.mist) }]}>
        <Animated.View style={[fill, mistTransition]}>
          <Animated.Image source={scene.mist} resizeMode="cover" style={[fill, { transformOrigin: scene.origin, transform: motion.mistTransform(life) } as object]} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[fill, { transform: [...parallax(pointer.fast, DEPTH.sharp), ...tilt] }]}>
        <Animated.View style={[fill, sharpTransition]}>
          <Animated.View style={[fill, { transformOrigin: scene.origin, transform: motion.sharpTransform(life) } as object]}>
            <Animated.Image source={scene.sharp} resizeMode="contain" style={fill} />
            {eye ? (
              <Animated.Image
                source={images.eyelid}
                resizeMode="stretch"
                style={{
                  position: 'absolute',
                  width: eye.width * size,
                  height: eye.width * size * 0.62,
                  left: (eye.x - eye.width / 2) * size,
                  top: eye.y * size - eye.width * size * 0.31,
                  opacity: life.eyelid,
                  transform: [{ rotate: `${eye.rotation}deg` }],
                }}
              />
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export { DEPTH as SCENE_DEPTH };
