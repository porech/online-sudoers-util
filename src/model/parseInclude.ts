import type { Line } from './types'
export function parseInclude(raw: string, _line: number): Line {
  // Replaced in Task 5.1
  return { kind: 'include', raw, dirty: false, includeKind: '@include', path: '' }
}
