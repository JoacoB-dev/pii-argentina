import {
  esCbuValido,
  esCuitValido,
  esCvu,
  esDniPlausible,
  esTarjetaValida,
  soloDigitos,
} from './validadores.js'

// Cuántos caracteres antes del valor se miran para buscar palabras de contexto.
const VENTANA_CONTEXTO = 40

const CONTEXTO = {
  DNI: /\b(dni|d\.n\.i\.?|documento|doc\.?|n[º°r]o\.? de doc)/i,
  TELEFONO: /\b(tel|tel[eé]fono|cel|celular|whats?app|wsp|wpp|llamar|contacto|m[oó]vil)/i,
  PATENTE: /\b(patente|dominio|auto|veh[ií]culo|camioneta|moto)/i,
  TARJETA: /\b(tarjeta|visa|master(card)?|amex|d[eé]bito|cr[eé]dito|card)/i,
}

const tieneContexto = (texto, inicio, re) =>
  re.test(texto.slice(Math.max(0, inicio - VENTANA_CONTEXTO), inicio))

/**
 * Cada detector tiene un tipo, una expresión regular global y una función
 * que decide el puntaje (0 a 1) o devuelve null si el valor no corresponde.
 * `grupo` indica qué grupo de captura es el dato (0 = todo el match).
 */
export const DETECTORES = [
  {
    tipo: 'TOKEN_MERCADOPAGO',
    re: /\b(?:APP_USR|TEST)-\d{10,20}-\d{6}-[a-f0-9]{32}-\d{6,12}\b/g,
    puntaje: () => 0.99,
  },
  {
    tipo: 'EMAIL',
    re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/gi,
    puntaje: () => 0.95,
  },
  {
    tipo: 'CUIT',
    re: /\b(?:20|23|24|25|26|27|30|33|34)[-.\s]?\d{8}[-.\s]?\d\b/g,
    puntaje: (v) => (esCuitValido(v) ? 0.95 : null),
  },
  {
    // Antes que tarjeta: un CBU válido de 22 dígitos no es una tarjeta.
    tipo: 'CBU',
    re: /\b\d(?:[\s-]?\d){21}\b/g,
    puntaje: (v) => (esCbuValido(v) ? 0.95 : null),
    tipoFinal: (v) => (esCvu(v) ? 'CVU' : 'CBU'),
  },
  {
    tipo: 'ALIAS_CBU',
    re: /\balias(?:\s+(?:cbu|cvu|de\s+[\wáéíóú]+(?:\s+pago)?))?\s*(?:es|:|=)?\s*["'“]?([a-z0-9-]+(?:\.[a-z0-9-]+){1,4})/gi,
    grupo: 1,
    puntaje: (v) => (v.length >= 6 && v.length <= 20 ? 0.85 : null),
  },
  {
    tipo: 'TARJETA',
    re: /\b\d(?:[\s-]?\d){12,18}\b/g,
    puntaje: (v, texto, inicio) => {
      if (!esTarjetaValida(v)) return null
      const d = soloDigitos(v)
      if (tieneContexto(texto, inicio, CONTEXTO.TARJETA)) return 0.95
      // Sin contexto, solo prefijos de redes conocidas y largos típicos.
      return /^[3-6]/.test(d) && [15, 16].includes(d.length) ? 0.75 : null
    },
  },
  {
    tipo: 'TELEFONO',
    re: /(?:\+|\b)54[\s-]?9?[\s-]?\(?0?\d{2,4}\)?[\s-]?(?:15[\s-]?)?\d{3,4}[\s-]?\d{4}\b/g,
    puntaje: () => 0.9,
  },
  {
    tipo: 'TELEFONO',
    re: /(?<![\d.,$])\(?\b0?(?:11|[2-9]\d{1,3})\)?[\s-](?:15[\s-]?)?\d{3,4}[\s-]\d{4}\b/g,
    puntaje: (v, texto, inicio) => (tieneContexto(texto, inicio, CONTEXTO.TELEFONO) ? 0.85 : 0.6),
  },
  {
    tipo: 'DNI',
    re: /(?<![\d.,$])\b\d{1,2}\.\d{3}\.\d{3}\b(?![.,]\d)/g,
    puntaje: (v, texto, inicio, fin) => {
      if (!esDniPlausible(v)) return null
      if (tieneContexto(texto, inicio, CONTEXTO.DNI)) return 0.9
      const antes = texto.slice(Math.max(0, inicio - 6), inicio)
      const despues = texto.slice(fin, fin + 12)
      if (/\$|ars|usd/i.test(antes)) return null
      if (/^\s*(pesos|ars|usd|d[oó]lares|m|km|kg|t|l|unidades|habitantes|personas|votos|visitas)\b/i.test(despues)) return null
      return 0.6
    },
  },
  {
    tipo: 'DNI',
    re: /(?<![\d.,$])\b\d{7,8}\b(?![.,]\d)/g,
    puntaje: (v, texto, inicio) =>
      esDniPlausible(v) && tieneContexto(texto, inicio, CONTEXTO.DNI) ? 0.85 : null,
  },
  {
    // Patente Mercosur (desde 2016): AB 123 CD
    tipo: 'PATENTE',
    re: /\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b/g,
    puntaje: (v, texto, inicio) => (tieneContexto(texto, inicio, CONTEXTO.PATENTE) ? 0.9 : 0.65),
  },
  {
    // Patente vieja: ABC 123. Solo con contexto porque se confunde con códigos.
    tipo: 'PATENTE',
    re: /\b[A-Z]{3}\s?\d{3}\b/g,
    puntaje: (v, texto, inicio) => (tieneContexto(texto, inicio, CONTEXTO.PATENTE) ? 0.85 : null),
  },
  {
    tipo: 'DIRECCION',
    re: /\b(?:calle|av\.?|avda\.?|avenida|pasaje|pje\.?|bv\.?|boulevard|diagonal|diag\.?)\s+[A-ZÁÉÍÓÚÑ0-9][\wáéíóúñ.]*(?:\s+(?:de\s+|del\s+|la\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñ.]*){0,4}\s+(?:n[º°]\s*)?\d{1,5}\b(?:\s*,?\s*(?:piso\s*\d{1,2}|\d{1,2}[º°]?)\s*(?:depto\.?|dto\.?|departamento)?\s*[A-Z0-9]{0,2}\b)?/gi,
    puntaje: () => 0.8,
  },
]

export const TIPOS = [...new Set(DETECTORES.map((d) => d.tipo).concat(['CVU']))]

/**
 * Busca datos sensibles en un texto.
 * @returns {{tipo:string, valor:string, inicio:number, fin:number, puntaje:number}[]}
 */
export function detectar(texto, { tipos, umbral = 0.5 } = {}) {
  const filtro = tipos ? new Set(tipos.map((t) => t.toUpperCase())) : null
  const candidatos = []
  for (const det of DETECTORES) {
    det.re.lastIndex = 0
    for (const m of texto.matchAll(det.re)) {
      const grupo = det.grupo ?? 0
      const valor = m[grupo]
      if (valor == null) continue
      const inicio = m.index + (grupo ? m[0].indexOf(valor) : 0)
      const fin = inicio + valor.length
      const puntaje = det.puntaje(valor, texto, inicio, fin)
      if (puntaje == null || puntaje < umbral) continue
      const tipo = det.tipoFinal ? det.tipoFinal(valor) : det.tipo
      if (filtro && !filtro.has(tipo) && !filtro.has(det.tipo)) continue
      candidatos.push({ tipo, valor, inicio, fin, puntaje })
    }
  }
  // Si dos hallazgos se pisan, gana el de mayor puntaje y, si empatan, el más largo.
  candidatos.sort((a, b) => b.puntaje - a.puntaje || b.fin - b.inicio - (a.fin - a.inicio))
  const elegidos = []
  for (const c of candidatos) {
    if (!elegidos.some((e) => c.inicio < e.fin && e.inicio < c.fin)) elegidos.push(c)
  }
  return elegidos.sort((a, b) => a.inicio - b.inicio)
}
