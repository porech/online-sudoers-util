import type { SudoersDocument } from './types'
import { parseLine } from './parseLine'

// Split text into logical lines, joining backslash-continued physical lines.
// The joined `raw` preserves the original text including the backslash+newline.
export function splitLogicalLines(text: string): string[] {
  const physical = text.split('\n')
  const logical: string[] = []
  let buf: string[] = []
  for (const line of physical) {
    if (/\\\s*$/.test(line)) {
      buf.push(line)
    } else {
      buf.push(line)
      logical.push(buf.join('\n'))
      buf = []
    }
  }
  if (buf.length > 0) logical.push(buf.join('\n'))
  return logical
}

export function parseDocument(text: string): SudoersDocument {
  if (text === '') return { lines: [] }
  const logical = splitLogicalLines(text)
  const lines = logical.map((raw, i) => parseLine(raw, i + 1))
  return { lines }
}
