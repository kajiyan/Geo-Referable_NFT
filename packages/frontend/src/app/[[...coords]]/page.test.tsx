import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from './page'

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({ isConnected: false, address: undefined })),
  useWriteContract: jest.fn(() => ({
    writeContract: jest.fn(),
    isPending: false,
    error: null
  })),
  useWaitForTransactionReceipt: jest.fn(() => ({
    isLoading: false,
    isSuccess: false
  }))
}))

// Mock utils
jest.mock('@/utils', () => ({
  calculateH3Indices: jest.fn(() => ({
    h3r6: 'test-h3r6',
    h3r8: 'test-h3r8',
    h3r10: 'test-h3r10',
    h3r12: 'test-h3r12'
  })),
  verifyH3Values: jest.fn(() => true),
  H3MismatchError: class H3MismatchError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'H3MismatchError'
    }
  }
}))

// Mock useNorosi hook
jest.mock('@/hooks/useNorosi', () => ({
  useNorosi: jest.fn(() => ({
    signedMint: jest.fn(),
    signedMintWithChain: jest.fn(),
    isPending: false,
    isConfirming: false,
    isConfirmed: false,
    error: null,
    hash: null
  }))
}))

// Mock RainbowKit ConnectButton
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => {
    return <button>Connect Wallet</button>
  },
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string; width?: number; height?: number }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

describe('Norosi NFT ホームページ', () => {
  it('ConnectButtonコンポーネントが表示される', () => {
    render(<Home />)
    const connectButton = screen.getByText('Connect Wallet')
    expect(connectButton).toBeInTheDocument()
  })

  it('Norosi NFTタイトルが表示される', () => {
    render(<Home />)
    const title = screen.getByText('Norosi NFT')
    expect(title).toBeInTheDocument()
  })

  it('Welcome to Norosiメッセージが表示される', () => {
    render(<Home />)
    const welcomeText = screen.getByText('Welcome to Norosi')
    expect(welcomeText).toBeInTheDocument()
  })

  it('説明テキストが表示される', () => {
    render(<Home />)
    const descriptionText = screen.getByText('Mint your location-based NFT with weather and elevation data')
    expect(descriptionText).toBeInTheDocument()
  })

  it('ミントタブが表示される', () => {
    render(<Home />)
    const newMintTab = screen.getByText('New Mint')
    const chainMintTab = screen.getByText('Chain Mint')
    
    expect(newMintTab).toBeInTheDocument()
    expect(chainMintTab).toBeInTheDocument()
  })

  it('フッターが表示される', () => {
    render(<Home />)
    const footerText = screen.getByText('© 2024 Norosi NFT. Built with Next.js and Smart Contracts.')
    expect(footerText).toBeInTheDocument()
  })
})