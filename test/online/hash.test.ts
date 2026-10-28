import { describe, expect, it } from 'vitest'
import type { ByteSource } from 'web-buildin-decoder'
import { HASH_CHUNK, hashOfSource, movieHash } from '../../src/online/hash.js'

function source(bytes: Uint8Array, readLimit = Infinity): ByteSource {
  return {
    size: bytes.length,
    // Answers with fewer bytes than asked, as a source may.
    read: async (offset, length) => bytes.slice(offset, offset + Math.min(length, readLimit)),
  }
}

describe('movie hash', () => {
  it('is the size plus the words at both ends', async () => {
    // TMPlayer's test vectors, worked out separately in Python from the published algorithm.
    expect(await hashOfSource(source(new Uint8Array(131_072)))).toBe('0000000000020000')
    const pattern = new Uint8Array(200_000).map((_, i) => (i * 31 + 7) & 0xff)
    expect(await hashOfSource(source(pattern))).toBe('5f9fe02060a3cd40')
    expect(await hashOfSource(source(pattern, 4096))).toBe('5f9fe02060a3cd40')
  })

  it('wraps at 64 bits', () => {
    const ones = new Uint8Array(HASH_CHUNK).fill(0xff)
    // Each end is 8192 words of 2^64 - 1, which is -8192 kept to 64 bits; with the size added.
    const expected = BigInt.asUintN(64, BigInt(HASH_CHUNK) - 16384n)
    expect(movieHash(HASH_CHUNK, ones, ones)).toBe(expected.toString(16).padStart(16, '0'))
  })

  it('is null for a file too short to hash, or one that cannot be read', async () => {
    expect(await hashOfSource(source(new Uint8Array(1000)))).toBeNull()
    const broken: ByteSource = {
      size: 1_000_000,
      read: () => Promise.reject(new Error('gone')),
    }
    expect(await hashOfSource(broken)).toBeNull()
    const stuck: ByteSource = { size: 1_000_000, read: () => new Promise(() => undefined) }
    expect(await hashOfSource(stuck, 20)).toBeNull()
  })
})
