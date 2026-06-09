import { useCallback, useMemo, useRef, useState } from 'react'
import type { Line, SudoersDocument } from '../model/types'
import { parseDocument } from '../model/parseDocument'
import { serializeDocument } from '../model/serialize'
import { validateDocument, type Warning } from '../model/validate'
import { saveActiveText } from './storage'
import { createHistory } from './history'

export type Origin = 'editor' | 'table' | 'history' | 'init'

export interface UseDocument {
  text: string
  doc: SudoersDocument
  warnings: Warning[]
  lastOrigin: Origin
  setText: (text: string, origin?: Origin, at?: number) => void
  updateLine: (index: number, line: Line) => void
  addLine: (line: Line, at?: number) => void
  removeLine: (index: number) => void
  moveLine: (index: number, delta: number) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useDocument(initial: string): UseDocument {
  const [text, setTextState] = useState(initial)
  const [lastOrigin, setLastOrigin] = useState<Origin>('init')
  // canUndo/canRedo are mirrored into state so the component re-renders when they
  // change. The history object itself lives in a ref and is only ever touched
  // inside callbacks (never read during render).
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const history = useRef(createHistory(initial))

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(history.current.canUndo())
    setCanRedo(history.current.canRedo())
  }, [])

  const commit = useCallback(
    (next: string, origin: Origin, at = 0) => {
      setTextState(next)
      setLastOrigin(origin)
      saveActiveText(next, at)
      if (origin !== 'history') history.current.push(next, at)
      syncHistoryFlags()
    },
    [syncHistoryFlags],
  )

  const setText = useCallback(
    (next: string, origin: Origin = 'editor', at = 0) => {
      commit(next, origin, at)
    },
    [commit],
  )

  const doc = useMemo(() => parseDocument(text), [text])
  const warnings = useMemo(() => validateDocument(doc), [doc])

  const writeLines = useCallback(
    (lines: Line[], at = 0) => {
      const next = serializeDocument({ lines })
      commit(next, 'table', at)
    },
    [commit],
  )

  const updateLine = useCallback(
    (index: number, line: Line) => {
      const lines = doc.lines.slice()
      lines[index] = { ...line, dirty: true }
      writeLines(lines)
    },
    [doc, writeLines],
  )

  const addLine = useCallback(
    (line: Line, at = 0) => {
      writeLines([...doc.lines, { ...line, dirty: true }], at)
    },
    [doc, writeLines],
  )

  const removeLine = useCallback(
    (index: number) => {
      writeLines(doc.lines.filter((_, i) => i !== index))
    },
    [doc, writeLines],
  )

  const moveLine = useCallback(
    (index: number, delta: number) => {
      const target = index + delta
      if (target < 0 || target >= doc.lines.length) return
      const lines = doc.lines.slice()
      const [item] = lines.splice(index, 1)
      lines.splice(target, 0, item)
      writeLines(lines)
    },
    [doc, writeLines],
  )

  const undo = useCallback(() => commit(history.current.undo(), 'history'), [commit])
  const redo = useCallback(() => commit(history.current.redo(), 'history'), [commit])

  return {
    text,
    doc,
    warnings,
    lastOrigin,
    setText,
    updateLine,
    addLine,
    removeLine,
    moveLine,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
