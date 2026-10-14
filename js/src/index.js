import { detectar, DETECTORES, TIPOS } from './detectar.js'

export { detectar, DETECTORES, TIPOS }
export * from './validadores.js'

function enmascarar(valor) {
  // Deja ver los últimos 3 caracteres alfanuméricos y tapa el resto, respetando separadores.
  let visibles = 3
  return [...valor]
    .reverse()
    .map((c) => {
      if (!/[\p{L}\p{N}]/u.test(c)) return c
      if (visibles > 0) {
        visibles--
        return c
      }
      return '*'
    })
    .reverse()
    .join('')
}

/**
 * Crea un "anonimizador" que recuerda qué etiqueta le dio a cada valor.
 * Así el mismo CUIT siempre se reemplaza por la misma etiqueta en toda la conversación.
 */
export function crearAnonimizador({ modo = 'etiqueta', tipos, umbral } = {}) {
  const mapa = {} // etiqueta -> valor original
  const porValor = new Map() // tipo|valor -> etiqueta
  const contadores = {}

  function etiquetaPara(tipo, valor) {
    const clave = `${tipo}|${valor}`
    if (!porValor.has(clave)) {
      contadores[tipo] = (contadores[tipo] ?? 0) + 1
      const etiqueta = `<${tipo}_${contadores[tipo]}>`
      porValor.set(clave, etiqueta)
      mapa[etiqueta] = valor
    }
    return porValor.get(clave)
  }

  function anonimizar(texto) {
    if (typeof texto !== 'string' || texto === '') return { texto, hallazgos: [] }
    const hallazgos = detectar(texto, { tipos, umbral })
    let salida = ''
    let cursor = 0
    for (const h of hallazgos) {
      salida += texto.slice(cursor, h.inicio)
      salida += modo === 'mascara' ? enmascarar(h.valor) : etiquetaPara(h.tipo, h.valor)
      cursor = h.fin
    }
    salida += texto.slice(cursor)
    return { texto: salida, hallazgos }
  }

  return { anonimizar, mapa, restaurar: (texto) => restaurar(texto, mapa) }
}

/**
 * Reemplaza los datos sensibles de un texto.
 * modo 'etiqueta' (default): "Mi CUIT es <CUIT_1>" y devuelve el mapa para restaurar.
 * modo 'mascara': "Mi CUIT es **-********-6" (no se puede restaurar).
 */
export function anonimizar(texto, opciones = {}) {
  const a = crearAnonimizador(opciones)
  const r = a.anonimizar(texto)
  return { texto: r.texto, mapa: a.mapa, hallazgos: r.hallazgos }
}

/** Vuelve a poner los valores originales donde aparecen las etiquetas. */
export function restaurar(texto, mapa) {
  if (typeof texto !== 'string') return texto
  const etiquetas = Object.keys(mapa)
  if (etiquetas.length === 0) return texto
  const re = new RegExp(etiquetas.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
  return texto.replace(re, (e) => mapa[e])
}

function mapearTexto(contenido, fn) {
  if (typeof contenido === 'string') return fn(contenido)
  if (Array.isArray(contenido)) {
    return contenido.map((parte) =>
      parte && parte.type === 'text' && typeof parte.text === 'string' ? { ...parte, text: fn(parte.text) } : parte,
    )
  }
  return contenido
}

/**
 * Anonimiza una lista de mensajes con formato OpenAI o Anthropic
 * ({role, content} con content string o lista de partes {type:'text', text}).
 * Devuelve los mensajes nuevos (no modifica los originales) y el mapa para restaurar la respuesta.
 */
export function protegerMensajes(mensajes, opciones = {}) {
  const a = opciones.anonimizador ?? crearAnonimizador(opciones)
  const nuevos = mensajes.map((m) => ({ ...m, content: mapearTexto(m.content, (t) => a.anonimizar(t).texto) }))
  return { mensajes: nuevos, mapa: a.mapa, anonimizador: a }
}

export { mapearTexto }

// Nombres en inglés para quien prefiera usarlos.
export {
  detectar as detect,
  anonimizar as redact,
  restaurar as restore,
  protegerMensajes as protectMessages,
  crearAnonimizador as createRedactor,
}
