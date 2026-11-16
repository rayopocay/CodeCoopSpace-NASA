"""Arma la respuesta de `POST /v1/compare` a partir de las reglas y los datos.

Aquí no se decide nada nuevo: se llama a `rules.py`, se redacta el motivo de
cada valoración en el idioma pedido y se enlaza cada motivo con su fuente.
"""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app import rules
from app.evidence import CROP_FACTS, SOURCES
from app.explain import Explanation, ExplanationText, Lang
from app.power import DRY_DAY_MM, DRY_SPELL_DAYS, PowerClimate, YearSummary
from app.rules import Drainage, Level, Priority, Stress, Texture
from app.sites import CROPS, CropId, Site

PRIORITIES: tuple[Priority, ...] = ("water", "soil", "diversification")


# --- Contrato ---------------------------------------------------------------
class Soil(BaseModel):
    texture: Texture = "unknown"
    drainage: Drainage = "unknown"


class CompareRequest(BaseModel):
    siteId: str
    currentCrop: CropId
    soil: Soil = Soil()
    priorities: list[Priority]

    @field_validator("priorities")
    @classmethod
    def _three_distinct(cls, value: list[Priority]) -> list[Priority]:
        if sorted(value) != sorted(PRIORITIES):
            raise ValueError("priorities debe traer water, soil y diversification una sola vez, en orden de importancia.")
        return value


class Metric(BaseModel):
    id: Literal["seasonRainMean", "drySpellYears", "tMaxMean", "precipTotal", "dryDays"]
    value: float | None
    unit: str
    # Para "k de n": el total contra el que se lee `value`.
    total: int | None = None
    # Qué significa la cifra, ya en el idioma pedido.
    label: str
    reason: str | None = None
    sourceId: str


class Period(BaseModel):
    start: str
    end: str


class Coverage(BaseModel):
    validDays: int
    expectedDays: int


class Alert(BaseModel):
    priority: Priority
    text: str


class Climate(BaseModel):
    status: Literal["available", "partial", "unavailable"]
    kind: Literal["season-history", "saved-sample"]
    period: Period
    periodLabel: str
    coverage: Coverage
    validYears: int
    expectedYears: int
    metrics: list[Metric]
    sourceId: str
    spatialScale: str | None
    cacheAgeHours: float | None
    stale: bool
    stress: Stress | None
    alert: Alert | None
    note: str
    # Cada época lluviosa con datos completos: lluvia total y racha seca más larga de julio y agosto.
    years: list[YearSummary] = []


class Criterion(BaseModel):
    priority: Priority
    status: Literal["evaluable", "undetermined"]
    level: Level | None
    value: float | None = None
    unit: str | None = None
    reason: str
    evidence: list[str]


class Scenario(BaseModel):
    id: str
    role: Literal["current", "alternative"]
    sequence: list[CropId]
    summary: str
    limitation: str
    missingData: str | None
    criteria: list[Criterion]
    sourceIds: list[str]
    score: int
    # true cuando una restricción fuerte impide destacarla (terreno que se encharca).
    blocked: bool


class Highlight(BaseModel):
    scenarioId: str
    priority: Priority
    reason: str


class Source(BaseModel):
    id: str
    name: str
    url: str | None
    version: str | None
    kind: Literal["nasa", "local-reference", "technical-reference", "user-input", "demo-assumption"]
    note: str


class CompareResponse(BaseModel):
    isDemo: bool
    climate: Climate
    scenarios: list[Scenario]
    highlight: Highlight
    explanation: Explanation
    sources: list[Source]
    warnings: list[str]
    methodVersion: str


# --- Texto ------------------------------------------------------------------
CROP_NAME = {
    "es": {"maize": "maíz", "bean": "frijol", "sorghum": "maicillo"},
    "en": {"maize": "maize", "bean": "beans", "sorghum": "sorghum"},
}
GOAL = {
    "es": {"water": "cuidar el agua", "soil": "proteger el suelo", "diversification": "diversificar"},
    "en": {"water": "save water", "soil": "protect the soil", "diversification": "diversify"},
}
PRIORITY_WORD = {
    "es": {"water": "agua", "soil": "suelo", "diversification": "diversificar"},
    "en": {"water": "water", "soil": "soil", "diversification": "diversifying"},
}
LEVEL_WORD = {
    "es": {"favorable": "ayuda", "neutral": "regular", "unfavorable": "en contra", None: "falta dato"},
    "en": {"favorable": "helps", "neutral": "fair", "unfavorable": "against", None: "no data"},
}
TEXTURE_WORD = {
    "es": {"sandy": "arenosa", "loam": "franca", "clay": "arcillosa", "unknown": "no sabe"},
    "en": {"sandy": "sandy", "loam": "loam", "clay": "clay", "unknown": "not sure"},
}
DRAINAGE_WORD = {
    "es": {"good": "el agua se va rápido", "poor": "se encharca", "unknown": "no sabe"},
    "en": {"good": "drains fast", "poor": "waterlogs", "unknown": "not sure"},
}
MONTHS = {
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}


def tr(lang: Lang, es: str, en: str) -> str:
    return es if lang == "es" else en


def crop(lang: Lang, crop_id: CropId) -> str:
    return CROP_NAME[lang][crop_id]


def verb(crop_id: CropId, singular: str, plural: str) -> str:
    """Concordancia en inglés: "beans" va en plural."""
    return plural if crop_id == "bean" else singular


def sequence_text(lang: Lang, sequence: list[CropId]) -> str:
    return " → ".join(crop(lang, item).capitalize() for item in sequence)


def first_sentence(text: str) -> str:
    head, separator, _ = text.partition(". ")
    return head + "." if separator else text


def number(value: float) -> str:
    return f"{value:g}"


def period_label(lang: Lang, climate: PowerClimate) -> str:
    months = MONTHS[lang]
    if climate.kind == "saved-sample":
        if lang == "es":
            return f"{climate.start.day} al {climate.end.day} de {months[climate.start.month - 1]} de {climate.start.year}"
        return f"{months[climate.start.month - 1]} {climate.start.day}–{climate.end.day}, {climate.start.year}"
    first, last = months[climate.start.month - 1], months[climate.end.month - 1]
    if lang == "es":
        return f"{first} a {last}, {climate.start.year}–{climate.end.year}"
    return f"{first} to {last}, {climate.start.year}–{climate.end.year}"


def dry_spell_sentence(lang: Lang, climate: PowerClimate) -> str:
    count, total = climate.drySpellYears, len(climate.years)
    years = f"{climate.start.year}–{climate.end.year}"
    return tr(
        lang,
        f"En esta zona, {count} de {total} años ({years}) tuvieron {DRY_SPELL_DAYS} o más días seguidos casi sin lluvia en julio y agosto (NASA POWER).",
        f"In this area, {count} of {total} years ({years}) had {DRY_SPELL_DAYS} or more days in a row with almost no rain in July and August (NASA POWER).",
    )


# --- Criterios --------------------------------------------------------------
def water_criterion(lang: Lang, next_crop: CropId, climate: PowerClimate, soil: Soil) -> Criterion:
    facts = CROP_FACTS[next_crop]
    stress = rules.water_stress(climate, soil.texture)
    level = rules.water_level(next_crop, stress)
    name = crop(lang, next_crop)
    if level is None:
        reason = (
            tr(
                lang,
                f"Solo hay una muestra guardada de una semana ({period_label(lang, climate)}). No alcanza para saber qué tan seguido falta la lluvia, así que el agua queda sin valorar.",
                f"There is only a saved one-week sample ({period_label(lang, climate)}). It is not enough to know how often the rain fails, so water is left unrated.",
            )
            if climate.kind == "saved-sample"
            else tr(
                lang,
                "No se pudo obtener el clima histórico de NASA POWER para esta zona. Sin ese dato el agua queda sin valorar.",
                "The NASA POWER weather history for this area could not be retrieved. Without it, water is left unrated.",
            )
        )
        return Criterion(priority="water", status="undetermined", level=None, value=facts.ky, unit="Ky", reason=reason, evidence=["nasa-power"])

    tolerant = rules.drought_class(next_crop) == "tolerant"
    parts = [
        tr(
            lang,
            f"El {name} aguanta mejor la falta de agua: su factor Ky es {number(facts.ky)} (FAO; menor que 1 = tolerante)."
            if tolerant
            else f"El {name} pierde más cosecha cuando falta agua: su factor Ky es {number(facts.ky)} (FAO; mayor que 1 = sensible).",
            f"{name.capitalize()} {verb(next_crop, 'copes', 'cope')} better with a lack of water: the Ky factor is {number(facts.ky)} (FAO; below 1 = tolerant)."
            if tolerant
            else f"{name.capitalize()} {verb(next_crop, 'loses', 'lose')} more yield when water is short: the Ky factor is {number(facts.ky)} (FAO; above 1 = sensitive).",
        ),
        dry_spell_sentence(lang, climate),
    ]
    evidence = ["fao-ky", "nasa-power", "drought-definition"]
    if soil.texture == "sandy":
        parts.append(
            tr(
                lang,
                "Su tierra arenosa guarda menos agua, por eso la falta de lluvia pesa más.",
                "Your sandy soil holds less water, so a lack of rain weighs more.",
            )
        )
        evidence += ["fao-soil-water", "user-answers"]
    return Criterion(priority="water", status="evaluable", level=level, value=facts.ky, unit="Ky", reason=" ".join(parts), evidence=evidence)


def soil_criterion(lang: Lang, current: CropId, next_crop: CropId, soil: Soil) -> Criterion:
    a, b = crop(lang, current), crop(lang, next_crop)
    points = rules.rotation_points(current, next_crop)
    evidence = ["rotation-principle"]
    if points == 0:
        rotation = tr(
            lang,
            f"Repetir {b} no es una rotación: se pierde lo que da cambiar de cultivo, como cortar sus plagas y enfermedades (FAO).",
            f"Growing {b} again is not a rotation: you lose what changing crops gives, such as breaking its pests and diseases (FAO).",
        )
    elif points == 1:
        rotation = tr(
            lang,
            f"Cambia el cultivo, pero {a} y {b} son cereales: no entra una leguminosa, que es la que fija nitrógeno.",
            f"The crop changes, but {a} and {b} are both cereals: no legume comes in, and legumes are the ones that fix nitrogen.",
        )
    elif CROP_FACTS[next_crop].family == "legume":
        rotation = tr(
            lang,
            f"El frijol es leguminosa y fija nitrógeno (CENTA). Sembrarlo después de {a} es una rotación, que además corta plagas y enfermedades (FAO).",
            f"Beans are a legume and fix nitrogen (CENTA). Sowing them after {a} is a rotation, which also breaks pests and diseases (FAO).",
        )
        evidence.append("centa-guides")
    else:
        rotation = tr(
            lang,
            f"Sembrar {b} después de frijol es una rotación: CENTA recomienda rotar el frijol con otros cultivos para manejar sus enfermedades.",
            f"Sowing {b} after beans is a rotation: CENTA recommends rotating beans with other crops to manage their diseases.",
        )
        evidence.append("centa-guides")
    parts = [rotation]
    if soil.drainage == "poor":
        if next_crop == "bean":
            parts.append(
                tr(
                    lang,
                    "Su terreno se encharca y el frijol no tolera la acumulación de agua (CENTA): no conviene mientras no mejore el drenaje.",
                    "Your land waterlogs and beans do not tolerate standing water (CENTA): not advisable until drainage improves.",
                )
            )
            evidence.append("centa-guides")
        elif next_crop == "maize":
            parts.append(
                tr(
                    lang,
                    "Su terreno se encharca y el maíz es muy sensible al encharcamiento (CENTA): no conviene mientras no mejore el drenaje.",
                    "Your land waterlogs and maize is very sensitive to waterlogging (CENTA): not advisable until drainage improves.",
                )
            )
            evidence.append("centa-guides")
        else:
            parts.append(
                tr(
                    lang,
                    "Su terreno se encharca; el maicillo tolera relativamente bien un encharcamiento corto (FAO).",
                    "Your land waterlogs; sorghum is relatively tolerant to short waterlogging (FAO).",
                )
            )
            evidence.append("fao-crop-info")
        evidence.extend(["user-answers", "centa-drainage"])
    elif soil.drainage == "good":
        evidence.append("user-answers")
    return Criterion(
        priority="soil",
        status="evaluable",
        level=rules.soil_level(current, next_crop, soil.drainage),
        reason=" ".join(parts),
        evidence=list(dict.fromkeys(evidence)),
    )


def diversification_criterion(lang: Lang, current: CropId, next_crop: CropId) -> Criterion:
    a, b = crop(lang, current), crop(lang, next_crop)
    points = rules.rotation_points(current, next_crop)
    reason = [
        tr(lang, "Es el mismo cultivo: no diversifica.", "It is the same crop: it does not diversify."),
        tr(
            lang,
            f"Cambia el cultivo, pero {a} y {b} son de la misma familia (gramíneas).",
            f"The crop changes, but {a} and {b} belong to the same family (grasses).",
        ),
        tr(
            lang,
            "Cambia el cultivo y también la familia (un cereal y una leguminosa).",
            "The crop changes and so does the family (a cereal and a legume).",
        ),
    ][points]
    return Criterion(priority="diversification", status="evaluable", level=rules.diversification_level(current, next_crop), value=points, unit="0-2", reason=reason, evidence=["method-rules"])


# --- Escenarios -------------------------------------------------------------
def missing_items(lang: Lang, soil: Soil, climate: PowerClimate) -> list[str]:
    items = []
    if soil.texture == "unknown":
        items.append(tr(lang, "la textura de su tierra (cambia cuánta agua guarda)", "your soil texture (it changes how much water it holds)"))
    if soil.drainage == "unknown":
        items.append(
            tr(
                lang,
                "si su terreno se encharca (el frijol y el maíz no lo aguantan)",
                "whether your land waterlogs (beans and maize do not cope with it)",
            )
        )
    if rules.water_stress(climate, soil.texture) is None:
        items.append(tr(lang, "el clima histórico de la zona", "the weather history of the area"))
    return items


def build_scenario(lang: Lang, request: CompareRequest, next_crop: CropId, climate: PowerClimate) -> Scenario:
    current, soil = request.currentCrop, request.soil
    criteria = {
        "water": water_criterion(lang, next_crop, climate, soil),
        "soil": soil_criterion(lang, current, next_crop, soil),
        "diversification": diversification_criterion(lang, current, next_crop),
    }
    levels = {priority: criterion.level for priority, criterion in criteria.items()}
    is_current = next_crop == current
    blocked = rules.is_blocked(next_crop, soil.drainage)
    top = criteria[request.priorities[0]]

    opening = tr(
        lang,
        f"Seguir con {crop(lang, current)} otra vez." if is_current else f"Sembrar {crop(lang, next_crop)} después de {crop(lang, current)}.",
        f"Keep growing {crop(lang, current)}." if is_current else f"Sow {crop(lang, next_crop)} after {crop(lang, current)}.",
    )
    # La precaución es el criterio peor valorado, en el orden de prioridades de la persona.
    weakest = min((criteria[priority] for priority in request.priorities), key=lambda item: rules.POINTS[item.level] if item.level else rules.UNDETERMINED_POINTS)
    if blocked:
        limitation = criteria["soil"].reason.split(". ")[-1]
    elif weakest.level != "favorable":
        limitation = first_sentence(weakest.reason)
    else:
        limitation = tr(
            lang,
            "Las valoraciones describen la zona, no su parcela: confírmelas en su terreno.",
            "The ratings describe the area, not your plot: confirm them on your land.",
        )
    missing = missing_items(lang, soil, climate)
    return Scenario(
        id=f"{current}-{next_crop}",
        role="current" if is_current else "alternative",
        sequence=[current, next_crop],
        summary=f"{opening} {first_sentence(top.reason)}",
        limitation=limitation,
        missingData=(tr(lang, "Falta confirmar: ", "Still to confirm: ") + "; ".join(missing) + ".") if missing else None,
        criteria=[criteria[priority] for priority in request.priorities],
        sourceIds=list(dict.fromkeys(source for priority in request.priorities for source in criteria[priority].evidence)),
        score=rules.score(levels, request.priorities),
        blocked=blocked,
    )


def is_weak(scenario: Scenario) -> bool:
    """La opción destacada apenas es la menos desfavorable.

    Pasa cuando en la prioridad principal queda en contra, o queda regular y
    ningún otro criterio la respalda.
    """
    top = scenario.criteria[0].level
    if top == "unfavorable":
        return True
    return top != "favorable" and not any(criterion.level == "favorable" for criterion in scenario.criteria)


def pick_highlight(scenarios: list[Scenario], priorities: list[Priority]) -> Scenario:
    """Mejor opción sin restricción fuerte: manda la prioridad principal y las otras desempatan.

    Si todo queda igual, se prefiere una alternativa a repetir el cultivo.
    """
    candidates = [scenario for scenario in scenarios if not scenario.blocked] or scenarios
    return max(candidates, key=lambda scenario: (scenario.score, scenario.role == "alternative"))


# --- Clima ------------------------------------------------------------------
def build_climate(lang: Lang, climate: PowerClimate, soil: Soil, now: datetime) -> Climate:
    stress = rules.water_stress(climate, soil.texture)
    if climate.kind == "saved-sample":
        metrics = [
            Metric(id="precipTotal", value=climate.sampleRainMm, unit="mm", label=tr(lang, "de lluvia en esos días", "of rain in those days"), sourceId="nasa-power"),
            Metric(
                id="dryDays",
                value=climate.sampleDryDays,
                unit="days",
                total=climate.validDays,
                label=tr(lang, "días casi sin lluvia", "days with almost no rain"),
                sourceId="nasa-power",
            ),
            Metric(id="tMaxMean", value=climate.tMaxMeanC, unit="°C", label=tr(lang, "máxima promedio del día", "average daily high"), sourceId="nasa-power"),
        ]
        note = tr(
            lang,
            "NASA POWER no respondió ahora y para esta zona solo hay una muestra guardada de una semana. Es clima del pasado y no alcanza para valorar el agua.",
            "NASA POWER did not answer just now and for this area there is only a saved one-week sample. It is past weather and is not enough to rate water.",
        )
    else:
        no_data = tr(lang, "NASA POWER no devolvió datos para este periodo.", "NASA POWER returned no data for this period.")
        missing = None if climate.status != "unavailable" else no_data
        metrics = [
            Metric(
                id="seasonRainMean",
                value=climate.seasonRainMeanMm,
                unit="mm",
                label=tr(lang, "de lluvia por época lluviosa (mayo a octubre), en promedio", "of rain per rainy season (May to October), on average"),
                reason=missing,
                sourceId="nasa-power",
            ),
            Metric(
                id="drySpellYears",
                value=climate.drySpellYears,
                unit="years",
                total=len(climate.years) or None,
                label=tr(
                    lang,
                    f"años con {DRY_SPELL_DAYS} o más días seguidos casi sin lluvia en julio y agosto",
                    f"years with {DRY_SPELL_DAYS} or more days in a row with almost no rain in July and August",
                ),
                reason=missing,
                sourceId="nasa-power",
            ),
            Metric(
                id="tMaxMean",
                value=climate.tMaxMeanC,
                unit="°C",
                label=tr(lang, "máxima promedio del día en la época lluviosa", "average daily high in the rainy season"),
                reason=missing,
                sourceId="nasa-power",
            ),
        ]
        note = tr(
            lang,
            f"Es clima del pasado para una zona amplia, no un pronóstico ni una medición de su parcela. Día casi sin lluvia: menos de {number(DRY_DAY_MM)} mm.",
            f"This is past weather for a wide area, not a forecast or a measurement of your plot. Day with almost no rain: under {number(DRY_DAY_MM)} mm.",
        )
        if climate.stale and climate.retrievedAt:
            note = tr(
                lang,
                f"NASA POWER no respondió ahora; se usa una copia guardada el {climate.retrievedAt:%Y-%m-%d}. ",
                f"NASA POWER did not answer just now; a copy saved on {climate.retrievedAt:%Y-%m-%d} is used. ",
            ) + note

    alert = None
    if stress in ("moderate", "high"):
        text = first_sentence(dry_spell_sentence(lang, climate)).replace(tr(lang, "En esta zona, ", "In this area, "), "", 1)
        text = text[0].upper() + text[1:] + tr(
            lang,
            " Por eso, al comparar, pesa más qué tanto aguanta cada cultivo la falta de agua.",
            " That is why, when comparing, how well each crop copes with a lack of water counts more.",
        )
        if soil.texture == "sandy":
            text += tr(lang, " Su tierra arenosa lo acentúa.", " Your sandy soil makes it worse.")
        alert = Alert(priority="water", text=text)

    return Climate(
        status=climate.status,
        kind=climate.kind,
        period=Period(start=climate.start.isoformat(), end=climate.end.isoformat()),
        periodLabel=period_label(lang, climate),
        coverage=Coverage(validDays=climate.validDays, expectedDays=climate.expectedDays),
        validYears=len(climate.years),
        expectedYears=climate.end.year - climate.start.year + 1 if climate.kind == "season-history" else 0,
        metrics=metrics,
        sourceId="nasa-power",
        spatialScale=tr(lang, "Celda de unos 50 km (0.5° × 0.625°, MERRA-2)", "Cell of about 50 km (0.5° × 0.625°, MERRA-2)"),
        cacheAgeHours=round((now - climate.retrievedAt).total_seconds() / 3600, 1) if climate.stale and climate.retrievedAt else None,
        stale=climate.stale,
        stress=stress,
        alert=alert,
        note=note,
        years=climate.years,
    )


def build_sources(lang: Lang, used: set[str], climate: PowerClimate) -> list[Source]:
    version = " · ".join(filter(None, [climate.apiVersion, "/".join(climate.dataSources)])) or None
    sources = [
        Source(
            id="nasa-power",
            name="NASA POWER Daily API",
            url=climate.url,
            version=version,
            kind="nasa",
            note=tr(
                lang,
                "Lluvia (PRECTOTCORR, mm/día) y temperatura máxima (T2M_MAX, °C) diarias para el punto aproximado de la zona. Describe una celda de unos 50 km, no una parcela.",
                "Daily rain (PRECTOTCORR, mm/day) and maximum temperature (T2M_MAX, °C) for the approximate point of the area. It describes a cell of about 50 km, not a plot.",
            ),
        )
    ]
    for source_id, definition in SOURCES.items():
        if source_id in used:
            sources.append(
                Source(id=source_id, name=definition.name[lang], url=definition.url, version=definition.version, kind=definition.kind, note=definition.note[lang])
            )
    return sources


# --- Explicación ------------------------------------------------------------
def clip(text: str, limit: int = 400) -> str:
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def rules_explanation(lang: Lang, request: CompareRequest, site: Site, climate: PowerClimate, scenarios: list[Scenario], highlighted: Scenario) -> ExplanationText:
    """Explicación breve que arma el backend; también es el respaldo cuando Groq no está."""
    goal = GOAL[lang][request.priorities[0]]
    sequence = sequence_text(lang, highlighted.sequence)
    top = highlighted.criteria[0]
    if is_weak(highlighted) and highlighted.role == "current":
        # Ninguna alternativa conviene: se dice sin presentar lo actual como una buena opción.
        staying = crop(lang, request.currentCrop)
        soil_reason = next(criterion.reason for criterion in highlighted.criteria if criterion.priority == "soil")
        tolerance = f" {soil_reason.split('. ')[-1]}" if request.soil.drainage == "poor" else ""
        consider = tr(
            lang,
            f"Con sus respuestas, ninguna alternativa queda bien valorada para {goal}. Lo más prudente por ahora es seguir con {staying}.{tolerance}",
            f"With your answers, no alternative is rated well to {goal}. The safest for now is to keep growing {staying}.{tolerance}",
        )
    elif is_weak(highlighted):
        consider = tr(
            lang,
            f"Con sus respuestas, ninguna opción queda bien valorada. Para {goal}, la menos desfavorable es {sequence}. {first_sentence(top.reason)}",
            f"With your answers, no option is rated well. To {goal}, the least unfavourable is {sequence}. {first_sentence(top.reason)}",
        )
    else:
        if top.level == "favorable":
            consider = tr(lang, f"Para {goal}, vale la pena considerar {sequence}. {first_sentence(top.reason)}", f"To {goal}, {sequence} is worth considering. {first_sentence(top.reason)}")
        else:
            # La opción gana por desempate: se dice que en lo principal no destaca.
            word = LEVEL_WORD[lang][top.level]
            consider = tr(
                lang,
                f"Para {goal}, ninguna opción ayuda del todo; {sequence} queda \"{word}\" en eso y es la mejor en lo demás. {first_sentence(top.reason)}",
                f"To {goal}, no option fully helps; {sequence} is rated \"{word}\" on that and is the best on the rest. {first_sentence(top.reason)}",
            )

    blocked = [scenario for scenario in scenarios if scenario.blocked]
    stress = rules.water_stress(climate, request.soil.texture)
    blocked_names = tr(lang, " ni ", " or ").join(sequence_text(lang, scenario.sequence) for scenario in blocked)
    if blocked:
        influence = tr(
            lang,
            f"Pesó su respuesta de que el terreno se encharca: por eso no se destaca {blocked_names}.",
            f"Your answer that the land waterlogs weighed most: that is why {blocked_names} {'is' if len(blocked) == 1 else 'are'} not highlighted.",
        )
    elif request.soil.texture == "sandy" and stress:
        influence = tr(
            lang,
            "Pesó su respuesta de que la tierra es arenosa: guarda menos agua y la falta de lluvia cuenta más.",
            "Your answer that the soil is sandy weighed most: it holds less water, so a lack of rain counts more.",
        )
    elif stress:
        influence = tr(
            lang,
            f"Pesó lo que usted eligió como más importante ({goal}) y el clima del pasado de NASA. ",
            f"What you chose as most important (to {goal}) and the past weather from NASA weighed most. ",
        ) + dry_spell_sentence(lang, climate)
    else:
        influence = tr(lang, f"Pesó sobre todo lo que usted eligió como más importante: {goal}.", f"What you chose as most important weighed most: to {goal}.")

    missing = missing_items(lang, request.soil, climate)
    verify = (
        tr(lang, "Antes de sembrar confirme: ", "Before sowing, confirm: ") + "; ".join(missing) + ". "
        if missing
        else tr(lang, "Antes de sembrar, revise en su terreno que estas valoraciones se cumplen. ", "Before sowing, check on your land that these ratings hold. ")
    ) + tr(lang, "Converse también con un técnico de su zona.", "Also talk with an extension agent in your area.")
    return ExplanationText(consider=clip(consider), influence=clip(influence), caution=clip(highlighted.limitation), verify=clip(verify))


def explanation_facts(lang: Lang, request: CompareRequest, site: Site, climate: PowerClimate, scenarios: list[Scenario], highlighted: Scenario, sources: list[Source]) -> dict:
    """Resumen corto que recibe el modelo. Todo lo que puede citar está aquí."""

    def ratings(scenario: Scenario) -> dict:
        return {PRIORITY_WORD[lang][criterion.priority]: LEVEL_WORD[lang][criterion.level] for criterion in scenario.criteria}

    stress = rules.water_stress(climate, request.soil.texture)
    es = lang == "es"
    return {
        ("respuestas" if es else "answers"): {
            ("zona" if es else "area"): site.name,
            ("cultivo_actual" if es else "current_crop"): crop(lang, request.currentCrop),
            ("textura_del_suelo" if es else "soil_texture"): TEXTURE_WORD[lang][request.soil.texture],
            ("drenaje" if es else "drainage"): DRAINAGE_WORD[lang][request.soil.drainage],
            ("lo_mas_importante" if es else "top_priority"): GOAL[lang][request.priorities[0]],
            ("orden_de_importancia" if es else "priority_order"): [GOAL[lang][priority] for priority in request.priorities],
        },
        ("clima_historico" if es else "weather_history"): (
            {
                ("fuente" if es else "source"): "NASA POWER",
                ("periodo" if es else "period"): period_label(lang, climate),
                ("dato" if es else "fact"): dry_spell_sentence(lang, climate),
                ("lluvia_media_del_invierno_mm" if es else "mean_rainy_season_rain_mm"): climate.seasonRainMeanMm,
                ("lluvia_minima_y_maxima_mm" if es else "lowest_and_highest_season_rain_mm"): [climate.seasonRainMinMm, climate.seasonRainMaxMm],
                ("maxima_promedio_c" if es else "mean_daily_high_c"): climate.tMaxMeanC,
                ("falta_de_lluvia_en_la_zona" if es else "lack_of_rain_in_area"): {"low": tr(lang, "baja", "low"), "moderate": tr(lang, "media", "medium"), "high": tr(lang, "alta", "high")}[stress],
            }
            if stress
            else tr(lang, "sin historia suficiente para valorar el agua", "not enough history to rate water")
        ),
        ("opcion_destacada" if es else "highlighted_option"): {
            ("rotacion" if es else "rotation"): sequence_text(lang, highlighted.sequence),
            ("es_lo_que_ya_hace" if es else "is_current_practice"): highlighted.role == "current",
            ("valoraciones" if es else "ratings"): ratings(highlighted),
            ("motivos" if es else "reasons"): [criterion.reason for criterion in highlighted.criteria],
            ("precaucion" if es else "caution"): highlighted.limitation,
            ("es_solo_la_menos_desfavorable" if es else "is_only_the_least_unfavourable"): is_weak(highlighted),
            ("por_que_destaca" if es else "why_it_stands_out"): first_sentence(highlighted.summary),
        },
        ("otras_opciones" if es else "other_options"): [
            {
                ("rotacion" if es else "rotation"): sequence_text(lang, scenario.sequence),
                ("valoraciones" if es else "ratings"): ratings(scenario),
                ("descartada_por_encharcamiento" if es else "ruled_out_by_waterlogging"): scenario.blocked,
                ("motivos" if es else "reasons"): [criterion.reason for criterion in scenario.criteria],
                ("precaucion" if es else "caution"): scenario.limitation,
            }
            for scenario in scenarios
            if scenario.id != highlighted.id
        ],
        ("falta_confirmar" if es else "still_to_confirm"): missing_items(lang, request.soil, climate),
        ("fuentes_permitidas" if es else "allowed_sources"): [source.name for source in sources],
    }


# --- Respuesta --------------------------------------------------------------
def build_comparison(request: CompareRequest, site: Site, climate: PowerClimate, lang: Lang, explain, now: datetime | None = None) -> CompareResponse:
    """`explain(facts, lang, fallback)` devuelve la explicación final (Groq o reglas)."""
    now = now or datetime.now(UTC)
    order = [request.currentCrop] + [item for item in CROPS if item != request.currentCrop]
    scenarios = [build_scenario(lang, request, next_crop, climate) for next_crop in order]
    highlighted = pick_highlight(scenarios, request.priorities)
    top = request.priorities[0]

    used = {source for scenario in scenarios for source in scenario.sourceIds} | {"method-rules"}
    sources = build_sources(lang, used, climate)
    summary = ", ".join(f"{PRIORITY_WORD[lang][criterion.priority]}: {LEVEL_WORD[lang][criterion.level]}" for criterion in highlighted.criteria)
    name = sequence_text(lang, highlighted.sequence)
    highlight = Highlight(
        scenarioId=highlighted.id,
        priority=top,
        reason=tr(lang, f"{name} es la opción menos desfavorable ({summary})", f"{name} is the least unfavourable option ({summary})")
        if is_weak(highlighted)
        else tr(lang, f"{name} es la opción mejor valorada ({summary})", f"{name} is the best rated option ({summary})"),
    )

    warnings: list[str] = []
    if climate.kind == "saved-sample":
        warnings.append(
            tr(
                lang,
                "Modo demo: NASA POWER no respondió y se muestra una muestra histórica guardada de una semana. El agua queda sin valorar.",
                "Demo mode: NASA POWER did not answer and a saved one-week historical sample is shown. Water is left unrated.",
            )
        )
    elif climate.status == "unavailable":
        warnings.append(
            tr(
                lang,
                "No se pudo obtener el clima de NASA POWER para esta zona. El agua queda sin valorar; el resto de la comparación sigue disponible.",
                "The NASA POWER weather for this area could not be retrieved. Water is left unrated; the rest of the comparison is still available.",
            )
        )
    else:
        if climate.stale:
            warnings.append(tr(lang, "NASA POWER no respondió ahora: el clima viene de una copia guardada.", "NASA POWER did not answer just now: the weather comes from a saved copy."))
        if climate.status == "partial":
            warnings.append(
                tr(
                    lang,
                    f"Solo {len(climate.years)} de {climate.end.year - climate.start.year + 1} años tienen datos completos de NASA POWER.",
                    f"Only {len(climate.years)} of {climate.end.year - climate.start.year + 1} years have complete NASA POWER data.",
                )
            )
    missing = missing_items(lang, request.soil, climate)
    if missing:
        warnings.append(tr(lang, "Falta confirmar: ", "Still to confirm: ") + "; ".join(missing) + ".")
    warnings.append(
        tr(
            lang,
            "Cómo se ordena: manda lo que usted eligió como más importante y lo demás solo desempata. Los umbrales para clasificar la falta de lluvia son supuestos ilustrativos del método, no valores de una fuente.",
            "How options are ranked: what you chose as most important decides and the rest only breaks ties. The thresholds used to classify the lack of rain are illustrative method assumptions, not values from a source.",
        )
    )

    fallback = rules_explanation(lang, request, site, climate, scenarios, highlighted)
    facts = explanation_facts(lang, request, site, climate, scenarios, highlighted, sources)
    return CompareResponse(
        isDemo=climate.kind == "saved-sample",
        climate=build_climate(lang, climate, request.soil, now),
        scenarios=scenarios,
        highlight=highlight,
        explanation=explain(facts, lang, fallback),
        sources=sources,
        warnings=warnings,
        methodVersion=rules.METHOD_VERSION,
    )
