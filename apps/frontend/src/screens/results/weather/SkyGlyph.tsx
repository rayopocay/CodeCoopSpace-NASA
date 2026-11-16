import { View } from 'react-native';

import { colors } from '../../../theme';

interface SkyGlyphProps {
  kind: 'sun' | 'moon' | 'rain' | 'drizzle';
  size?: number;
}

/** Small drawn weather symbol for the forecast strip, in the palette's own colours. */
export function SkyGlyph({ kind, size = 30 }: SkyGlyphProps) {
  if (kind === 'sun') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(243,183,43,0.28)' }} />
        <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, backgroundColor: colors.maize }} />
      </View>
    );
  }
  if (kind === 'moon') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.64, height: size * 0.64, borderRadius: size * 0.32, backgroundColor: colors.ivory, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: size * 0.2, top: -size * 0.1, width: size * 0.64, height: size * 0.64, borderRadius: size * 0.32, backgroundColor: 'rgba(23,26,22,0.7)' }} />
        </View>
      </View>
    );
  }
  const drops = kind === 'rain' ? 3 : 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ marginTop: size * 0.08, width: size * 0.86, height: size * 0.4, borderRadius: size * 0.2, backgroundColor: colors.ivory }} />
      <View style={{ position: 'absolute', top: 0, left: size * 0.26, width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, backgroundColor: colors.ivory }} />
      <View style={{ flexDirection: 'row', gap: size * 0.12, marginTop: size * 0.06 }}>
        {Array.from({ length: drops }, (_, drop) => (
          <View key={drop} style={{ width: size * 0.07, height: size * 0.26, borderRadius: size * 0.04, backgroundColor: colors.maize, transform: [{ rotate: '14deg' }] }} />
        ))}
      </View>
    </View>
  );
}
