"""Explicación en lenguaje sencillo del resultado ya calculado.

Groq se llama solo desde el servidor. El modelo recibe un resumen corto de las
respuestas, los datos, las valoraciones y las fuentes permitidas, y redacta:
no elige cultivos ni aporta cifras. Su salida se valida; ante cualquier fallo
se devuelve la explicación breve que arma el propio backend.
"""

import hashlib
import json
import logging
import os
import re
import threading
import time
from collections.abc import Callable
from typing import Literal

import httpx
from pydantic import BaseModel, ValidationError, field_validator

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"
# How much the model reasons before answering (models that support it: GPT-OSS, Qwen).
DEFAULT_REASONING_EFFORT = "high"
REASONING_MODELS = ("openai/gpt-oss", "qwen/")
# From deepest to lightest reasoning. When Groq has no room left this minute, the next level is tried.
EFFORT_LADDER = ("high", "medium", "low")
# Room for the reasoning plus the four texts, per level. Groq reserves it from the per-minute limit.
MAX_COMPLETION_TOKENS = {"high": 6000, "medium": 4500, "low": 2200}
DEFAULT_COMPLETION_TOKENS = 1500
TIMEOUT_SECONDS = 40.0
# The whole explanation, retries included, fits in this time (the app waits up to 75 s).
TOTAL_BUDGET_SECONDS = 60.0
# On the lightest level, if Groq asks to wait this long or less, wait once and try again.
MAX_RETRY_WAIT_SECONDS = 20.0
CACHE_TTL_SECONDS = 60 * 60
CACHE_MAX_ENTRIES = 256
MAX_FIELD_CHARS = 480

logger = logging.getLogger("yago.explain")

Lang = Literal["es", "en"]
FallbackReason = Literal["not_configured", "timeout", "rate_limited", "provider_error", "invalid_output"]

FIELDS = ("consider", "influence", "caution", "verify")
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


class ExplanationText(BaseModel):
    """Lo único que puede escribir el modelo: cuatro frases cortas."""

    consider: str
    influence: str
    caution: str
    verify: str

    @field_validator(*FIELDS)
    @classmethod
    def _short_plain_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not 15 <= len(value) <= MAX_FIELD_CHARS:
            raise ValueError("length")
        if "http" in value.lower() or "www." in value.lower():
            raise ValueError("links are not allowed")
        return value


class Explanation(ExplanationText):
    source: Literal["groq", "rules"]
    model: str | None = None
    # Por qué no se usó Groq cuando `source` es "rules".
    fallbackReason: FallbackReason | None = None


JSON_SCHEMA = {
    "type": "object",
    "properties": {field: {"type": "string"} for field in FIELDS},
    "required": list(FIELDS),
    "additionalProperties": False,
}

SYSTEM_PROMPT = {
    "es": (
        "Usted es un técnico agrícola salvadoreño con muchos años acompañando a familias que siembran maíz, "
        "frijol y maicillo. Va a explicarle a UNA persona agricultora el resultado de una comparación de rotaciones "
        "que Yago YA calculó con reglas y con la lluvia histórica de NASA para su zona.\n"
        "Antes de escribir, piense con calma y en orden:\n"
        "1. Qué respondió esta persona: su zona, lo que siembra hoy, cómo es su tierra, si se le encharca y qué le importa más.\n"
        "2. Por qué destaca la opción destacada frente a las otras dos. Mire si alguna quedó descartada por una respuesta suya "
        "(por ejemplo, que el terreno se encharca) y qué valoración perdió cada una.\n"
        "3. Qué dice la lluvia de NASA de su zona y cómo pesa en lo que conviene.\n"
        "4. Cuál es el riesgo más importante de la opción destacada y qué tendría que revisar en su terreno.\n"
        "Después escriba algo propio para ESTA persona: nombre su zona, su cultivo y sus respuestas, compare con las otras "
        "opciones y no copie tal cual los motivos del JSON; dígalos con sus palabras.\n"
        "Reglas que no se pueden romper:\n"
        "- Use solo hechos del JSON. No invente cultivos, cifras, fechas, fuentes, dosis ni productos. Todo número que escriba debe estar en el JSON.\n"
        "- No cambie cuál opción destaca ni las valoraciones. No prometa cosechas ni pronostique el clima.\n"
        "- Si la opción destacada es solo la menos desfavorable, o es seguir con lo mismo, dígalo con honestidad y explique qué lo impidió.\n"
        "- Español de El Salvador, trato de usted, cálido y sencillo. Puede usar palabras de aquí como milpa, invierno "
        "(la época de lluvia), canícula, aguacero o terreno. Sin tecnicismos: si menciona el factor Ky, explíquelo en palabras.\n"
        "- Sin listas, sin enlaces y sin formato.\n"
        "Devuelva un objeto JSON con exactamente estos campos:\n"
        "consider (máximo 260 caracteres): qué opción vale la pena considerar para lo que más le importa y por qué, frente a las otras.\n"
        "influence (máximo 380 caracteres): qué respuesta suya o qué dato de la lluvia de su zona pesó más y cómo cambió el resultado.\n"
        "caution (máximo 380 caracteres): la precaución más importante con esa opción, dicha de forma práctica.\n"
        "verify (máximo 380 caracteres): qué confirmar antes de sembrar, empezando por lo de 'falta_confirmar', y que lo converse con un técnico de su zona."
    ),
    "en": (
        "You are an extension agent from El Salvador with many years working with families who grow maize, beans and "
        "sorghum. You will explain to ONE farmer the result of a crop rotation comparison that Yago has ALREADY "
        "calculated with rules and with NASA rain history for their area.\n"
        "Before writing, think calmly and in order:\n"
        "1. What this person answered: their area, what they grow today, their soil, whether it waterlogs and what matters most.\n"
        "2. Why the highlighted option stands out against the other two. Check whether one was ruled out by one of their "
        "answers (for example, land that waterlogs) and which rating each one lost.\n"
        "3. What the NASA rain history of their area says and how it weighs in.\n"
        "4. The most important risk of the highlighted option and what to check on their land.\n"
        "Then write something specific for THIS person: name their area, their crop and their answers, compare with the "
        "other options and do not copy the reasons in the JSON word for word; put them in your own words.\n"
        "Rules you cannot break:\n"
        "- Use only facts in the JSON. Do not invent crops, figures, dates, sources, doses or products. Every number you write must be in the JSON.\n"
        "- Do not change which option stands out or the ratings. Do not promise harvests or forecast the weather.\n"
        "- If the highlighted option is only the least unfavourable, or is to keep doing the same, say so honestly and explain what prevented a better one.\n"
        "- Plain, warm English. No jargon: if you mention the Ky factor, explain it in words.\n"
        "- No lists, links or formatting.\n"
        "Return a JSON object with exactly these fields:\n"
        "consider (at most 260 characters): which option is worth considering for what matters most and why, against the others.\n"
        "influence (at most 380 characters): which of their answers or which fact about their area's rain weighed most and how it changed the result.\n"
        "caution (at most 380 characters): the most important caution about that option, said in a practical way.\n"
        "verify (at most 380 characters): what to confirm before sowing, starting with 'still_to_confirm', and that they talk it over with a local extension agent."
    ),
}


def _numbers(text: str) -> set[float]:
    return {float(match.replace(",", ".")) for match in NUMBER.findall(text)}


def _retry_after(response: httpx.Response) -> float | None:
    """Seconds Groq asks to wait before trying again, if it says so."""
    try:
        return max(0.0, float(response.headers.get("retry-after", "")))
    except ValueError:
        return None


def invented_numbers(text: ExplanationText, facts: dict) -> set[float]:
    """Cifras que el modelo escribió y que no están en los hechos que recibió."""
    allowed = _numbers(json.dumps(facts, ensure_ascii=False))
    written = _numbers(" ".join(getattr(text, field) for field in FIELDS))
    return written - allowed


class GroqExplainer:
    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        *,
        url: str = GROQ_URL,
        transport: httpx.BaseTransport | None = None,
        timeout: float = TIMEOUT_SECONDS,
        cache_ttl: float = CACHE_TTL_SECONDS,
        clock: Callable[[], float] = time.monotonic,
        reasoning_effort: str = DEFAULT_REASONING_EFFORT,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._api_key = api_key
        self._model = model or DEFAULT_MODEL
        self._reasoning_effort = reasoning_effort or DEFAULT_REASONING_EFFORT
        self._sleep = sleep
        self._url = url
        self._transport = transport
        self._timeout = timeout
        self._cache_ttl = cache_ttl
        self._clock = clock
        self._cache: dict[str, tuple[float, ExplanationText]] = {}
        self._lock = threading.Lock()

    @classmethod
    def from_env(cls) -> "GroqExplainer":
        return cls(
            os.environ.get("GROQ_API_KEY", "").strip(),
            os.environ.get("GROQ_MODEL", "").strip() or DEFAULT_MODEL,
            reasoning_effort=os.environ.get("GROQ_REASONING_EFFORT", "").strip() or DEFAULT_REASONING_EFFORT,
        )

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    @property
    def model(self) -> str:
        return self._model

    @property
    def reasoning_effort(self) -> str | None:
        return self._reasoning_effort if self._model.startswith(REASONING_MODELS) else None

    def explain(self, facts: dict, language: Lang, fallback: ExplanationText) -> Explanation:
        """Explicación de Groq si llega válida y a tiempo; si no, la del backend con la causa."""

        def from_rules(reason: FallbackReason) -> Explanation:
            return Explanation(source="rules", fallbackReason=reason, **fallback.model_dump())

        if not self.configured:
            return from_rules("not_configured")

        key = hashlib.sha256(json.dumps([self._model, self.reasoning_effort, language, facts], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        with self._lock:
            cached = self._cache.get(key)
        if cached and self._clock() - cached[0] < self._cache_ttl:
            return Explanation(source="groq", model=self._model, **cached[1].model_dump())

        text, reason = self._ask(facts, language)
        if text is None:
            return from_rules(reason or "provider_error")
        with self._lock:
            if len(self._cache) >= CACHE_MAX_ENTRIES:
                self._cache.pop(next(iter(self._cache)))
            self._cache[key] = (self._clock(), text)
        return Explanation(source="groq", model=self._model, **text.model_dump())

    def _efforts(self) -> list[str | None]:
        """Reasoning levels to try, from the configured one down to the lightest."""
        if not self.reasoning_effort:
            return [None]
        start = EFFORT_LADDER.index(self.reasoning_effort) if self.reasoning_effort in EFFORT_LADDER else 0
        return list(EFFORT_LADDER[start:])

    def _payload(self, facts: dict, language: Lang, structured: bool, effort: str | None = None) -> dict:
        payload: dict = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT[language]},
                {"role": "user", "content": json.dumps(facts, ensure_ascii=False)},
            ],
            # A little variety in the wording; the facts and the ratings do not change.
            "temperature": 0.7,
            # Groq reserves this many tokens of the per-minute limit up front, so it grows only with the reasoning.
            "max_completion_tokens": MAX_COMPLETION_TOKENS.get(effort or "", DEFAULT_COMPLETION_TOKENS),
        }
        if effort:
            payload["reasoning_effort"] = effort
        if structured:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "rotation_explanation", "strict": True, "schema": JSON_SCHEMA},
            }
        else:
            # Modo JSON simple para modelos sin esquema estricto; la validación la hace el backend.
            payload["response_format"] = {"type": "json_object"}
        return payload

    def _ask(self, facts: dict, language: Lang) -> tuple[ExplanationText | None, FallbackReason | None]:
        """Asks with the deepest reasoning first. If Groq has no room left this minute, or the answer
        runs out of space, it asks again thinking a little less instead of giving up."""
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        deadline = self._clock() + TOTAL_BUDGET_SECONDS
        reason: FallbackReason = "provider_error"
        efforts = self._efforts()
        try:
            with httpx.Client(timeout=self._timeout, transport=self._transport) as client:
                for position, effort in enumerate(efforts):
                    lighter_left = position < len(efforts) - 1
                    response = client.post(self._url, headers=headers, json=self._payload(facts, language, True, effort))
                    if response.status_code == 429:
                        reason = "rate_limited"
                        wait = _retry_after(response)
                        if lighter_left:
                            logger.info("Groq no tiene cupo este minuto; se reintenta pensando menos.")
                            continue
                        if wait is None or wait > MAX_RETRY_WAIT_SECONDS or self._clock() + wait > deadline:
                            logger.warning("Groq llegó al límite de uso; se usa la explicación del backend.")
                            return None, "rate_limited"
                        logger.info("Groq pidió esperar %.0f s por el límite de uso; se reintenta una vez.", wait)
                        self._sleep(wait)
                        response = client.post(self._url, headers=headers, json=self._payload(facts, language, True, effort))
                        if response.status_code == 429:
                            logger.warning("Groq llegó al límite de uso; se usa la explicación del backend.")
                            return None, "rate_limited"
                    if response.status_code == 400:
                        # The strict schema was not met (often the reasoning used up the space): try plain JSON mode.
                        response = client.post(self._url, headers=headers, json=self._payload(facts, language, False, effort))
                    if response.status_code != 200:
                        # Solo el código: el cuerpo o las cabeceras no se registran.
                        logger.warning("Groq respondió HTTP %s.", response.status_code)
                        reason = "rate_limited" if response.status_code == 429 else "provider_error"
                        if lighter_left and self._clock() < deadline:
                            continue
                        return None, reason

                    text, invalid = self._read(response, facts)
                    if text is not None:
                        return text, None
                    reason = invalid
                    if not (lighter_left and self._clock() < deadline):
                        return None, reason
        except httpx.TimeoutException:
            logger.warning("Groq no respondió a tiempo; se usa la explicación del backend.")
            return None, "timeout"
        except httpx.HTTPError as error:
            logger.warning("Groq falló (%s); se usa la explicación del backend.", type(error).__name__)
            return None, "provider_error"
        return None, reason

    @staticmethod
    def _read(response: httpx.Response, facts: dict) -> tuple[ExplanationText | None, FallbackReason]:
        try:
            content = response.json()["choices"][0]["message"]["content"]
            text = ExplanationText.model_validate(json.loads(content))
        except (ValueError, KeyError, IndexError, TypeError, ValidationError):
            logger.warning("La salida de Groq no pasó la validación.")
            return None, "invalid_output"
        if invented_numbers(text, facts):
            logger.warning("La salida de Groq trae cifras que no vienen del backend; se descarta.")
            return None, "invalid_output"
        return text, "invalid_output"
