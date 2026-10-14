"""Validadores de dígito verificador para datos argentinos (misma lógica que la versión JS)."""

import re

PREFIJOS_CUIT = {"20", "23", "24", "25", "26", "27", "30", "33", "34"}


def solo_digitos(valor: str) -> str:
    return re.sub(r"\D", "", str(valor))


def es_cuit_valido(valor: str) -> bool:
    """CUIT/CUIL: 11 dígitos, verificador módulo 11 con pesos 5,4,3,2,7,6,5,4,3,2."""
    d = solo_digitos(valor)
    if len(d) != 11 or d[:2] not in PREFIJOS_CUIT:
        return False
    pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    suma = sum(p * int(d[i]) for i, p in enumerate(pesos))
    dv = 11 - (suma % 11)
    if dv == 11:
        dv = 0
    if dv == 10:
        return False
    return dv == int(d[10])


def _dv_bloque(digitos: str, pesos: list[int]) -> int:
    suma = sum(p * int(digitos[i]) for i, p in enumerate(pesos))
    return (10 - (suma % 10)) % 10


def es_cbu_valido(valor: str) -> bool:
    """CBU/CVU: 22 dígitos en dos bloques, cada uno con su verificador."""
    d = solo_digitos(valor)
    if len(d) != 22 or set(d) == {"0"}:
        return False
    b1, b2 = d[:8], d[8:]
    if _dv_bloque(b1, [7, 1, 3, 9, 7, 1, 3]) != int(b1[7]):
        return False
    return _dv_bloque(b2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) == int(b2[13])


def es_cvu(valor: str) -> bool:
    return solo_digitos(valor).startswith("000")


def es_dni_plausible(valor: str) -> bool:
    d = solo_digitos(valor)
    return 7 <= len(d) <= 8 and 1_000_000 <= int(d) <= 99_999_999
