"""Reconocedores de Presidio para CUIT, CBU/CVU, DNI, alias, teléfonos y patentes de Argentina."""

from .reconocedores import (
    ENTIDADES_AR,
    CbuAliasRecognizer,
    CbuRecognizer,
    CuitRecognizer,
    DniRecognizer,
    LicensePlateArRecognizer,
    MercadoPagoTokenRecognizer,
    PhoneArRecognizer,
    agregar_reconocedores_ar,
    reconocedores_ar,
)
from .validadores import es_cbu_valido, es_cuit_valido, es_cvu, es_dni_plausible

__all__ = [
    "ENTIDADES_AR",
    "CbuAliasRecognizer",
    "CbuRecognizer",
    "CuitRecognizer",
    "DniRecognizer",
    "LicensePlateArRecognizer",
    "MercadoPagoTokenRecognizer",
    "PhoneArRecognizer",
    "agregar_reconocedores_ar",
    "reconocedores_ar",
    "es_cbu_valido",
    "es_cuit_valido",
    "es_cvu",
    "es_dni_plausible",
]
__version__ = "0.1.0"
