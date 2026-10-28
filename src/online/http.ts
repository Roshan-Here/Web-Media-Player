// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { logDecoder } from 'web-buildin-decoder'

/** One request to an online provider. `body` is sent as JSON when present. */
export interface HttpRequest {
  method: 'GET' | 'POST' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: string
}

/** The status, the headers and the body, read whole. */
export interface HttpResponse {
  status: number
  header(name: string): string | null
  body: Uint8Array
}

/**
 * The one way the providers reach the network, so tests can stand a fake in its place. A
 * failure to connect at all (offline, refused by CORS or the page's policy, timed out) is a
 * thrown error; any answer, an error status included, is a response.
 */
export type HttpTransport = (request: HttpRequest) => Promise<HttpResponse>

/** Larger than any subtitle file or search page; past it the answer is refused. */
const MAX_BYTES = 8 * 1024 * 1024
/** A provider that has not answered by now is not going to. */
const TIMEOUT_MS = 30_000

export const fetchTransport: HttpTransport = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // Nothing of the page (cookies, the address it was opened from) goes to the providers.
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
  })
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) throw new Error(`answer larger than ${MAX_BYTES} bytes`)
  const body = new Uint8Array(await response.arrayBuffer())
  if (body.length > MAX_BYTES) throw new Error(`answer larger than ${MAX_BYTES} bytes`)
  return { status: response.status, header: (name) => response.headers.get(name), body }
}

const utf8 = new TextDecoder('utf-8')

export function responseText(response: HttpResponse): string {
  return utf8.decode(response.body)
}

/** The answer as a JSON object, or null when it is not one. */
export function responseJson(response: HttpResponse): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(responseText(response))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Where a request went, without its query string: SubDL carries the person's key there. */
export function where(url: string): string {
  return url.split('#')[0]!.split('?')[0]!
}

/** The one log line for a provider call that did not come back well. Never a key or token. */
export function logProvider(provider: string, method: string, url: string, why: string) {
  logDecoder(`subtitles: ${provider} ${method} ${where(url)} failed`, why, 'warn')
}

/** Query parameters sorted by name and encoded as forms are (space as `+`, comma as `%2C`). */
export function sortedQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${formEncode(params[k]!)}`)
    .join('&')
}

function formEncode(value: string): string {
  // The same as Java's URLEncoder, which TMPlayer's requests (and its tests) were written with.
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

// JSON helpers: providers leave fields out or send null, and none of that may throw.
export const str = (v: unknown): string => (typeof v === 'string' ? v : '')
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
export const bool = (v: unknown): boolean => v === true
export const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
