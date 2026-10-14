export type TipoDato =
  | 'CUIT' | 'CBU' | 'CVU' | 'ALIAS_CBU' | 'DNI' | 'TELEFONO' | 'EMAIL'
  | 'TARJETA' | 'PATENTE' | 'DIRECCION' | 'TOKEN_MERCADOPAGO'

export interface Hallazgo {
  tipo: TipoDato
  valor: string
  inicio: number
  fin: number
  /** 0 a 1. Cuanto más alto, más seguro es que el dato sea real. */
  puntaje: number
}

export interface OpcionesDeteccion {
  /** Solo buscar estos tipos. */
  tipos?: TipoDato[] | string[]
  /** Puntaje mínimo (default 0.5). Con 0.7 se descartan los casos dudosos sin contexto. */
  umbral?: number
}

export interface OpcionesAnonimizar extends OpcionesDeteccion {
  /** 'etiqueta' (default) reemplaza por <CUIT_1>; 'mascara' tapa con asteriscos. */
  modo?: 'etiqueta' | 'mascara'
}

export type Mapa = Record<string, string>

export interface Anonimizador {
  anonimizar(texto: string): { texto: string; hallazgos: Hallazgo[] }
  restaurar(texto: string): string
  mapa: Mapa
}

export interface Mensaje {
  role: string
  content: string | Array<{ type: string; text?: string; [k: string]: unknown }>
  [k: string]: unknown
}

export function detectar(texto: string, opciones?: OpcionesDeteccion): Hallazgo[]
export function anonimizar(texto: string, opciones?: OpcionesAnonimizar): { texto: string; mapa: Mapa; hallazgos: Hallazgo[] }
export function restaurar(texto: string, mapa: Mapa): string
export function crearAnonimizador(opciones?: OpcionesAnonimizar): Anonimizador
export function protegerMensajes<M extends Mensaje>(
  mensajes: M[],
  opciones?: OpcionesAnonimizar & { anonimizador?: Anonimizador },
): { mensajes: M[]; mapa: Mapa; anonimizador: Anonimizador }

export function esCuitValido(valor: string): boolean
export function tipoCuit(valor: string): 'humana' | 'juridica'
export function esCbuValido(valor: string): boolean
export function esCvu(valor: string): boolean
export function esDniPlausible(valor: string): boolean
export function esTarjetaValida(valor: string): boolean
export function calcularDvCuit(primerosDiez: string): number
export function armarCbu(bancoSucursal: string, cuenta: string): string
export function soloDigitos(valor: string): string

export const TIPOS: TipoDato[]

export { detectar as detect, anonimizar as redact, restaurar as restore, protegerMensajes as protectMessages, crearAnonimizador as createRedactor }
