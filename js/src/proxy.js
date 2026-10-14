import http from 'node:http'
import { crearAnonimizador, mapearTexto, restaurar } from './index.js'

const LIMITE_CUERPO = 5 * 1024 * 1024

// Encabezados que se reenvían al proveedor de IA. El resto se descarta.
const ENCABEZADOS_PERMITIDOS = [
  'authorization',
  'x-api-key',
  'anthropic-version',
  'anthropic-beta',
  'openai-organization',
  'openai-project',
  'content-type',
]

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let total = 0
    const partes = []
    req.on('data', (c) => {
      total += c.length
      if (total > LIMITE_CUERPO) {
        reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 }))
        req.destroy()
      } else partes.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')))
    req.on('error', reject)
  })
}

function responder(res, status, cuerpo) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(cuerpo))
}

/** Anonimiza el pedido. Soporta /v1/chat/completions (OpenAI y compatibles) y /v1/messages (Anthropic). */
export function anonimizarPedido(cuerpo, anonimizador) {
  const fn = (t) => anonimizador.anonimizar(t).texto
  const nuevo = { ...cuerpo }
  if (Array.isArray(nuevo.messages)) {
    nuevo.messages = nuevo.messages.map((m) => ({ ...m, content: mapearTexto(m.content, fn) }))
  }
  if (nuevo.system !== undefined) nuevo.system = mapearTexto(nuevo.system, fn)
  return nuevo
}

/** Restaura los valores originales en la respuesta del modelo. */
export function restaurarRespuesta(cuerpo, mapa) {
  const fn = (t) => restaurar(t, mapa)
  const nuevo = { ...cuerpo }
  if (Array.isArray(nuevo.choices)) {
    nuevo.choices = nuevo.choices.map((c) =>
      c.message ? { ...c, message: { ...c.message, content: mapearTexto(c.message.content, fn) } } : c,
    )
  }
  if (Array.isArray(nuevo.content)) nuevo.content = mapearTexto(nuevo.content, fn)
  return nuevo
}

/**
 * Crea el servidor proxy.
 * @param {{destino:string, restaurar?:boolean, umbral?:number, tipos?:string[], fetch?:typeof fetch, registrar?:(linea:string)=>void}} opciones
 */
export function crearProxy({ destino, restaurar: restaurarSalida = true, umbral, tipos, fetch: f = fetch, registrar = console.log }) {
  if (!destino) throw new Error('Falta el destino (por ejemplo https://api.openai.com)')
  const base = destino.replace(/\/+$/, '')

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/salud') return responder(res, 200, { ok: true })
      const ruta = new URL(req.url, 'http://x').pathname
      if (req.method !== 'POST' || !/\/(chat\/completions|messages)$/.test(ruta)) {
        return responder(res, 404, { error: 'Solo se aceptan POST a /v1/chat/completions o /v1/messages' })
      }
      let cuerpo
      try {
        cuerpo = JSON.parse(await leerCuerpo(req))
      } catch (e) {
        return responder(res, e.status ?? 400, { error: e.status ? e.message : 'JSON inválido' })
      }
      if (cuerpo.stream) {
        return responder(res, 400, { error: 'stream: true todavía no está soportado por el proxy' })
      }

      const anonimizador = crearAnonimizador({ umbral, tipos })
      const pedido = anonimizarPedido(cuerpo, anonimizador)
      const cantidad = Object.keys(anonimizador.mapa).length
      // Solo se registran cantidades y tipos, nunca los valores.
      const tiposVistos = [...new Set(Object.keys(anonimizador.mapa).map((e) => e.slice(1).replace(/_\d+>$/, '')))]
      registrar(`${new Date().toISOString()} ${ruta} datos_anonimizados=${cantidad}${cantidad ? ` tipos=${tiposVistos.join(',')}` : ''}`)

      const encabezados = {}
      for (const h of ENCABEZADOS_PERMITIDOS) if (req.headers[h]) encabezados[h] = req.headers[h]
      encabezados['content-type'] = 'application/json'

      const r = await f(base + req.url, { method: 'POST', headers: encabezados, body: JSON.stringify(pedido) })
      const texto = await r.text()
      let salida = texto
      if (restaurarSalida && cantidad > 0) {
        try {
          salida = JSON.stringify(restaurarRespuesta(JSON.parse(texto), anonimizador.mapa))
        } catch {
          // Si el proveedor no devolvió JSON, se reenvía tal cual.
        }
      }
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' })
      res.end(salida)
    } catch (e) {
      registrar(`${new Date().toISOString()} error ${e.message}`)
      responder(res, 502, { error: 'No se pudo contactar al proveedor de IA' })
    }
  })
}
