import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearProxy } from '../src/proxy.js'

const CUIT = '20-12345678-6'

async function conProxy(proveedorFalso, fn) {
  const enviados = []
  const lineas = []
  const fetchFalso = async (url, init) => {
    enviados.push({ url, headers: init.headers, cuerpo: JSON.parse(init.body) })
    const respuesta = proveedorFalso(JSON.parse(init.body))
    return new Response(JSON.stringify(respuesta), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const servidor = crearProxy({ destino: 'https://api.ejemplo.com/', fetch: fetchFalso, registrar: (l) => lineas.push(l) })
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${servidor.address().port}`
  try {
    await fn(base, enviados, lineas)
  } finally {
    servidor.close()
  }
}

test('formato OpenAI: el proveedor no ve el CUIT y la respuesta vuelve con el dato real', async () => {
  await conProxy(
    (pedido) => ({ choices: [{ index: 0, message: { role: 'assistant', content: `Registré el ${pedido.messages[0].content.match(/<CUIT_\d>/)[0]}` } }] }),
    async (base, enviados, lineas) => {
      const r = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer sk-prueba', cookie: 'no-reenviar' },
        body: JSON.stringify({ model: 'x', messages: [{ role: 'user', content: `Mi CUIT es ${CUIT}` }] }),
      })
      const cuerpo = await r.json()
      assert.equal(enviados[0].url, 'https://api.ejemplo.com/v1/chat/completions')
      assert.equal(enviados[0].cuerpo.messages[0].content, 'Mi CUIT es <CUIT_1>')
      assert.equal(enviados[0].headers.authorization, 'Bearer sk-prueba')
      assert.equal(enviados[0].headers.cookie, undefined)
      assert.equal(cuerpo.choices[0].message.content, `Registré el ${CUIT}`)
      assert.ok(lineas[0].includes('datos_anonimizados=1 tipos=CUIT'))
      assert.ok(!lineas.join('').includes('12345678'), 'el log no tiene valores')
    },
  )
})

test('formato Anthropic: system y bloques de texto', async () => {
  await conProxy(
    () => ({ content: [{ type: 'text', text: 'Tu DNI es <DNI_1>' }] }),
    async (base, enviados) => {
      const r = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'k', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'x',
          system: 'El cliente tiene DNI 30123456',
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Repetí mi DNI 30123456' }] }],
        }),
      })
      const cuerpo = await r.json()
      assert.equal(enviados[0].cuerpo.system, 'El cliente tiene DNI <DNI_1>')
      assert.equal(enviados[0].cuerpo.messages[0].content[0].text, 'Repetí mi DNI <DNI_1>')
      assert.equal(enviados[0].headers['x-api-key'], 'k')
      assert.equal(cuerpo.content[0].text, 'Tu DNI es 30123456')
    },
  )
})

test('rechaza stream, rutas desconocidas y JSON inválido', async () => {
  await conProxy(
    () => ({}),
    async (base, enviados) => {
      const post = (ruta, body) => fetch(base + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      assert.equal((await post('/v1/chat/completions', JSON.stringify({ stream: true, messages: [] }))).status, 400)
      assert.equal((await post('/v1/embeddings', '{}')).status, 404)
      assert.equal((await post('/v1/messages', '{no es json')).status, 400)
      assert.equal(enviados.length, 0)
    },
  )
})
