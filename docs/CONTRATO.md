# Contrato compartido

Estado: implementado en `services/api` y consumido por `apps/frontend`. Rutas: `GET /health`, `GET /v1/sites`, `POST /v1/compare` y `GET /v1/climate/meteomatics`. Un cambio de forma se coordina en el issue y se actualiza aquí en el mismo PR.

Los nombres de campos van en camelCase. El texto libre (motivos, notas, advertencias, explicación) llega en el idioma de la cabecera `Accept-Language`: español si empieza con `es`, inglés en cualquier otro caso. El frontend localiza sus propias etiquetas (cultivos, prioridades, niveles, tipo de fuente).

## Clima actual de la zona

Pedir GET /v1/weather/current con siteId de GET /v1/sites. El servidor consulta Meteomatics para el punto de referencia del departamento. current muestra la temperatura modelada, con validAt. forecast contiene hasta cuatro periodos de seis horas con la temperatura al final de cada periodo y lluvia acumulada durante las seis horas anteriores. Los campos sin datos son nulos y la respuesta indica available, partial o unavailable. Las horas de la API están en UTC y la app las muestra en hora de El Salvador. El servidor reutiliza datos dentro del mismo intervalo de 15 minutos.

## `GET /v1/sites`

Zonas que se pueden elegir: cabeceras departamentales con coordenadas públicas aproximadas, nunca una parcela.

```json
[{ "id": "san-miguel", "name": "San Miguel", "department": "San Miguel", "approxLat": 13.64, "approxLon": -88.45, "crops": ["maize", "bean", "sorghum"], "isDemo": false }]
```

## `POST /v1/compare`

```json
{
  "siteId": "san-miguel",
  "currentCrop": "sorghum",
  "soil": { "texture": "unknown", "drainage": "good" },
  "priorities": ["diversification", "water", "soil"]
}
```

- `currentCrop`: `maize`, `bean` o `sorghum`. `soil.texture`: `sandy`, `loam`, `clay` o `unknown`. `soil.drainage`: `good`, `poor` o `unknown`.
- `priorities` trae `water`, `soil` y `diversification` una sola vez. El orden es significativo: manda la primera y las otras solo desempatan.
- 422 para prioridades duplicadas, incompletas o desconocidas, zona no soportada, cultivo o suelo fuera de catálogo.

Respuesta (HTTP 200 siempre que la entrada sea válida, también si falla el clima o Groq):

| Campo | Contenido |
| --- | --- |
| `climate` | Contexto histórico de NASA POWER: `status` (`available` / `partial` / `unavailable`), `kind` (`season-history` o `saved-sample`), `period`, `periodLabel`, `coverage` en días, `validYears` / `expectedYears`, `metrics[]`, `sourceId`, `spatialScale`, `stale`, `cacheAgeHours`, `stress` (`low` / `moderate` / `high` / `null`), `alert` y `note`. |
| `climate.years[]` | Cada época lluviosa con datos completos: `year`, `seasonRainMm` (mayo a octubre) y `longestDrySpellDays` (racha más larga con menos de 1 mm en julio y agosto). Vacío con la muestra guardada. La vista de clima dibuja una barra por año. |
| `climate.metrics[]` | `id`, `value`, `unit`, `total` (para cifras «k de n»), `label` legible, `reason` cuando `value` es `null`, `sourceId`. Historia: `seasonRainMean` (mm), `drySpellYears` (años de `total`), `tMaxMean` (°C). Muestra guardada: `precipTotal`, `dryDays`, `tMaxMean`. |
| `scenarios[]` | Rotación actual y dos alternativas: `id`, `role` (`current` / `alternative`), `sequence`, `summary`, `limitation`, `missingData`, `criteria[]`, `sourceIds`, `score` y `blocked` (restricción fuerte: terreno que se encharca con el cultivo más sensible). |
| `criteria[]` | Uno por prioridad, en el orden pedido: `priority`, `status` (`evaluable` / `undetermined`), `level` (`favorable` / `neutral` / `unfavorable` / `null`), `value` y `unit` cuando hay soporte, `reason` legible y `evidence` con ids de `sources[]`. |
| `highlight` | `scenarioId`, `priority` y `reason`: la opción que destaca para la prioridad principal. |
| `explanation` | `source` (`groq` o `rules`), `model`, `fallbackReason` y cuatro textos: `consider`, `influence`, `caution`, `verify`. |
| `sources[]` | `id`, `name`, `url`, `version`, `kind` (`nasa`, `local-reference`, `technical-reference`, `user-input`, `demo-assumption`) y `note`. |
| `warnings[]`, `methodVersion`, `isDemo` | Datos faltantes y supuestos del método, versión de reglas, y `true` cuando el clima es la muestra guardada. |

Comportamiento ante fallos:

- **NASA POWER no responde:** se usa una copia guardada del mismo punto y periodo (`stale: true`). Si no existe y la zona es la de la muestra del repositorio, se usa esa muestra de una semana (`kind: "saved-sample"`, `isDemo: true`) y el agua queda sin valorar. En cualquier otra zona, `climate.status: "unavailable"`, agua `undetermined` y el resto de la comparación sigue.
- **Groq no está configurado, tarda, llega al límite, falla o devuelve algo inválido:** `explanation.source: "rules"` con `fallbackReason` ∈ `not_configured`, `timeout`, `rate_limited`, `provider_error`, `invalid_output`. Los escenarios, las valoraciones y las fuentes son idénticos con o sin Groq.
- **Respuesta «No sé» en suelo:** no penaliza ni descarta opciones; se lista en `missingData`, en `warnings[]` y en `explanation.verify`.

Ejemplos reales generados desde el servidor: `apps/frontend/docs/examples/`.

## Clima complementario: `GET /v1/climate/meteomatics` (implementado)

Parámetros opcionales: `latitude` (13.0–14.6), `longitude` (−90.2 a −87.5), `start` y `end` (`YYYY-MM-DD`, máximo 31 días, `end` en el pasado). Por defecto usa el punto y la semana de la muestra NASA POWER de San Miguel (13.64, −88.45; 2024-05-01 a 2024-05-07). Entradas inválidas → 422. El frontend pide los últimos 7 días completos del punto aproximado de la zona y lo muestra solo como contexto: no entra en la comparación.

```json
{
  "source": "meteomatics",
  "status": "available",
  "reason": null,
  "message": null,
  "start": "2024-05-01",
  "end": "2024-05-07",
  "units": { "tMaxC": "degC", "tMinC": "degC", "precipMm": "mm" },
  "coverage": { "validDays": 7, "expectedDays": 7 },
  "days": [{ "date": "2024-05-01", "tMaxC": 33.9, "tMinC": 25.9, "precipMm": 3.3 }],
  "provenance": { "product": "Meteomatics Weather API", "url": "https://api.meteomatics.com/...", "retrievedAt": "2026-11-15T00:00:00Z", "timeStandard": "UTC" },
  "stale": false
}
```

- `status`: `available`, `partial` (faltan valores; cada uno queda en `null`) o `unavailable` con `reason` ∈ `not_configured`, `auth_failed`, `timeout`, `upstream_error`, `invalid_response` y un `message` legible. Un fallo del proveedor responde HTTP 200 con `unavailable` para que la comparación NASA siga disponible.
- Caché en memoria de 6 h por sitio y periodo. Si el proveedor falla y hay una copia previa, se devuelve con `stale: true` y su `retrievedAt` original.
- Días en UTC: el valor del día D agrega 00:00–24:00 UTC. POWER usa tiempo solar local (≈ UTC−6 en San Miguel), así que los días no coinciden exactamente.

El frontend no trae datos propios: todo lo que muestra sale de estas rutas. `npm run check:api` (en `apps/frontend`) valida un servidor en marcha contra lo que espera la app: éxito, 422 y dato no disponible.
