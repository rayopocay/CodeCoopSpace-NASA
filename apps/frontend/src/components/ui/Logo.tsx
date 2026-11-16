import { Image } from 'react-native';

import { images } from '../../theme';

/** Width / height of the logo artwork. */
const LOGO_RATIO = 1657 / 514;

/** Fixed brand mark: the jaguarundi symbol plus the word "yago". The only art that carries text. */
export function Logo({ height = 40 }: { height?: number }) {
  return <Image accessibilityLabel="Yago" source={images.logo} style={{ height, width: height * LOGO_RATIO }} resizeMode="contain" />;
}
