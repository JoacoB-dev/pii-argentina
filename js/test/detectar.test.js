import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  anonimizar,
  armarCbu,
  calcularDvCuit,
  detectar,
  esCbuValido,
  esCuitValido,
  protegerMensajes,
  restaurar,
} from '../src/index.js'

// Datos inventados con dígito verificador correcto.
const CUIT = '20-12345678-6'
const CUIT_EMPRESA = '30-71234567-1'
const CBU = '0110599520000001234569'
const CVU = '0000003110000000000014'

const tipos = (texto, op) => detectar(texto, op).map((h) => h.tipo)

test('validador de CUIT', () => {
  assert.equal(esCuitValido(CUIT), true)
  assert.equal(esCuitValido('20123456786'), true)
  assert.equal(esCuitValido('20-12345678-7'), false)
  assert.equal(esCuitValido('99-12345678-6'), false)
  assert.equal(calcularDvCuit('3071234567'), 1)
})

test('validador de CBU y CVU', () => {
  assert.equal(esCbuValido(CBU), true)
  assert.equal(esCbuValido(CVU), true)
  assert.equal(esCbuValido('0110599520000001234560'), false)
  assert.equal(esCbuValido('0'.repeat(22)), false)
  assert.equal(armarCbu('0110599', '2000000123456'), CBU)
})

test('detecta CUIT con y sin guiones, y descarta los que no verifican', () => {
  assert.deepEqual(tipos(`Facturar a ${CUIT}`), ['CUIT'])
  assert.deepEqual(tipos(`CUIT 30712345671`), ['CUIT'])
  assert.deepEqual(tipos(`Pedido 20-12345678-7`), [])
})

test('distingue CBU de CVU', () => {
  assert.deepEqual(tipos(`Transferí al CBU ${CBU}`), ['CBU'])
  assert.deepEqual(tipos(`CVU: ${CVU}`), ['CVU'])
  assert.deepEqual(tipos(`CBU 0110 5995 2000 0001 2345 69`), ['CBU'])
})

test('DNI: con puntos, o sin puntos solo si hay contexto', () => {
  assert.deepEqual(tipos('Juan Pérez, 30.123.456'), ['DNI'])
  assert.deepEqual(tipos('DNI 30123456'), ['DNI'])
  assert.deepEqual(tipos('Pedido número 30123456'), [])
  assert.deepEqual(tipos('Sale $ 30.123.456 en total'), [])
  assert.deepEqual(tipos('Son 12.345.678 pesos'), [])
  assert.deepEqual(tipos('Tiene 3.120.612 habitantes'), [])
})

test('teléfonos argentinos', () => {
  assert.deepEqual(tipos('Escribime al +54 9 11 3097-9092'), ['TELEFONO'])
  assert.deepEqual(tipos('WhatsApp 11-3097-9092'), ['TELEFONO'])
  assert.deepEqual(tipos('Llamar al (0221) 15 456-7890'), ['TELEFONO'])
  assert.deepEqual(tipos('Fecha 2026-10-14'), [])
})

test('email, alias, tarjeta, patente, dirección y token de Mercado Pago', () => {
  assert.deepEqual(tipos('Mandalo a ana.gomez@gmail.com'), ['EMAIL'])
  const alias = detectar('Mi alias es perro.casa.mesa, gracias')
  assert.deepEqual(alias.map((h) => [h.tipo, h.valor]), [['ALIAS_CBU', 'perro.casa.mesa']])
  assert.deepEqual(tipos('Tarjeta Visa 4111 1111 1111 1111'), ['TARJETA'])
  assert.deepEqual(tipos('Número 4111111111111112'), [])
  assert.deepEqual(tipos('Patente AB 123 CD'), ['PATENTE'])
  assert.deepEqual(tipos('El auto tiene dominio ABC 123'), ['PATENTE'])
  assert.deepEqual(tipos('Código ABC123 del producto'), [])
  const dir = detectar('Vivo en Av. Rivadavia 4500, 3º B, CABA')
  assert.equal(dir[0].tipo, 'DIRECCION')
  assert.match(dir[0].valor, /^Av\. Rivadavia 4500/)
  assert.deepEqual(tipos('MP_ACCESS_TOKEN=APP_USR-5021937746180352-101415-9f2c7e1a0b4d6e8f1a2b3c4d5e6f7a8b-602318874'), [ // gitleaks:allow (token inventado)
    'TOKEN_MERCADOPAGO',
  ])
})

test('filtrar por tipo y por umbral', () => {
  const texto = `CUIT ${CUIT}, 30.123.456`
  assert.deepEqual(tipos(texto, { tipos: ['cuit'] }), ['CUIT'])
  assert.deepEqual(tipos(texto, { umbral: 0.7 }), ['CUIT'])
})

test('anonimizar con etiquetas y restaurar', () => {
  const original = `Cliente ${CUIT}, CBU ${CBU}. Repito: ${CUIT}`
  const { texto, mapa } = anonimizar(original)
  assert.equal(texto, 'Cliente <CUIT_1>, CBU <CBU_1>. Repito: <CUIT_1>')
  assert.equal(restaurar(texto, mapa), original)
  assert.equal(restaurar('Listo, el <CUIT_1> quedó cargado', mapa), `Listo, el ${CUIT} quedó cargado`)
})

test('anonimizar con máscara', () => {
  assert.equal(anonimizar(`CUIT ${CUIT_EMPRESA}`, { modo: 'mascara' }).texto, 'CUIT **-******67-1')
  assert.equal(anonimizar(`CUIT ${CUIT}`, { modo: 'mascara' }).texto, 'CUIT **-******78-6')
})

test('protegerMensajes respeta el formato y comparte etiquetas entre mensajes', () => {
  const mensajes = [
    { role: 'user', content: `Mi CUIT es ${CUIT}` },
    { role: 'assistant', content: 'Anotado' },
    { role: 'user', content: [{ type: 'text', text: `Confirmá ${CUIT} y DNI 30123456` }, { type: 'image_url', image_url: { url: 'x' } }] },
  ]
  const { mensajes: nuevos, mapa } = protegerMensajes(mensajes)
  assert.equal(nuevos[0].content, 'Mi CUIT es <CUIT_1>')
  assert.equal(nuevos[2].content[0].text, 'Confirmá <CUIT_1> y DNI <DNI_1>')
  assert.deepEqual(nuevos[2].content[1], mensajes[2].content[1])
  assert.equal(mensajes[0].content, `Mi CUIT es ${CUIT}`, 'no modifica el original')
  assert.deepEqual(Object.keys(mapa), ['<CUIT_1>', '<DNI_1>'])
})
