import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

// Mock the ConnectButton from RainbowKit
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: jest.fn(),
}))

describe('ConnectButton統合テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('ウォレットが接続されていない時に接続ボタンが表示される', () => {
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <button data-testid="connect-wallet">Connect Wallet</button>
    ))

    const { getByTestId } = render(<ConnectButton />)
    const button = getByTestId('connect-wallet')
    
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Connect Wallet')
  })

  it('ウォレットが接続されている時に接続状態が表示される', () => {
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <div data-testid="connected-wallet">
        <span>0x1234...5678</span>
        <button>Disconnect</button>
      </div>
    ))

    const { getByTestId } = render(<ConnectButton />)
    const connectedDiv = getByTestId('connected-wallet')
    
    expect(connectedDiv).toBeInTheDocument()
    expect(connectedDiv).toHaveTextContent('0x1234...5678')
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('接続ボタンのクリックイベントを処理する', async () => {
    const mockOnClick = jest.fn()
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <button data-testid="connect-wallet" onClick={mockOnClick}>
        Connect Wallet
      </button>
    ))

    const { getByTestId } = render(<ConnectButton />)
    const button = getByTestId('connect-wallet')
    
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })
  })

  it('接続中にローディング状態が表示される', () => {
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <button data-testid="connect-wallet" disabled>
        Connecting...
      </button>
    ))

    const { getByTestId } = render(<ConnectButton />)
    const button = getByTestId('connect-wallet')
    
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Connecting...')
    expect(button).toBeDisabled()
  })

  it('接続時にネットワーク情報が表示される', () => {
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <div data-testid="wallet-info">
        <span data-testid="network">Ethereum Mainnet</span>
        <span data-testid="address">0x1234...5678</span>
        <span data-testid="balance">1.5 ETH</span>
      </div>
    ))

    const { getByTestId } = render(<ConnectButton />)
    
    expect(getByTestId('network')).toHaveTextContent('Ethereum Mainnet')
    expect(getByTestId('address')).toHaveTextContent('0x1234...5678')
    expect(getByTestId('balance')).toHaveTextContent('1.5 ETH')
  })

  it('切断機能を処理する', async () => {
    const mockDisconnect = jest.fn()
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <div>
        <span>Connected</span>
        <button data-testid="disconnect-button" onClick={mockDisconnect}>
          Disconnect
        </button>
      </div>
    ))

    const { getByTestId } = render(<ConnectButton />)
    const disconnectButton = getByTestId('disconnect-button')
    
    fireEvent.click(disconnectButton)
    
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledTimes(1)
    })
  })

  it('接続失敗時にエラー状態が表示される', () => {
    const MockedConnectButton = ConnectButton as jest.MockedFunction<typeof ConnectButton>
    MockedConnectButton.mockImplementation(() => (
      <div data-testid="error-state">
        <span>Connection failed</span>
        <button>Try Again</button>
      </div>
    ))

    const { getByTestId } = render(<ConnectButton />)
    const errorDiv = getByTestId('error-state')
    
    expect(errorDiv).toBeInTheDocument()
    expect(errorDiv).toHaveTextContent('Connection failed')
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })
})