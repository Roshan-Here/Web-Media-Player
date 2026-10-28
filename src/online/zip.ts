// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/*
 * Just enough of a zip reader for SubDL's downloads, which are small archives of subtitle files,
 * sometimes a whole season of them. Entries stored as they are or compressed with deflate (all a
 * subtitle archive uses) are read; the browser's own DecompressionStream inflates, so no library
 * is needed. Zip64, encryption and archives split across files are not supported.
 */

export interface ZipEntry {
  /** The entry's name without the folders before it. */
  name: string
  read(): Promise<Uint8Array>
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

const names = new TextDecoder('utf-8')

/**
 * The files in a zip, folders left out. Throws when the bytes are not a readable archive.
 * `maxBytes` refuses an entry larger than that, before or while inflating it.
 */
export function zipEntries(bytes: Uint8Array, maxBytes: number): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEnd(view)
  if (end < 0) throw new Error('not a zip archive')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const entries: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL)
      throw new Error('broken zip directory')
    const method = view.getUint16(at + 10, true)
    const compressed = view.getUint32(at + 20, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const path = names.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    at += 46 + nameLength + extraLength + commentLength
    if (path.endsWith('/')) continue
    const name = path.split(/[/\\]/).pop() ?? path
    entries.push({
      name,
      read: async () => {
        if (size > maxBytes) throw new Error('entry too large')
        if (view.getUint32(local, true) !== LOCAL) throw new Error('broken zip entry')
        const start =
          local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
        const data = bytes.subarray(start, start + compressed)
        if (method === 0) return data
        if (method === 8) return inflate(data, maxBytes)
        throw new Error(`unsupported zip method ${method}`)
      },
    })
  }
  return entries
}

/** The end of central directory record, searched for from the end past any comment. */
function findEnd(view: DataView): number {
  const last = view.byteLength - 22
  const first = Math.max(0, last - 0xffff)
  for (let i = last; i >= first; i--) if (view.getUint32(i, true) === EOCD) return i
  return -1
}

async function inflate(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('entry too large')
    }
    parts.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
