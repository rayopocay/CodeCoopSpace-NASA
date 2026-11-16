import { StyleSheet, Text, View } from 'react-native';

import type { Climate, Site, Source } from '../../../api/types';
import { Enter } from '../../../components/ui';
import { useCurrentWeather } from '../../../hooks/useCurrentWeather';
import { useTranslation } from '../../../i18n';
import { colors, fonts } from '../../../theme';
import { FarmTiles } from './FarmTiles';
import { ForecastStrip } from './ForecastStrip';
import { SeasonHistory } from './SeasonHistory';
import { WeatherHero } from './WeatherHero';

interface WeatherViewProps {
  site: Site;
  climate: Climate;
  sources: Source[];
  wide: boolean;
}

/**
 * "El clima", built like a weather app for farmers: the weather right now and
 * for the next 24 hours (Meteomatics, context only), then how the rainy
 * season has been here year after year (NASA POWER, the data behind the
 * comparison).
 */
export function WeatherView({ site, climate, sources, wide }: WeatherViewProps) {
  const { language, t } = useTranslation();
  const text = t.weather;
  const { data, loading, refresh } = useCurrentWeather(site.id, language);
  const hasForecast = data !== null && data.status !== 'unavailable' && (data.forecast.length > 0 || data.current !== null);

  return (
    <View style={styles.root}>
      <View style={[styles.top, wide && styles.topWide]}>
        <Enter offsetY={24} duration={620} style={wide ? styles.half : undefined}>
          <WeatherHero site={site} weather={data} loading={loading} onRefresh={refresh} height={wide ? 560 : 500} />
        </Enter>
        {hasForecast ? (
          <View style={[styles.side, wide && styles.half]}>
            <Enter delay={140} offsetY={22}>
              <ForecastStrip weather={data} />
            </Enter>
            <FarmTiles weather={data} />
            <Text style={styles.contextNote}>{text.forecastSource(site.department || site.name)}</Text>
          </View>
        ) : null}
      </View>

      <SeasonHistory key={`${climate.period.start}-${climate.years.length}`} climate={climate} sources={sources} />

      <Text style={styles.wordsNote}>{text.wordsNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 18, gap: 26 },
  top: { gap: 14 },
  topWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  half: { flex: 1 },
  side: { gap: 14 },
  contextNote: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  wordsNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkFaint },
});
