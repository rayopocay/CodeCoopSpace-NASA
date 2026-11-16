import type { Language } from '../i18n/types';
import { ApiError } from './ApiError';
import { normalizeCompareResponse, normalizeComplementaryClimate, normalizeCurrentWeather, normalizeSites } from './normalize';
import type { RotationApi } from './rotationApi';

interface HttpOptions {
  baseUrl: string;
  timeoutMs?: number;
}

/**
 * Talks to the team backend following docs/CONTRATO.md.
 * The timeout is generous: the first comparison of an area waits for NASA POWER and for the explanation.
 */
export function createHttpRotationApi({ baseUrl, timeoutMs = 75000 }: HttpOptions): RotationApi {
  const root = baseUrl.replace(/\/$/, '');

  async function request(path: string, language: Language, init?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${root}${path}`, {
        ...init,
        // The language of every returned text is requested with Accept-Language (en | es).
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': language },
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(`HTTP ${response.status} on ${path}`, response.status, path, body);
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // Network failure, CORS rejection or timeout.
      throw new ApiError(`Could not reach ${root}${path}: ${error instanceof Error ? error.message : String(error)}`, 0, path);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async listSites(language) {
      const path = '/v1/sites';
      return normalizeSites(await request(path, language), path);
    },
    async compareRotations(body, language) {
      const path = '/v1/compare';
      return normalizeCompareResponse(await request(path, language, { method: 'POST', body: JSON.stringify(body) }), path);
    },
    async getCurrentWeather(siteId, language) {
      const path = '/v1/weather/current';
      const url = path + '?siteId=' + encodeURIComponent(siteId);
      return normalizeCurrentWeather(await request(url, language), path);
    },
    async getComplementaryClimate(query, language) {
      const path = '/v1/climate/meteomatics';
      // Only the values the caller knows are sent; the server has defaults for the rest.
      const params = Object.entries(query)
        .filter(([, value]) => (typeof value === 'number' ? Number.isFinite(value) : Boolean(value)))
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
      const url = params.length > 0 ? `${path}?${params.join('&')}` : path;
      return normalizeComplementaryClimate(await request(url, language), path);
    },
  };
}
