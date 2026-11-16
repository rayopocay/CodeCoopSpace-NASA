import { useCallback, useMemo, useState } from 'react';
import { Animated, View } from 'react-native';

import type { Pointer } from '../../hooks/usePointer';
import { interpolate } from '../../utils/animation';
import { SandMorph } from './SandMorph';
import { SCENE_DEPTH, SceneLayer } from './SceneLayer';
import { SCENES } from './scenes';
import { SAND_TRANSITION_MS } from './useSceneTransition';

interface SceneStageProps {
  /** Index of the visible scene in `SCENES`. */
  index: number;
  size: number;
  reduced: boolean;
  pointer: Pointer;
  /** Length of each sand transition, ms. The loader uses a faster one than the welcome screen. */
  transitionMs?: number;
}

/** Welcome stage: every scene is stacked and only one is visible at a time. */
export function SceneStage({ index, size, reduced, pointer, transitionMs = SAND_TRANSITION_MS }: SceneStageProps) {
  // Sand is only used once the browser has sampled the images (web).
  const [sandReady, setSandReady] = useState(false);
  const handleSandReady = useCallback(() => setSandReady(true), []);
  const sources = useMemo(() => SCENES.map((scene) => scene.sharp), []);
  const sand = sandReady && !reduced;
  const travel = reduced ? 0 : 1;
  const shift = SCENE_DEPTH.sharp * travel;

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      {SCENES.map((scene, sceneIndex) => (
        <SceneLayer key={scene.key} scene={scene} active={sceneIndex === index} size={size} reduced={reduced} pointer={pointer} sand={sand} sandMs={transitionMs} />
      ))}
      {/* The sand moves with the same depth as the sharp image so grains land on it. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          transform: [
            { translateX: interpolate(pointer.fast.x, [-1, 1], [-shift, shift]) },
            { translateY: interpolate(pointer.fast.y, [-1, 1], [-shift * 0.7, shift * 0.7]) },
          ],
        }}
      >
        <SandMorph sources={sources} index={index} size={size} enabled={sand} duration={transitionMs} onReady={handleSandReady} />
      </Animated.View>
    </View>
  );
}
