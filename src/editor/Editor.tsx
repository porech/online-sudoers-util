import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { sudoersLanguage } from './sudoersLanguage'

interface EditorProps {
  value: string
  onChange: (text: string) => void
}

let testView: EditorView | null = null
// eslint-disable-next-line react-refresh/only-export-components
export const __getTestView = (): EditorView | null => testView
// eslint-disable-next-line react-refresh/only-export-components
export const __setTestView = (v: EditorView | null): void => {
  testView = v
}

export function Editor({ value, onChange }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        keymap.of(defaultKeymap),
        sudoersLanguage,
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })
    const view = new EditorView({ state, parent })
    viewRef.current = view
    __setTestView(view)
    return () => {
      view.destroy()
      viewRef.current = null
      __setTestView(null)
    }
    // Mount once; value is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={host} className="editor" data-testid="editor" />
}
