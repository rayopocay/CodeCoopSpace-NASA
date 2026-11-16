import json

import httpx

from app.explain import ExplanationText, GroqExplainer
from tests.helpers import Recorder

FACTS = {"respuestas": {"zona": "San Miguel"}, "clima_historico": {"dato": "3 de 10 años (2016–2025) con 5 o más días secos"}}
FALLBACK = ExplanationText(
    consider="Para diversificar, vale la pena considerar Maicillo → Frijol.",
    influence="Pesó lo que usted eligió como más importante.",
    caution="El frijol pierde más cosecha cuando falta agua.",
    verify="Antes de sembrar confirme la textura de su tierra.",
)
GOOD = {
    "consider": "Para diversificar, le conviene pensar en sembrar frijol después del maicillo.",
    "influence": "Pesó que en 3 de 10 años hubo rachas de 5 días casi sin lluvia.",
    "caution": "El frijol sufre más cuando falta agua, así que cuide la humedad.",
    "verify": "Antes de sembrar, confirme cómo es su tierra y hable con un técnico.",
}
KEY = "gsk_clave-de-prueba"


def groq_response(content) -> httpx.Response:
    body = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
    return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": body}}]})


def explainer(handler, **kwargs) -> tuple[GroqExplainer, Recorder]:
    recorder = Recorder(handler)
    return GroqExplainer(kwargs.pop("api_key", KEY), "openai/gpt-oss-20b", transport=httpx.MockTransport(recorder), **kwargs), recorder


def test_without_key_the_backend_explanation_is_used_and_no_request_is_made():
    client, recorder = explainer(lambda request: groq_response(GOOD), api_key="")

    result = client.explain(FACTS, "es", FALLBACK)

    assert (result.source, result.fallbackReason, result.model) == ("rules", "not_configured", None)
    assert result.consider == FALLBACK.consider
    assert recorder.requests == []


def test_valid_structured_answer_is_returned_as_groq():
    client, recorder = explainer(lambda request: groq_response(GOOD))

    result = client.explain(FACTS, "es", FALLBACK)

    assert (result.source, result.model, result.fallbackReason) == ("groq", "openai/gpt-oss-20b", None)
    assert result.caution == GOOD["caution"]
    request = recorder.requests[0]
    assert request.headers["authorization"] == f"Bearer {KEY}"
    payload = json.loads(request.content)
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    # El modelo solo recibe el resumen de hechos, nunca la clave.
    assert json.loads(payload["messages"][1]["content"]) == FACTS
    assert KEY not in request.content.decode()
    assert KEY not in result.model_dump_json()


def test_identical_request_is_answered_from_cache():
    client, recorder = explainer(lambda request: groq_response(GOOD))

    client.explain(FACTS, "es", FALLBACK)
    client.explain(FACTS, "es", FALLBACK)
    client.explain(FACTS, "en", FALLBACK)

    assert len(recorder.requests) == 2


def test_rate_limit_falls_back_to_the_backend_explanation():
    waits: list[float] = []
    client, recorder = explainer(lambda request: httpx.Response(429, headers={"retry-after": "7"}, json={"error": {"message": "limit"}}), sleep=waits.append)

    result = client.explain(FACTS, "es", FALLBACK)

    assert (result.source, result.fallbackReason) == ("rules", "rate_limited")
    assert result.verify == FALLBACK.verify
    # It tried thinking less at each level, then waited what Groq asked once on the lightest.
    assert [json.loads(request.content).get("reasoning_effort") for request in recorder.requests] == ["high", "medium", "low", "low"]
    assert waits == [7.0]


def test_no_room_this_minute_asks_again_thinking_less():
    answers = iter([httpx.Response(429, headers={"retry-after": "25"}, json={"error": {"message": "limit"}}), groq_response(GOOD)])
    waits: list[float] = []
    client, recorder = explainer(lambda request: next(answers), sleep=waits.append)

    result = client.explain(FACTS, "es", FALLBACK)

    assert (result.source, waits) == ("groq", [])
    sent = [json.loads(request.content) for request in recorder.requests]
    assert [(body["reasoning_effort"], body["max_completion_tokens"]) for body in sent] == [("high", 6000), ("medium", 4500)]


def test_reasoning_models_are_asked_to_think():
    client, recorder = explainer(lambda request: groq_response(GOOD))

    client.explain(FACTS, "es", FALLBACK)

    assert json.loads(recorder.requests[0].content)["reasoning_effort"] == "high"


def test_timeout_falls_back():
    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("lento", request=request)

    client, _ = explainer(slow)

    assert client.explain(FACTS, "es", FALLBACK).fallbackReason == "timeout"


def test_provider_error_falls_back_without_leaking_the_key(caplog):
    client, _ = explainer(lambda request: httpx.Response(500, json={"error": {"message": "boom"}}))

    with caplog.at_level("WARNING"):
        result = client.explain(FACTS, "es", FALLBACK)

    assert result.fallbackReason == "provider_error"
    assert KEY not in caplog.text


def test_output_that_is_not_the_schema_is_discarded():
    for content in ("no es json", {"consider": "solo un campo que no alcanza"}, {**GOOD, "verify": "x"}, {**GOOD, "caution": "Vea https://ejemplo.com para más."}):
        client, _ = explainer(lambda request, content=content: groq_response(content))

        assert client.explain(FACTS, "es", FALLBACK).fallbackReason == "invalid_output"


def test_figures_the_backend_did_not_send_are_discarded():
    invented = {**GOOD, "influence": "Pesó que en 7 de 10 años hubo rachas secas y cayeron 950 mm de lluvia."}
    client, _ = explainer(lambda request: groq_response(invented))

    result = client.explain(FACTS, "es", FALLBACK)

    assert (result.source, result.fallbackReason) == ("rules", "invalid_output")


def test_model_without_strict_schema_is_retried_in_json_mode():
    def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["response_format"]["type"] == "json_schema":
            return httpx.Response(400, json={"error": {"message": "json_schema not supported"}})
        return groq_response(GOOD)

    client, recorder = explainer(handler)

    result = client.explain(FACTS, "es", FALLBACK)

    assert result.source == "groq"
    assert [json.loads(request.content)["response_format"]["type"] for request in recorder.requests] == ["json_schema", "json_object"]
