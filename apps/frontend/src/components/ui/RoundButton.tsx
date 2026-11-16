import { Pressable, Text } from 'react-native';

import { colors, fonts } from '../../theme';
import { isHovered } from './hover';

interface RoundButtonProps {
  /** A single character, usually an arrow. */
  symbol: string;
  /** Read by screen readers; the symbol alone says nothing. */
  label: string;
  onPress: () => void;
  size?: number;
}

/** Round outlined button with an arrow or symbol. */
export function RoundButton({ symbol, label, onPress, size = 52 }: RoundButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={(state) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, backgroundColor: 'rgba(247,243,232,0.7)' },
        isHovered(state) && { backgroundColor: colors.sand },
        state.pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.4, lineHeight: size * 0.5, color: colors.ink }}>{symbol}</Text>
    </Pressable>
  );
}
