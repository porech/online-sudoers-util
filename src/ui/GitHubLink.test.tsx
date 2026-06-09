import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GitHubLink } from './GitHubLink'

describe('GitHubLink', () => {
  it('links to the repository in a new tab', () => {
    render(<GitHubLink />)
    const link = screen.getByRole('link', { name: /view source on github/i })
    expect(link).toHaveAttribute('href', 'https://github.com/porech/online-sudoers-util')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
