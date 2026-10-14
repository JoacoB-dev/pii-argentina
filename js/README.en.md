# pii-argentina

Detects and redacts Argentine sensitive data **before it is sent to an AI model** (ChatGPT, Claude, Gemini or any compatible API). It validates check digits, so it does not blindly mask every long number.

> [Versión en español](README.md)

## Why

Well-known redaction tools ([Microsoft Presidio](https://microsoft.github.io/presidio/), LLM Guard, OpenRedaction) recognize US, UK, Spanish, Indian IDs and more, but **not Argentine CUIT, CBU or DNI**. When a system sends customer chats, complaints or HR records to an LLM, that data leaves as is.

## What it detects

| Type | Example | Validation |
|---|---|---|
| CUIT / CUIL (tax ID) | `20-12345678-6` | Mod-11 check digit |
| CBU / CVU (bank account) | `0110599520000001234569` | Both check digits; CVU when it starts with 000 |
| CBU/CVU alias | `alias perro.casa.mesa` | Only after the word "alias" |
| DNI (national ID) | `30.123.456` or `DNI 30123456` | Without dots only near "DNI/documento"; skips amounts ($, pesos) |
| Phone | `+54 9 11 3097-9092`, `(0221) 15 456-7890` | Argentine format |
| Email | `ana@gmail.com` | |
| Card | `4111 1111 1111 1111` | Luhn |
| License plate | `AB 123 CD`, `dominio ABC 123` | Old format only with context |
| Street address | `Av. Rivadavia 4500, 3º B` | Only with a prefix (calle, av., pasaje...) |
| Mercado Pago token | `APP_USR-...` | Access token format |

Each finding has a **score** from 0 to 1. `umbral: 0.7` (threshold) drops uncertain matches that have no context.

## Three ways to use it

### 1. JavaScript library (Node 18+, zero dependencies)

```js
import { redact, restore, protectMessages } from 'pii-argentina'

const { texto, mapa } = redact('Mi CUIT es 20-12345678-6')
// texto: "Mi CUIT es <CUIT_1>"
const answer = restore(await callTheModel(texto), mapa)

const { mensajes, mapa: m } = protectMessages(openAiOrAnthropicMessages)
```

Spanish names (`anonimizar`, `restaurar`, `protegerMensajes`) are the primary API; the English ones are aliases.

### 2. Proxy (no code changes in the app)

```bash
npx pii-argentina proxy --destino https://api.openai.com --puerto 8787
```

Point the app to `http://127.0.0.1:8787`. The proxy redacts `messages` and `system`, forwards the API key, and restores the original values in the response. Supports `/v1/chat/completions` (OpenAI-compatible) and `/v1/messages` (Anthropic). Logs show counts and types only, never values. `stream: true` is not supported yet.

### 3. Microsoft Presidio (Python)

```python
from presidio_argentina import agregar_reconocedores_ar
analyzer = agregar_reconocedores_ar(AnalyzerEngine(...))
```

Entities: `AR_CUIT`, `AR_CBU`, `AR_DNI`, `AR_CBU_ALIAS`, `AR_PHONE`, `AR_LICENSE_PLATE`, `MERCADOPAGO_TOKEN`. A ready-made **LiteLLM Proxy** config is in [`litellm/`](litellm/config.yaml) (regex only, so no check-digit validation).

## Commands

```bash
cd js && npm test        # 14 tests
cd python && pip install -e ".[test]" && python -m spacy download es_core_news_sm && pytest   # 5 tests
```

## Limits

- Person names and addresses without a prefix need an NLP model: in Python, Presidio + spaCy already detects `PERSON` and `LOCATION`; the JS library does not.
- A safety aid, not legal compliance on its own.
- Test data is made up (with valid check digits).

## License

MIT. Author: Joaquin Alejandro Bobbio.
