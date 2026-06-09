import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Editor, __setTestView, __getTestView } from './Editor'

describe('Editor', () => {
  it('renders initial text', () => {
    render(<Editor value="root ALL=(ALL) ALL" onChange={() => {}} />)
    expect(screen.getByTestId('editor')).toBeInTheDocument()
    // CodeMirror in jsdom renders content in .cm-content
    expect(document.querySelector('.cm-content')?.textContent).toContain('root')
  })

  it('calls onChange when the document changes', () => {
    const onChange = vi.fn()
    render(<Editor value="" onChange={onChange} />)
    const view = __getTestView()
    expect(view).toBeTruthy()
    view!.dispatch({ changes: { from: 0, insert: '# hi' } })
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('#')
  })
})

void __setTestView
