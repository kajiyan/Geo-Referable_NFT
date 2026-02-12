import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^locar$': '<rootDir>/src/__mocks__/locar.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/src/app/api/'],
  transformIgnorePatterns: [
    'node_modules/(?!(wagmi|@wagmi|@rainbow-me|viem|@tanstack|@noble|@coinbase|@walletconnect|@apollo|graphql)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.ts',
    '!src/app/api/**/*',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig)
