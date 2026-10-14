import pytest
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider

from presidio_argentina import (
    CbuRecognizer,
    CuitRecognizer,
    DniRecognizer,
    agregar_reconocedores_ar,
    es_cbu_valido,
    es_cuit_valido,
)

CUIT = "20-12345678-6"
CBU = "0110599520000001234569"
CVU = "0000003110000000000014"


def tipos(rec, texto):
    return [r.entity_type for r in rec.analyze(texto, rec.supported_entities, None) if r.score > 0]


def test_validadores():
    assert es_cuit_valido(CUIT)
    assert not es_cuit_valido("20-12345678-7")
    assert es_cbu_valido(CBU) and es_cbu_valido(CVU)
    assert not es_cbu_valido("0110599520000001234560")


def test_cuit_descarta_si_no_verifica():
    rec = CuitRecognizer()
    validos = [r for r in rec.analyze(f"CUIT {CUIT}", ["AR_CUIT"], None)]
    assert len(validos) == 1 and validos[0].score == 1.0
    assert rec.analyze("Pedido 20-12345678-7", ["AR_CUIT"], None) == []


def test_cbu():
    rec = CbuRecognizer()
    assert tipos(rec, f"CBU {CBU}") == ["AR_CBU"]
    assert tipos(rec, "Pedido 0110599520000001234560") == []


def test_dni_contexto_y_montos():
    rec = DniRecognizer()
    assert tipos(rec, "Juan, 30.123.456") == ["AR_DNI"]
    assert tipos(rec, "DNI 30123456") == ["AR_DNI"]
    assert tipos(rec, "Pedido 30123456") == []
    assert tipos(rec, "Total $ 30.123.456") == []
    assert tipos(rec, "Tiene 3.120.612 habitantes") == []


@pytest.fixture(scope="module")
def analyzer():
    proveedor = NlpEngineProvider(
        nlp_configuration={"nlp_engine_name": "spacy", "models": [{"lang_code": "es", "model_name": "es_core_news_sm"}]}
    )
    a = AnalyzerEngine(nlp_engine=proveedor.create_engine(), supported_languages=["es"])
    return agregar_reconocedores_ar(a)


def test_integracion_con_analyzer_y_anonymizer(analyzer):
    from presidio_anonymizer import AnonymizerEngine

    texto = (
        f"Hola, soy Ana. Mi CUIT es {CUIT}, mi CBU {CBU} y mi alias perro.casa.mesa. "
        "DNI 30.123.456, cel +54 9 11 3097-9092, auto patente AB 123 CD. "
        "Token APP_USR-5021937746180352-101415-9f2c7e1a0b4d6e8f1a2b3c4d5e6f7a8b-602318874"  # gitleaks:allow (token inventado)
    )
    entidades = ["AR_CUIT", "AR_CBU", "AR_CBU_ALIAS", "AR_DNI", "AR_PHONE", "AR_LICENSE_PLATE", "MERCADOPAGO_TOKEN"]
    resultados = analyzer.analyze(text=texto, language="es", entities=entidades)
    encontrados = {r.entity_type for r in resultados}
    assert encontrados == set(entidades)
    salida = AnonymizerEngine().anonymize(text=texto, analyzer_results=resultados).text
    for dato in [CUIT, CBU, "perro.casa.mesa", "30.123.456", "3097-9092", "AB 123 CD", "APP_USR-"]:
        assert dato not in salida, dato
    assert "<AR_CUIT>" in salida and "<AR_CBU>" in salida
