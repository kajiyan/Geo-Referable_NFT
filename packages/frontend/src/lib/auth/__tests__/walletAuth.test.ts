import { authenticateWallet, generateJWT, verifyJWT, createSiweMessage, generateNonce } from '../walletAuth'

// Mock SiweMessage
jest.mock('siwe', () => ({
  SiweMessage: jest.fn().mockImplementation((config) => ({
    prepareMessage: () => `${config.domain} wants you to sign in with your Ethereum account:\n${config.address}\n\n${config.statement}\n\nURI: ${config.uri}\nVersion: ${config.version}\nChain ID: ${config.chainId}\nNonce: ${config.nonce}\nIssued At: ${config.issuedAt}\nExpiration Time: ${config.expirationTime}`,
    verify: jest.fn().mockResolvedValue({
      data: {
        address: '0x1234567890123456789012345678901234567890'
      }
    })
  }))
}))

describe('walletAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateNonce', () => {
    it('should generate a valid nonce', () => {
      const nonce = generateNonce()
      expect(typeof nonce).toBe('string')
      expect(nonce.length).toBeGreaterThan(10)
    })

    it('should generate different nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()
      expect(nonce1).not.toBe(nonce2)
    })
  })

  describe('createSiweMessage', () => {
    it('should create a valid SIWE message', () => {
      const address = '0x1234567890123456789012345678901234567890'
      const domain = 'example.com'
      const nonce = 'test-nonce'
      const uri = 'https://example.com'

      const result = createSiweMessage(address, domain, nonce, uri)
      
      expect(typeof result).toBe('string')
      expect(result).toContain(address)
      expect(result).toContain(domain)
      expect(result).toContain(nonce)
    })
  })

  describe('generateJWT and verifyJWT', () => {
    it('should generate and verify a valid JWT', async () => {
      const address = '0x1234567890123456789012345678901234567890'
      
      const token = await generateJWT(address)
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3) // JWT has 3 parts
      
      const result = await verifyJWT(token)
      expect(result.valid).toBe(true)
      expect(result.address).toBe(address.toLowerCase())
    })

    it('should reject invalid JWT', async () => {
      const result = await verifyJWT('invalid-token')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('authenticateWallet', () => {
    it('should authenticate valid wallet signature', async () => {
      const address = '0x1234567890123456789012345678901234567890'
      const signature = '0xvalidsignature'
      const message = 'test message'

      const result = await authenticateWallet(address, signature, message)
      
      expect(result.valid).toBe(true)
      expect(result.token).toBeDefined()
      expect(result.address).toBe(address.toLowerCase())
    })

    it('should reject invalid address mismatch', async () => {
      const address = '0xdifferentaddress'
      const signature = '0xvalidsignature'  
      const message = 'test message'

      const result = await authenticateWallet(address, signature, message)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Address mismatch')
    })
  })
})