# Datos y método

## Fuentes y comprobación

| Fuente primaria | Qué usar y qué comprobar |
| --- | --- |
| [NASA POWER Daily](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Acceso probado para `T2M_MAX`, `T2M_MIN` y `PRECTOTCORR`. El ejemplo devuelve °C y mm/día, tiempo solar local y procedencia MERRA2/POWER. Es contexto climático gridded; conserva resolución y procedencia de cada parámetro. |
| [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) y [catálogo GES DISC](https://cmr.earthdata.nasa.gov/search/site/collections/directory/GES_DISC/gov.nasa.eosdis) | Prioriza probar `GPM_3IMERGDF` Final, V07, diario, cuadrícula de 0.1°. Confirma acceso, versión efectiva, unidades, cobertura y valores de relleno del archivo. Serie distinta de POWER. Evita descargar una colección completa. |
| [NASA Earthdata SMAP](https://search.earthdata.nasa.gov/search?q=SPL3SMP_E) | Extensión opcional para contexto regional de humedad superficial, sujeto a QA y cobertura. El producto gridded de 9 km carece de precisión para atribuir características de suelo a una parcela. |
| [CENTA: granos básicos](https://www.centa.gob.sv/servicios/programa-granos-basicos/) y [guía de maíz](https://www.centa.gob.sv/download/guia-tecnica-cultivo-de-maiz/) | Punto de partida local para maíz, frijol y sorgo. Antes de usar un valor, verificar variedad, zona, temporada, unidad y página/tabla de la referencia. |
| [Groq](https://console.groq.com/docs/structured-outputs) | Redacción de la explicación desde el servidor. No aporta datos: explica el resultado calculado. Su uso se declara en la entrega. |
| [Meteomatics Weather API](https://www.meteomatics.com/en/api/request/) | Clima complementario consultado solo desde el servidor (`GET /v1/climate/meteomatics`): `t_max_2m_24h:C`, `t_min_2m_24h:C`, `precip_24h:mm`, modelo `mix` por defecto, días UTC. Es un producto modelado/mezclado distinto de NASA. Etiquetar fecha de consulta y fuente, sin usarlo como insumo imprescindible de la comparación. El acceso promocional puede expirar. |
| Entrada de suelo y prioridades | Captura de la persona usuaria o ficha de demo explícitamente hipotética. Textura, drenaje y prácticas de manejo relevantes pueden quedar desconocidos. |

Muestra de conectividad: [serie NASA POWER de siete días](../data/samples/power-san-miguel-2024-05.json). Es un subconjunto manual de valores de un punto aproximado en San Miguel, para verificar el parseo. Una semana histórica aislada es insuficiente para una referencia estacional.

La vista «El clima» muestra la temperatura de Meteomatics y el pronóstico de las próximas 24 horas para la cabecera seleccionada. Incluye hora local de validez. La comparación de cultivos se apoya en el historial de NASA POWER y las reglas documentadas abajo. [Documentación de Meteomatics](https://www.meteomatics.com/en/api/getting-started/).

## Ingesta y calidad

1. Elige un sitio y ventana de referencia con ciencia y dirección. Conserva las fechas y ventanas iguales para los escenarios comparados.
2. Guarda URL/consulta, producto, versión, fecha de acceso en UTC, coordenadas y convención de orden, unidades, escala, estándar temporal, cobertura, flags, transformación y hash en el manifiesto junto al dato reproducible.
3. Conserva el dato bruto cuando se pueda redistribuir. Normaliza sin perder unidades, sustituye códigos de relleno por datos faltantes y calcula cobertura como días válidos/esperados. Diferencia un día sin lluvia de un día sin dato. Verifica cómo pasar de la tasa a un acumulado del intervalo según los metadatos del producto.
4. Prueba temprano una consulta y guarda una copia verificable. Si se usa caché, indica fecha y fuente. Un fallo de red debe mostrar datos disponibles etiquetados o un estado sin datos.

## Método implementado (`yago-reglas-0.2.0`)

El cálculo vive en `services/api/app/`: `power.py` (clima), `evidence.py` (valores y fuentes), `rules.py` (reglas) y `compare.py` (respuesta y motivos). No usa modelos generativos. `explain.py` solo redacta el resultado ya calculado.

### Clima histórico: NASA POWER

- **Consulta:** API diaria de POWER, comunidad AG, parámetros `PRECTOTCORR` (mm/día) y `T2M_MAX` (°C), para el punto aproximado de la zona. Fuentes declaradas por la API: MERRA-2 / POWER; tiempo solar local; relleno −999. Celda de unos 50 km (0.5° × 0.625°): zonas vecinas pueden compartir cifras.
- **Periodo:** los 10 últimos años con época lluviosa completa, de mayo a octubre (hoy, 2016–2025).
- **Indicadores:** lluvia media de mayo a octubre; temperatura máxima media; y número de años en que julio y agosto tuvieron una racha de 5 o más días seguidos con menos de 1 mm.
- **Calidad:** un año cuenta si tiene al menos 95 % de días válidos de mayo a octubre y ninguno faltante en julio y agosto. Un valor de relleno es dato faltante, nunca lluvia cero. Con menos de 5 años válidos el clima queda `unavailable`.
- **Copias:** cada respuesta se guarda en `services/api/.cache/power/` (ignorado por Git) con su fecha de consulta. Si POWER falla se usa esa copia etiquetada. La muestra de una semana del repositorio solo se usa para su propio punto (San Miguel) y deja el agua sin valorar.

### Valores con fuente (leídos el 2026-11-15)

| Valor usado | Fuente, año y lugar |
| --- | --- |
| Ky de la temporada: maíz 1.25, frijol 1.15, sorgo 0.9 | FAO-56 (1998), cap. 8, cuadro 24, tomado de FAO-33. FAO-66 (2012), cuadro 1, pp. 6–7, con la lectura «Ky > 1 muy sensible al déficit de agua; Ky < 1 más tolerante». Valores generales, no medidos en El Salvador. |
| Día seco: menos de 1 mm en 24 h. Sequía meteorológica débil: 5 a 10 días secos consecutivos; moderada: 11 a 15; fuerte: más de 15 | MARN, página «Sequía meteorológica» y «Resumen climatológico – julio 2023», p. 5. |
| Agua disponible típica: arena 0.05–0.11 m³/m³; franco 0.13–0.18; arcilla 0.12–0.20 | FAO-56 (1998), cap. 7, cuadro 19. |
| Maíz: al menos 500 a 700 mm de lluvia bien distribuida; «muy sensible… al aniego o encharcamiento» | CENTA, Guía técnica del cultivo de maíz (2018), p. 8. |
| Frijol: consumo promedio de 228 mm en el ciclo; «no tolera… acumulación de agua»; fija nitrógeno; rotación con cultivos no hospederos contra enfermedades | CENTA, Guía técnica del cultivo de frijol (2018), pp. 15, 16, 9 y 30. |
| Sorgo: 550 mm en el ciclo; «muy tolerante a la sequía» | CENTA, Guía técnica del cultivo del sorgo (2018), pp. 8 y 15. |
| Sorgo «relatively tolerant to short periods of waterlogging»; maíz «susceptible to waterlogging» | FAO Land & Water, Crop Information (copias archivadas; la página original ya no está en línea). |
| La rotación evita que plagas y enfermedades de un cultivo pasen al siguiente y aumenta la fijación de nitrógeno | FAO, Conservation Agriculture, «Species diversification». |

Las páginas oficiales ofrecen las guías de [maíz](https://www.centa.gob.sv/download/guia-tecnica-cultivo-de-maiz/), [frijol](https://www.centa.gob.sv/download/guia-tecnica-cultivo-de-frijol/) y [sorgo](https://www.centa.gob.sv/download/guia-tecnica-cultivo-de-sorgo/). Las páginas y cifras de las guías de 2018 proceden de copias archivadas y quedan pendientes de cotejo con los PDF originales. Para el encharcamiento, [CENTA, Recomendaciones para mitigar exceso de humedad (2024)](https://www.centa.gob.sv/recomendaciones-para-mitigar-exceso-de-humedad-en-cultivos/) confirma la necesidad de drenaje en sus secciones de maíz, frijol y sorgo. Esta publicación no compara tolerancias.

La comparación conserva el promedio de lluvia de mayo a octubre como dato histórico. El criterio de agua usa la frecuencia de rachas secas y la sensibilidad del cultivo. El acumulado regional de toda la época, por sí solo, no permite saber si alcanzará el agua durante un ciclo específico en una parcela.

### Reglas

| Criterio | Regla | Respaldo |
| --- | --- | --- |
| Falta de lluvia de la zona | Proporción de años con racha seca en julio–agosto: menos de 20 % baja, de 20 % a menos de 50 % media, 50 % o más alta. Suelo arenoso sube un nivel. | Racha y día seco: MARN. Dato: NASA POWER. Arena: FAO-56. **Los cortes de 20 % y 50 % son supuestos ilustrativos.** |
| Agua | Cultivo tolerante (Ky < 1): ayuda en cualquier nivel. Sensible (Ky de 1 a menos de 1.2): ayuda / regular / en contra. Muy sensible (Ky ≥ 1.2): regular / en contra / en contra. Sin historia climática: indeterminado. | Ky: FAO. **El corte de 1.2 y la tabla de niveles son supuestos ilustrativos.** |
| Suelo | Repetir el cultivo: en contra. Cambiar entre cereales: regular. Alternar cereal y leguminosa: ayuda. Terreno que se encharca con maíz o frijol: en contra y la opción no puede destacarse. | Rotación: FAO y CENTA. Encharcamiento: CENTA y FAO. **La escala 0–1–2 es un supuesto ilustrativo.** |
| Diversificación | Mismo cultivo 0, misma familia 1, otra familia 2. | Conteo de familias botánicas. Es un proxy de diversidad, no una medición. |
| Orden | Manda la prioridad principal; la segunda y la tercera solo desempatan (pesos 9, 3, 1). Un criterio sin dato vale como «regular». A igualdad total se prefiere una alternativa. | **Supuesto ilustrativo del método.** |

Lo que las fuentes **no** respaldan y por eso las reglas no afirman: que el frijol sea más sensible al encharcamiento que el maíz (ambos se tratan igual) y que repetir un cultivo dañe el suelo (solo se dice que se pierde el beneficio de rotar). «No sé» en textura o drenaje no penaliza: se lista como dato por confirmar.

### Explicación con Groq

- Solo desde FastAPI, con `GROQ_API_KEY`, `GROQ_MODEL` (por defecto `openai/gpt-oss-120b`) y `GROQ_REASONING_EFFORT` (por defecto `high`). Salida estructurada `json_schema` estricta; si no se cumple se reintenta en modo JSON.
- El modelo razona antes de escribir, con instrucciones para revisar las respuestas de la persona, por qué destaca una opción frente a las otras, qué dato de NASA pesa y qué riesgo importa. Recibe los motivos de las tres opciones y las cifras de la época lluviosa.
- Groq reserva del límite por minuto los tokens máximos de cada respuesta (la cuenta actual tiene 8 000 por minuto y 1 000 consultas por día). Si no hay cupo, se vuelve a pedir pensando menos (`high` → `medium` → `low`) en lugar de abandonar; en el nivel más liviano espera una vez hasta 20 s si Groq lo pide.
- El modelo recibe un resumen corto: respuestas, dato climático, valoraciones, motivos, lo que falta confirmar y los nombres de las fuentes. Devuelve cuatro textos: qué considerar, qué pesó, precaución y qué verificar.
- Validación: forma y longitud de cada campo, sin enlaces, y ninguna cifra que no venga en el resumen. Si algo falla, cada llamada tarda más de 40 s, el total pasa de 60 s o se agota el límite (HTTP 429), se usa la explicación breve del backend y se indica la causa.
- Los cultivos, las cifras, las fuentes y las valoraciones no cambian con o sin el modelo (hay una prueba que lo comprueba). La clave no se registra ni llega al cliente.

## Diseño del cálculo (criterios que guían el método)

- Comparar la misma ubicación y periodo de referencia para una secuencia actual y alternativas. Calcular, por ejemplo, precipitación de una ventana, rachas de días secos y días sobre un umbral térmico **solo si** se han definido umbrales defendibles y el porcentaje válido es suficiente. Documenta el mínimo de cobertura adoptado.
- Definir reglas para agua, salud de suelo y diversificación con versión y referencia. Explica qué insumo activa cada riesgo o ventaja. Un proxy de diversidad de familias o cobertura no equivale a una medición de fertilidad. Si hay una restricción fuerte como drenaje desconocido, exprésala como tal y deja el criterio en indeterminado cuando corresponda.
- Prioridades de usuario ordenan criterios o ponderan solo criterios evaluables. Si se usa un puntaje, exponer escala, fórmula, pesos, tratamiento de faltantes y sensibilidad a cambiar prioridades. Evita falsa precisión y empates arbitrarios.
- Sin validación local, la salida es una exploración reproducible para conversar con un técnico. No mostrar predicciones de rendimiento, garantías ni un plan agronómico prescriptivo.

## Matriz de verificación mínima

| Caso | Esperado |
| --- | --- |
| Relleno o un día faltante | No se cuenta como lluvia cero; cambia la cobertura |
| Mismo lugar, climático disponible vs ausente | La métrica o alerta cambia a indeterminada con una explicación |
| Cambiar prioridad con las mismas fuentes | Puede cambiar orden o interpretación; las observaciones y métricas brutas permanecen |
| Suelo desconocido o escenario fuera de la región validada | Límite visible con el dato que ayudaría |
| Ejemplo rehecho a mano por otra persona | Coinciden unidades, valores agregados y motivos |
