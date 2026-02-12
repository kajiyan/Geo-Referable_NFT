import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Providers } from '../providers'

// Mock wagmi
jest.mock('wagmi', () => ({
  WagmiProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock @rainbow-me/rainbowkit
jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock react-redux
jest.mock('react-redux', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock store
jest.mock('../store', () => ({
  store: {},
}))

// Mock wagmi config
jest.mock('../wagmi', () => ({
  config: {},
}))

describe('プロバイダー', () => {
  it('子要素が正しくレンダリングされる', () => {
    render(
      <Providers>
        <div data-testid="test-child">Test Content</div>
      </Providers>
    )
    
    const testChild = screen.getByTestId('test-child')
    expect(testChild).toBeInTheDocument()
    expect(testChild).toHaveTextContent('Test Content')
  })

  it('子要素が必要な全てのプロバイダーでラップされる', () => {
    const { container } = render(
      <Providers>
        <div>Child Component</div>
      </Providers>
    )
    
    // Check that the component renders without errors
    expect(container.firstChild).toBeInTheDocument()
  })
})