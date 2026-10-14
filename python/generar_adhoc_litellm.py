"""Genera ../litellm/reconocedores_ar_adhoc.json para el guardrail de Presidio en LiteLLM Proxy.

El formato ad-hoc de Presidio solo admite regex: no puede validar el dígito verificador
ni mirar el contexto como lo hacen los reconocedores de Python. Por eso los puntajes son
más bajos y conviene usar umbral alto. Para máxima precisión, usar el paquete de Python.
"""

import json
from pathlib import Path

from presidio_argentina import CbuRecognizer, CuitRecognizer, MercadoPagoTokenRecognizer, PhoneArRecognizer


def desde_pattern_recognizer(rec, puntaje_max=None):
    return {
        "name": rec.name,
        "supported_language": "es",
        "supported_entity": rec.supported_entities[0],
        "patterns": [
            {"name": p.name, "regex": p.regex, "score": min(p.score, puntaje_max) if puntaje_max else p.score}
            for p in rec.patterns
        ],
        "context": rec.context or [],
    }


reconocedores = [
    desde_pattern_recognizer(CuitRecognizer(), 0.6),
    desde_pattern_recognizer(CbuRecognizer(), 0.6),
    desde_pattern_recognizer(PhoneArRecognizer()),
    desde_pattern_recognizer(MercadoPagoTokenRecognizer()),
    {
        "name": "DniRecognizer",
        "supported_language": "es",
        "supported_entity": "AR_DNI",
        "patterns": [
            {"name": "DNI con puntos", "regex": r"(?<![\d.,$])\b\d{1,2}\.\d{3}\.\d{3}\b(?![.,]\d)", "score": 0.5},
            {"name": "DNI sin puntos", "regex": r"(?<![\d.,$])\b\d{7,8}\b(?![.,]\d)", "score": 0.1},
        ],
        "context": ["dni", "documento", "doc"],
    },
    {
        "name": "LicensePlateArRecognizer",
        "supported_language": "es",
        "supported_entity": "AR_LICENSE_PLATE",
        "patterns": [{"name": "Patente Mercosur", "regex": r"\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b", "score": 0.6}],
        "context": ["patente", "dominio", "auto", "vehiculo"],
    },
]

destino = Path(__file__).resolve().parent.parent / "litellm" / "reconocedores_ar_adhoc.json"
destino.write_text(json.dumps(reconocedores, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Escrito {destino} con {len(reconocedores)} reconocedores")
