import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';

import { FloatingHalos, SCENES, SceneStage } from '../../components/scene';
import { AppText, Button, Enter, LanguageToggle, Logo } from '../../components/ui';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { usePointer } from '../../hooks/usePointer';
import { useSceneCarousel } from '../../hooks/useSceneCarousel';
import { useTranslation } from '../../i18n';
import { WIDE_BREAKPOINT, colors, isWeb } from '../../theme';
import { SceneControl } from './SceneControl';

/** Horizontal distance, in px, a swipe must travel to change the scene. */
const SWIPE_DISTANCE = 44;
/** How far down each drawing the face reaches, as a share of its frame. Below it there is only soft fur. */
const FACE_BOTTOM = 0.8;
/** Smallest art on phones, so short screens still show the scene. */
const MIN_STAGE = 220;

/** Immersive welcome: large animated scenes, the question and one clear button. */
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const pointer = usePointer(!reduced);
  // The scenes change by themselves (not with reduced motion); touching an arrow pauses them for a while.
  const { index, next, previous, goTo } = useSceneCarousel(SCENES.length, !reduced);

  // On touch screens a horizontal swipe changes the scene and moves the depth layers.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_event, gesture) => pointer.set(Math.max(-1, Math.min(1, gesture.dx / 140)), 0),
        onPanResponderRelease: (_event, gesture) => {
          pointer.set(0, 0);
          if (gesture.dx < -SWIPE_DISTANCE) next();
          else if (gesture.dx > SWIPE_DISTANCE) previous();
        },
        onPanResponderTerminate: () => pointer.set(0, 0),
      }),
    [pointer, next, previous],
  );

  // On phones the copy sits at the bottom over the art. Its height is measured so the face of
  // each scene always ends above it, whatever the screen and the language.
  const [copyHeight, setCopyHeight] = useState(0);
  const phoneTop = Math.max(48, height * 0.045);
  // The first 8% of the copy block is still a see-through fade.
  const room = height - copyHeight * 0.92 - phoneTop;
  const stageSize = wide ? Math.min(height * 1.02, width * 0.62) : Math.max(MIN_STAGE, Math.min(width * 1.2, height * 0.6, room / FACE_BOTTOM));
  const stageLeft = wide ? width - stageSize * 0.94 : width - stageSize * 0.9;
  const stageTop = wide ? (height - stageSize) / 2 : phoneTop;
  const stageReady = wide || copyHeight > 0;
  const padding = wide ? 64 : 20;
  const titleSize = wide ? Math.min(92, width * 0.066) : Math.min(48, width * 0.128);

  // On small screens the copy sits over the art, so it gets a soft ivory fade behind it.
  const scrim = isWeb
    ? ({ backgroundImage: wide ? 'none' : 'linear-gradient(to bottom, rgba(247,243,232,0) 0%, rgba(247,243,232,0.92) 13%, #F7F3E8 24%)' } as object)
    : { backgroundColor: 'rgba(247,243,232,0.86)' };

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <FloatingHalos pointer={pointer} width={width} height={height} size={wide ? 560 : 300} />

      {stageReady ? (
        <View style={{ position: 'absolute', left: stageLeft, top: stageTop }}>
          <SceneStage index={index} size={stageSize} reduced={reduced} pointer={pointer} />
        </View>
      ) : null}

      <Enter offsetY={-10} style={{ position: 'absolute', top: wide ? 36 : 18, left: padding }}>
        <Logo height={wide ? 56 : 46} />
      </Enter>
      <Enter offsetY={-10} style={{ position: 'absolute', top: wide ? 40 : 20, right: padding }}>
        <LanguageToggle />
      </Enter>

      <View
        onLayout={(event) => !wide && setCopyHeight(Math.round(event.nativeEvent.layout.height))}
        style={[wide ? styles.copyWide : styles.copy, { paddingHorizontal: padding }, scrim]}
      >
        <View style={wide ? styles.copyColumn : null}>
          {/* On phones the scene name, the dots and the arrows sit right under the image. */}
          {!wide ? (
            <Enter delay={60} offsetY={16} style={styles.controlPhone}>
              <SceneControl index={index} onNext={next} onPrevious={previous} onSelect={goTo} />
            </Enter>
          ) : null}
          <Enter delay={120} offsetY={26}>
            <AppText variant="display" accessibilityRole="header" style={{ fontSize: titleSize, lineHeight: titleSize * (wide ? 1 : 1.04), letterSpacing: wide ? -2.5 : -1 }}>
              {t.welcome.title}
            </AppText>
          </Enter>
          <Enter delay={220} offsetY={22}>
            <AppText variant="lead" style={wide ? styles.leadWide : styles.lead}>
              {t.welcome.lead}
            </AppText>
          </Enter>
          <Enter delay={320} offsetY={22} style={{ marginTop: wide ? 34 : 18 }}>
            <Button label={t.welcome.cta} showArrow onPress={onStart} style={wide ? styles.ctaWide : undefined} />
          </Enter>
          {wide ? (
            <Enter delay={380} style={styles.control}>
              <SceneControl index={index} onNext={next} onPrevious={previous} onSelect={goTo} />
            </Enter>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory, overflow: 'hidden' },
  copy: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 22, paddingTop: 56 },
  copyWide: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '56%', justifyContent: 'center', paddingTop: 60 },
  copyColumn: { maxWidth: 560 },
  control: { marginTop: 16 },
  controlPhone: { marginBottom: 14 },
  lead: { marginTop: 10, maxWidth: 470, fontSize: 18, lineHeight: 25 },
  leadWide: { marginTop: 20, maxWidth: 470, fontSize: 21, lineHeight: 31 },
  ctaWide: { alignSelf: 'flex-start', minWidth: 320 },
});
