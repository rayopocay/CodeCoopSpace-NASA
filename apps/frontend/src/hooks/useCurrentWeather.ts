import { useCallback, useEffect, useState } from 'react';

import { rotationApi } from '../api';
import type { CurrentWeather } from '../api/types';
import type { Language } from '../i18n';

interface CurrentWeatherState {
  /** null while loading the first time, or when the server could not be reached. */
  data: CurrentWeather | null;
  loading: boolean;
  refresh: () => void;
}

/** Weather now and for the next 24 hours at the area's approximate point (Meteomatics, through the server). */
export function useCurrentWeather(siteId: string, language: Language): CurrentWeatherState {
  const [data, setData] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    rotationApi
      .getCurrentWeather(siteId, language)
      .then((result) => active && setData(result))
      .catch((error) => {
        console.warn('[Yago] Could not load the current weather.', error);
        if (active) setData(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [siteId, language, revision]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { data, loading, refresh };
}
