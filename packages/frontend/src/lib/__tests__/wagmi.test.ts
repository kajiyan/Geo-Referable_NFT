import { config } from '../wagmi'

// Mock wagmi
jest.mock('wagmi', () => ({
  createConfig: jest.fn((config) => config),
  http: jest.fn((url) => ({ url })),
  createStorage: jest.fn((config) => config),
}))

// Mock wagmi/chains
jest.mock('wagmi/chains', () => ({
  mainnet: { id: 1, name: 'Ethereum' },
  sepolia: { id: 11155111, name: 'Sepolia' },
}))

// Mock @rainbow-me/rainbowkit
jest.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: jest.fn((config) => config),
}))

// Mock storage constants
jest.mock('@/constants/storage', () => ({
  STORAGE_KEYS: {
    WAGMI_STORAGE: 'norosi-wagmi',
  },
  safeStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}))

describe('Wagmi設定', () => {
  it('configが定義されている', () => {
    expect(config).toBeDefined()
  })

  it('正しいアプリ名が設定されている', () => {
    expect((config as unknown as { appName: string }).appName).toBe('Norosi')
  })

  it('正しいプロジェクトIDが設定されている', () => {
    expect((config as unknown as { projectId: string }).projectId).toBe('dummy-project-id')
  })

  it('mainnetとsepoliaチェーンをサポートしている', () => {
    expect(config.chains).toBeDefined()
    expect(config.chains).toHaveLength(2)
    
    const chainIds = config.chains.map((chain: { id: number }) => chain.id)
    expect(chainIds).toContain(1) // mainnet
    expect(chainIds).toContain(11155111) // sepolia
  })
})