// Validadores de dígito verificador para datos argentinos.
// Todos reciben un string y aceptan guiones, puntos o espacios en el medio.

export const soloDigitos = (s) => String(s).replace(/\D/g, '')

const PREFIJOS_CUIT = new Set(['20', '23', '24', '25', '26', '27', '30', '33', '34'])

/**
 * CUIT / CUIL: 11 dígitos. El último es el verificador (módulo 11).
 * Pesos 5,4,3,2,7,6,5,4,3,2 sobre los primeros 10.
 */
export function esCuitValido(valor) {
  const d = soloDigitos(valor)
  if (d.length !== 11 || !PREFIJOS_CUIT.has(d.slice(0, 2))) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) return false
  return dv === Number(d[10])
}

/** Persona humana (CUIL/CUIT de persona) o persona jurídica (empresa). */
export function tipoCuit(valor) {
  const p = soloDigitos(valor).slice(0, 2)
  return ['30', '33', '34'].includes(p) ? 'juridica' : 'humana'
}

function dvBloque(digitos, pesos) {
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(digitos[i]), 0)
  return (10 - (suma % 10)) % 10
}

/**
 * CBU / CVU: 22 dígitos en dos bloques.
 * Bloque 1 (8): banco (3) + sucursal (4) + verificador.
 * Bloque 2 (14): cuenta (13) + verificador.
 * El CVU (billeteras virtuales) usa el mismo cálculo y empieza con 000.
 */
export function esCbuValido(valor) {
  const d = soloDigitos(valor)
  if (d.length !== 22) return false
  const b1 = d.slice(0, 8)
  const b2 = d.slice(8)
  if (dvBloque(b1, [7, 1, 3, 9, 7, 1, 3]) !== Number(b1[7])) return false
  if (dvBloque(b2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) !== Number(b2[13])) return false
  // Un CBU todo en ceros pasa el cálculo pero no existe.
  return !/^0+$/.test(d)
}

export const esCvu = (valor) => soloDigitos(valor).startsWith('000')

/** DNI: entre 1.000.000 y 99.999.999 (7 u 8 dígitos). */
export function esDniPlausible(valor) {
  const d = soloDigitos(valor)
  if (d.length < 7 || d.length > 8) return false
  const n = Number(d)
  return n >= 1_000_000 && n <= 99_999_999
}

/** Algoritmo de Luhn para tarjetas de crédito y débito. */
export function esTarjetaValida(valor) {
  const d = soloDigitos(valor)
  if (d.length < 13 || d.length > 19) return false
  let suma = 0
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    suma += n
  }
  return suma % 10 === 0
}

/** Calcula el dígito verificador de un CUIT a partir de los primeros 10 dígitos. Útil para tests y datos de ejemplo. */
export function calcularDvCuit(diez) {
  const d = soloDigitos(diez)
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0)
  const dv = 11 - (suma % 11)
  return dv === 11 ? 0 : dv
}

/** Arma un CBU válido a partir de banco+sucursal (7 dígitos) y cuenta (13 dígitos). */
export function armarCbu(bancoSucursal, cuenta) {
  const b1 = soloDigitos(bancoSucursal)
  const b2 = soloDigitos(cuenta)
  return (
    b1 + dvBloque(b1, [7, 1, 3, 9, 7, 1, 3]) + b2 + dvBloque(b2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])
  )
}
