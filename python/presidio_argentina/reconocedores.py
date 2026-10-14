"""Reconocedores de Microsoft Presidio para datos sensibles argentinos.

Entidades:
    AR_CUIT            CUIT / CUIL con dígito verificador válido
    AR_CBU             CBU o CVU (22 dígitos, los dos verificadores)
    AR_DNI             DNI con puntos (12.345.678) o sin puntos si dice "DNI" cerca
    AR_CBU_ALIAS       alias de CBU/CVU después de la palabra "alias"
    AR_PHONE           teléfonos argentinos (+54 9 11 ..., 011 15 ..., (0221) ...)
    AR_LICENSE_PLATE   patente Mercosur (AB 123 CD) o vieja (ABC 123) con contexto
    MERCADOPAGO_TOKEN  access token de Mercado Pago (APP_USR-... / TEST-...)
"""

from __future__ import annotations

import re
from typing import List, Optional

from presidio_analyzer import (
    AnalysisExplanation,
    LocalRecognizer,
    Pattern,
    PatternRecognizer,
    RecognizerResult,
)

from .validadores import es_cbu_valido, es_cuit_valido, es_dni_plausible

VENTANA_CONTEXTO = 40


def _contexto(texto: str, inicio: int, patron: re.Pattern) -> bool:
    return bool(patron.search(texto[max(0, inicio - VENTANA_CONTEXTO) : inicio]))


class CuitRecognizer(PatternRecognizer):
    PATTERNS = [Pattern("CUIT", r"\b(?:20|23|24|25|26|27|30|33|34)[-.\s]?\d{8}[-.\s]?\d\b", 0.5)]
    CONTEXT = ["cuit", "cuil", "cdi", "afip", "arca", "factura", "monotributo"]

    def __init__(self, supported_language: str = "es", **kwargs):
        super().__init__(
            supported_entity="AR_CUIT",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            **kwargs,
        )

    def validate_result(self, pattern_text: str) -> Optional[bool]:
        # True sube el puntaje al máximo; False descarta el resultado.
        return es_cuit_valido(pattern_text)


class CbuRecognizer(PatternRecognizer):
    PATTERNS = [Pattern("CBU/CVU", r"\b\d(?:[\s-]?\d){21}\b", 0.5)]
    CONTEXT = ["cbu", "cvu", "cuenta", "transferencia", "transferir", "banco"]

    def __init__(self, supported_language: str = "es", **kwargs):
        super().__init__(
            supported_entity="AR_CBU",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            **kwargs,
        )

    def validate_result(self, pattern_text: str) -> Optional[bool]:
        return es_cbu_valido(pattern_text)


class PhoneArRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "Teléfono con +54",
            r"(?:\+|\b)54[\s-]?9?[\s-]?\(?0?\d{2,4}\)?[\s-]?(?:15[\s-]?)?\d{3,4}[\s-]?\d{4}\b",
            0.85,
        ),
        Pattern(
            "Teléfono local",
            r"(?<![\d.,$])\(?\b0?(?:11|[2-9]\d{1,3})\)?[\s-](?:15[\s-]?)?\d{3,4}[\s-]\d{4}\b",
            0.5,
        ),
    ]
    CONTEXT = ["tel", "teléfono", "telefono", "cel", "celular", "whatsapp", "wsp", "llamar", "contacto"]

    def __init__(self, supported_language: str = "es", **kwargs):
        super().__init__(
            supported_entity="AR_PHONE",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            **kwargs,
        )


class MercadoPagoTokenRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("Access token", r"\b(?:APP_USR|TEST)-\d{10,20}-\d{6}-[a-f0-9]{32}-\d{6,12}\b", 0.99)
    ]

    def __init__(self, supported_language: str = "es", **kwargs):
        super().__init__(
            supported_entity="MERCADOPAGO_TOKEN",
            patterns=self.PATTERNS,
            supported_language=supported_language,
            global_regex_flags=re.M,
            **kwargs,
        )


class _ReconocedorConReglas(LocalRecognizer):
    """Base para reconocedores que necesitan mirar el texto alrededor o usar un grupo de captura.

    Cada regla es (nombre, regex, grupo, funcion_puntaje(valor, texto, inicio, fin) -> float | None).
    """

    ENTIDAD = ""
    REGLAS: list = []

    def __init__(self, supported_language: str = "es", **kwargs):
        super().__init__(
            supported_entities=[self.ENTIDAD],
            supported_language=supported_language,
            name=self.__class__.__name__,
            **kwargs,
        )

    def load(self) -> None:  # requerido por Presidio
        pass

    def analyze(self, text: str, entities: List[str], nlp_artifacts=None) -> List[RecognizerResult]:
        if entities and self.ENTIDAD not in entities:
            return []
        resultados = []
        for nombre, regex, grupo, puntaje in self.REGLAS:
            for m in regex.finditer(text):
                inicio, fin = m.span(grupo)
                score = puntaje(m.group(grupo), text, inicio, fin)
                if score is None:
                    continue
                resultados.append(
                    RecognizerResult(
                        entity_type=self.ENTIDAD,
                        start=inicio,
                        end=fin,
                        score=score,
                        analysis_explanation=AnalysisExplanation(
                            recognizer=self.name,
                            original_score=score,
                            pattern_name=nombre,
                            pattern=regex.pattern,
                        ),
                        recognition_metadata={
                            RecognizerResult.RECOGNIZER_NAME_KEY: self.name,
                            RecognizerResult.RECOGNIZER_IDENTIFIER_KEY: self.id,
                        },
                    )
                )
        return resultados


_CTX_DNI = re.compile(r"\b(dni|d\.n\.i\.?|documento|doc\.?|n[º°r]o\.? de doc)", re.I)
_MONEDA_ANTES = re.compile(r"\$|ars|usd", re.I)
_UNIDAD_DESPUES = re.compile(
    r"^\s*(pesos|ars|usd|d[oó]lares|m|km|kg|t|l|unidades|habitantes|personas|votos|visitas)\b", re.I
)


def _puntaje_dni_con_puntos(valor, texto, inicio, fin):
    if not es_dni_plausible(valor):
        return None
    if _contexto(texto, inicio, _CTX_DNI):
        return 0.9
    if _MONEDA_ANTES.search(texto[max(0, inicio - 6) : inicio]) or _UNIDAD_DESPUES.search(texto[fin : fin + 12]):
        return None
    return 0.6


def _puntaje_dni_sin_puntos(valor, texto, inicio, fin):
    return 0.85 if es_dni_plausible(valor) and _contexto(texto, inicio, _CTX_DNI) else None


class DniRecognizer(_ReconocedorConReglas):
    ENTIDAD = "AR_DNI"
    REGLAS = [
        ("DNI con puntos", re.compile(r"(?<![\d.,$])\b\d{1,2}\.\d{3}\.\d{3}\b(?![.,]\d)"), 0, _puntaje_dni_con_puntos),
        ("DNI con contexto", re.compile(r"(?<![\d.,$])\b\d{7,8}\b(?![.,]\d)"), 0, _puntaje_dni_sin_puntos),
    ]


class CbuAliasRecognizer(_ReconocedorConReglas):
    ENTIDAD = "AR_CBU_ALIAS"
    REGLAS = [
        (
            "Alias después de 'alias'",
            re.compile(
                r"\balias(?:\s+(?:cbu|cvu|de\s+[\wáéíóú]+(?:\s+pago)?))?\s*(?:es|:|=)?\s*[\"'“]?"
                r"([a-z0-9-]+(?:\.[a-z0-9-]+){1,4})",
                re.I,
            ),
            1,
            lambda v, *_: 0.85 if 6 <= len(v) <= 20 else None,
        )
    ]


_CTX_PATENTE = re.compile(r"\b(patente|dominio|auto|veh[ií]culo|camioneta|moto)", re.I)


class LicensePlateArRecognizer(_ReconocedorConReglas):
    ENTIDAD = "AR_LICENSE_PLATE"
    REGLAS = [
        (
            "Patente Mercosur",
            re.compile(r"\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b"),
            0,
            lambda v, t, i, f: 0.9 if _contexto(t, i, _CTX_PATENTE) else 0.65,
        ),
        (
            "Patente vieja",
            re.compile(r"\b[A-Z]{3}\s?\d{3}\b"),
            0,
            lambda v, t, i, f: 0.85 if _contexto(t, i, _CTX_PATENTE) else None,
        ),
    ]


def reconocedores_ar(idioma: str = "es") -> list:
    """Devuelve una instancia de cada reconocedor argentino."""
    return [
        CuitRecognizer(supported_language=idioma),
        CbuRecognizer(supported_language=idioma),
        DniRecognizer(supported_language=idioma),
        CbuAliasRecognizer(supported_language=idioma),
        PhoneArRecognizer(supported_language=idioma),
        LicensePlateArRecognizer(supported_language=idioma),
        MercadoPagoTokenRecognizer(supported_language=idioma),
    ]


def agregar_reconocedores_ar(analyzer_o_registry, idioma: str = "es"):
    """Agrega todos los reconocedores a un AnalyzerEngine o a un RecognizerRegistry."""
    registry = getattr(analyzer_o_registry, "registry", analyzer_o_registry)
    for r in reconocedores_ar(idioma):
        registry.add_recognizer(r)
    return analyzer_o_registry


ENTIDADES_AR = [
    "AR_CUIT",
    "AR_CBU",
    "AR_DNI",
    "AR_CBU_ALIAS",
    "AR_PHONE",
    "AR_LICENSE_PLATE",
    "MERCADOPAGO_TOKEN",
]
