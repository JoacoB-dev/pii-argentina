#!/usr/bin/env node
// Uso:
//   pii-argentina proxy --destino https://api.openai.com --puerto 8787
//   echo "Mi CUIT es 20-12345678-6" | pii-argentina anonimizar
//   pii-argentina detectar archivo.txt
import { readFileSync } from 'node:fs'
import { anonimizar, detectar } from './index.js'
import { crearProxy } from './proxy.js'

const [, , comando, ...resto] = process.argv
const opcion = (nombre, porDefecto) => {
  const i = resto.indexOf(`--${nombre}`)
  return i >= 0 ? resto[i + 1] : porDefecto
}
const leerEntrada = () => {
  const archivo = resto.find((a, i) => !a.startsWith('--') && !resto[i - 1]?.startsWith('--'))
  return readFileSync(archivo ?? 0, 'utf8')
}

if (comando === 'proxy') {
  const destino = opcion('destino', process.env.PII_DESTINO)
  const puerto = Number(opcion('puerto', process.env.PORT ?? 8787))
  const servidor = crearProxy({ destino })
  servidor.listen(puerto, '127.0.0.1', () => {
    console.log(`Proxy escuchando en http://127.0.0.1:${puerto} -> ${destino}`)
  })
} else if (comando === 'anonimizar') {
  const modo = opcion('modo', 'etiqueta')
  process.stdout.write(anonimizar(leerEntrada(), { modo }).texto)
} else if (comando === 'detectar') {
  const hallazgos = detectar(leerEntrada())
  for (const h of hallazgos) console.log(`${h.tipo}\t${h.puntaje}\t${h.valor}`)
  process.exitCode = hallazgos.length ? 1 : 0
} else {
  console.log(`pii-argentina <comando>

  proxy --destino URL [--puerto 8787]   Proxy que anonimiza antes de mandar a la IA
  anonimizar [archivo] [--modo etiqueta|mascara]
  detectar [archivo]                    Lista lo encontrado (sale con código 1 si hay datos)`)
}
