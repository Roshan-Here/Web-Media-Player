// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { ByteSource } from 'web-buildin-decoder'

/*
 * OpenSubtitles' file hash: the size plus every little-endian 64-bit word of the first and the
 * last 64 KiB, kept to 64 bits, as 16 hex digits. Two copies of the same release have the same
 * hash whatever they are called, which makes it the one match that cannot pick the wrong cut of
 * a film. Only the two ends are read, so a streamed video can be hashed long before it has all
 * arrived.
 */

export const HASH_CHUNK = 64 * 1024

/** Whether a file of `size` bytes can be hashed: one shorter than a chunk cannot. */
export function hashable(size: number): boolean {
  return size >= HASH_CHUNK
}

/** The hash from the file's size and its first and last 64 KiB. */
export function movieHash(size: number, head: Uint8Array, tail: Uint8Array): string {
  if (head.length < HASH_CHUNK || tail.length < HASH_CHUNK)
    throw new Error(`need ${HASH_CHUNK} bytes from each end`)
  const sum = BigInt(size) + words(head) + words(tail)
  return BigInt.asUintN(64, sum).toString(16).padStart(16, '0')
}

function words(bytes: Uint8Array): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, HASH_CHUNK)
  let sum = 0n
  for (let i = 0; i < HASH_CHUNK; i += 8) sum += view.getBigUint64(i, true)
  // Keeping the running sum to 64 bits now keeps the numbers small; the result is the same.
  return BigInt.asUintN(64, sum)
}

/** Reads exactly `length` bytes, since a source may answer a read with fewer. */
async function readFully(source: ByteSource, offset: number, length: number): Promise<Uint8Array> {
  const out = new Uint8Array(length)
  let got = 0
  while (got < length) {
    const part = await source.read(offset + got, length - got)
    if (part.length === 0) break
    out.set(part.subarray(0, length - got), got)
    got += part.length
  }
  return got >= length ? out : out.subarray(0, got)
}

/**
 * The hash of a file read through `source`, or null when it is too short, cannot be read, or
 * takes longer than `timeoutMs` (a search by name is better than a long wait).
 */
export async function hashOfSource(source: ByteSource, timeoutMs = 4000): Promise<string | null> {
  const size = source.size
  if (!hashable(size)) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  const work = (async () => {
    const [head, tail] = await Promise.all([
      readFully(source, 0, HASH_CHUNK),
      readFully(source, size - HASH_CHUNK, HASH_CHUNK),
    ])
    if (head.length < HASH_CHUNK || tail.length < HASH_CHUNK) return null
    return movieHash(size, head, tail)
  })().catch(() => null)
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}
