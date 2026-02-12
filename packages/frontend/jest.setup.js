import '@testing-library/jest-dom'

// Setup test environment variables
process.env.NEXT_PUBLIC_NETWORK = 'sepolia'
process.env.NEXT_PUBLIC_SEPOLIA_SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/112389/norosi-experiments/v0.1.5'
process.env.NEXT_PUBLIC_MAINNET_SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/112389/norosi-mainnet/v1.0.0'

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

// Mock window.location (required for LocationBased component tests)
// Make it mutable so tests can modify hostname
delete window.location
window.location = { hostname: 'localhost' }

// Mock isSecureContext (required for LocationBased component tests)
// Make it mutable so tests can modify the value
delete window.isSecureContext
window.isSecureContext = true

// Sensor mocks are now included directly in individual test files
