import type { PressableStateCallbackType } from 'react-native';

/**
 * State passed to a Pressable `style` callback. React Native Web also reports
 * `hovered` (mouse over the element); on phones it is always false.
 */
export type InteractionState = PressableStateCallbackType & { hovered?: boolean };

/** True while a mouse is over the element (web only). */
export const isHovered = (state: PressableStateCallbackType) => (state as InteractionState).hovered === true;
