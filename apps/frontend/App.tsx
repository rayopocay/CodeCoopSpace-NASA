import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';

import { Grain } from './src/components/ui';
import { ReducedMotionProvider } from './src/context/ReducedMotionContext';
import { LanguageProvider } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors, isWeb } from './src/theme';

/** App shell: fonts, global providers and the sand grain over everything. */
export default function App() {
  // Each weight is imported from its own subpath so only these five are bundled.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    document.body.style.backgroundColor = colors.ivory;
    // On phones the browser bar hides while scrolling and the visible area grows.
    // `100dvh` follows that change, so bars pinned to the bottom stay at the real bottom.
    if (!document.getElementById('yago-viewport')) {
      const style = document.createElement('style');
      style.id = 'yago-viewport';
      style.textContent = [
        'html, body, #root { height: 100%; }',
        '@supports (height: 100dvh) { html, body, #root { height: 100dvh; } }',
        'body { overscroll-behavior: none; }',
      ].join('\n');
      document.head.appendChild(style);
    }
  }, []);

  // If the fonts fail to load, render with system fonts rather than a blank screen.
  if (!fontsLoaded && !fontError) return <View style={styles.root} />;

  return (
    <LanguageProvider>
      <ReducedMotionProvider>
        <View style={styles.root}>
          <StatusBar barStyle="dark-content" />
          <RootNavigator />
          <Grain opacity={0.1} />
        </View>
      </ReducedMotionProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory, paddingTop: Platform.OS === 'web' ? 0 : (StatusBar.currentHeight ?? 44) },
});
