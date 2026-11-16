# Entrega y evaluación

## Antes de cerrar

- Confirmar que todos figuren en Members y estén confirmados para San Salvador. Abrir Project en [CodeCoop Space](https://www.spaceappschallenge.org/2026/find-a-team/codecoop-space/) y completar los campos de la [guía oficial de entrega](https://www.spaceappschallenge.org/resources/project-submission-guide/).
- Redactar en inglés la ficha y el material enlazado para evaluación global. Para el campo de demo elegir video de hasta 30 segundos o presentación de hasta 7 diapositivas, contando portada e introducción. Si el video está hablado en español, incluir subtítulos en inglés.
- Probar desde incógnito el enlace público de la demo y el de la solución final. La aplicación abre directamente, sin cuentas para agricultores ni jueces. Mantener licencias, atribuciones y referencias de datos, código e imágenes.
- Guardar cada fuente con URL, producto, fecha e impacto sobre un resultado. Distinguir NASA y fuentes locales en la pantalla y en la entrega.
- Completar la declaración de IA que pida el formulario. Anotar desde el comienzo herramientas, propósito, archivos/decisiones afectadas y revisión humana. Leer los [términos vigentes](https://www.spaceappschallenge.org/legal/).
- Mateo confirma estado de envío y guarda el enlace. La ventana oficial cierra el domingo 15 a las 11:59 p. m. hora local.

## Recorrido que queremos demostrar

1. Una familia productora considera qué sembrar después de su cultivo actual.
2. Abre un ejemplo de sitio, selecciona suelo/prioridades y elige comparar.
3. Muestra qué dato NASA afectó un criterio, qué información local respalda la comparación y qué dato tendría que comprobar la persona.
4. Cambia una prioridad para mostrar la diferencia o una entrada desconocida para mostrar la incertidumbre.

## Registro de uso de IA

| Herramienta | Uso o archivo | Evidencia o revisión humana |
| --- | --- | --- |
| Codex | Creación de base de repositorio, documentación técnica y planificación inicial | Pendiente de revisión por CodeCoop Space antes de la entrega |
| Groq (`openai/gpt-oss-120b` con razonamiento, configurable) | Componente del producto: redacta en lenguaje sencillo la explicación de «Su comparación» a partir del resultado calculado por reglas (`services/api/app/explain.py`). No elige cultivos ni aporta cifras o fuentes | Salida validada por el backend, probada con respuestas simuladas y con llamadas reales; falta revisar textos reales con el equipo |
| Devin | Cliente Meteomatics en `services/api/app/meteomatics.py`, ruta `/v1/climate/meteomatics`, pruebas y documentación (issue #14) | Pendiente de revisión por CodeCoop Space en el PR |
