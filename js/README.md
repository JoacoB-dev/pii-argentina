# pii-argentina

Detecta y anonimiza datos sensibles argentinos **antes de mandarlos a una IA** (ChatGPT, Claude, Gemini o cualquier API compatible). Valida los dígitos verificadores, así que no tapa cualquier número largo.

> [English version](README.en.md)

## Por qué existe

Las herramientas conocidas de anonimización ([Microsoft Presidio](https://microsoft.github.io/presidio/), LLM Guard, OpenRedaction) reconocen datos de EE.UU., Reino Unido, España, India, etc., pero **no CUIT, CBU ni DNI argentinos**. Si un sistema manda reclamos, legajos o chats de clientes a un modelo de IA, esos datos salen tal cual.

## Qué detecta

| Tipo | Ejemplo | Cómo se valida |
|---|---|---|
| CUIT / CUIL | `20-12345678-6` | Dígito verificador módulo 11 |
| CBU / CVU | `0110599520000001234569` | Los dos dígitos verificadores; CVU si empieza con 000 |
| Alias de CBU/CVU | `alias perro.casa.mesa` | Solo después de la palabra "alias" |
| DNI | `30.123.456` o `DNI 30123456` | Sin puntos solo si dice DNI/documento cerca; descarta montos ($, pesos) |
| Teléfono | `+54 9 11 3097-9092`, `(0221) 15 456-7890` | Formato argentino |
| Email | `ana@gmail.com` | |
| Tarjeta | `4111 1111 1111 1111` | Algoritmo de Luhn |
| Patente | `AB 123 CD`, `dominio ABC 123` | La vieja solo con contexto |
| Dirección | `Av. Rivadavia 4500, 3º B` | Solo con prefijo (calle, av., pasaje...) |
| Token de Mercado Pago | `APP_USR-...` | Formato del access token |

Cada hallazgo trae un **puntaje** de 0 a 1. Con `umbral: 0.7` se descartan los casos dudosos sin contexto (por ejemplo un número con puntos sin la palabra DNI).

## Tres formas de usarlo

### 1. Librería de JavaScript (Node 18+, sin dependencias)

```js
import { anonimizar, restaurar, protegerMensajes } from 'pii-argentina'

const { texto, mapa } = anonimizar('Mi CUIT es 20-12345678-6 y mi CBU 0110599520000001234569')
// texto: "Mi CUIT es <CUIT_1> y mi CBU <CBU_1>"

const respuesta = await llamarALaIA(texto)          // la IA nunca ve el dato real
const final = restaurar(respuesta, mapa)            // vuelve a poner el CUIT real

// Con una lista de mensajes de OpenAI o Anthropic:
const { mensajes, mapa: m } = protegerMensajes(historial)
```

Modo máscara (no reversible): `anonimizar(texto, { modo: 'mascara' })` → `**-******78-6`.

### 2. Proxy (cero cambios en el código de la app)

```bash
npx pii-argentina proxy --destino https://api.openai.com --puerto 8787
```

La app apunta a `http://127.0.0.1:8787` en lugar de `https://api.openai.com`. El proxy anonimiza `messages` y `system`, reenvía la clave de API, y restaura los datos en la respuesta. Funciona con `/v1/chat/completions` (OpenAI y compatibles) y `/v1/messages` (Anthropic). El log solo muestra cantidades y tipos, nunca los valores.

Limitación actual: no soporta `stream: true`.

### 3. Microsoft Presidio (Python)

```python
from presidio_analyzer import AnalyzerEngine
from presidio_argentina import agregar_reconocedores_ar

analyzer = agregar_reconocedores_ar(AnalyzerEngine(...))
analyzer.analyze(text="Mi CUIT es 20-12345678-6", language="es")
```

Entidades: `AR_CUIT`, `AR_CBU`, `AR_DNI`, `AR_CBU_ALIAS`, `AR_PHONE`, `AR_LICENSE_PLATE`, `MERCADOPAGO_TOKEN`.

Para **LiteLLM Proxy** hay un archivo listo en [`litellm/`](litellm/config.yaml). Ese formato solo admite regex, así que no valida dígitos verificadores: es menos preciso que el paquete de Python.

## Comandos

```bash
cd js && npm test                       # 14 tests (validadores, detección, anonimizar, proxy)
echo "CUIT 20-12345678-6" | node src/cli.js anonimizar
node src/cli.js detectar archivo.txt    # sale con código 1 si encuentra datos (sirve en CI)

cd python && pip install -e ".[test]" && python -m spacy download es_core_news_sm && pytest
```

## Estructura

```
js/        librería npm, proxy y CLI (src/), tests (test/)
python/    paquete presidio-argentina, tests y generador del JSON para LiteLLM
litellm/   config.yaml de ejemplo y reconocedores ad-hoc
```

## Límites

- Nombres de personas y direcciones sin prefijo necesitan un modelo de lenguaje: en Python, Presidio con spaCy ya detecta `PERSON` y `LOCATION`; en JS no.
- Es una ayuda, no una garantía legal. Para cumplir la Ley 25.326 de datos personales hace falta además revisar qué se manda y a quién.
- Los datos de ejemplo de los tests son inventados (con dígito verificador correcto).

## Licencia

MIT. Autor: Joaquin Alejandro Bobbio.
