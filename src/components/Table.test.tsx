import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from './Table'
import { parseDocument } from '../model/parseDocument'

describe('Table', () => {
  const doc = parseDocument('# header\nroot ALL=(ALL) ALL\n')

  it('renders one row per line including comments and blanks', () => {
    render(
      <Table
        doc={doc}
        warnings={[]}
        onEdit={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onMove={() => {}}
      />,
    )
    expect(screen.getByText('Comment')).toBeInTheDocument()
    expect(screen.getByText('User spec')).toBeInTheDocument()
    expect(screen.getByText('Blank')).toBeInTheDocument()
  })

  it('invokes onEdit with the row index', async () => {
    const onEdit = vi.fn()
    render(
      <Table
        doc={doc}
        warnings={[]}
        onEdit={onEdit}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onMove={() => {}}
      />,
    )
    await userEvent.click(screen.getAllByRole('button', { name: /^edit row/i })[1])
    expect(onEdit).toHaveBeenCalledWith(1)
  })

  it('hides comments and blanks when hideNoise is set but preserves indices', async () => {
    const noisyDoc = parseDocument('# header\nroot ALL=(ALL) ALL\n\n')
    const onEdit = vi.fn()
    render(
      <Table
        doc={noisyDoc}
        warnings={[]}
        onEdit={onEdit}
        onDelete={() => {}}
        onDuplicate={() => {}}
        onMove={() => {}}
        hideNoise
      />,
    )
    expect(screen.queryByText('Comment')).not.toBeInTheDocument()
    expect(screen.queryByText('Blank')).not.toBeInTheDocument()
    expect(screen.getByText('User spec')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^edit row/i }))
    expect(onEdit).toHaveBeenCalledWith(1)
  })
})
