import { render, screen } from '@testing-library/react'

import { OrientationProvider } from '../OrientationProvider'

describe('OrientationProvider', () => {
  it('renders its children and nothing else', () => {
    const { container } = render(<OrientationProvider>hello</OrientationProvider>)
    expect(screen.getByText('hello')).toBeTruthy()
    expect(container.innerHTML).toBe('hello')
  })
})
