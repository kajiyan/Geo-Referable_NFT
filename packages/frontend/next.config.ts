import type { NextConfig } from "next";

// NOTE: ONNX Runtime (sky segmentation) と Base Account SDK の COOP 要件が競合するため、
// ページごとに異なるヘッダーを設定する。
// - Base Account SDK を使うページ（ウォレット接続）: COOP を same-origin-allow-popups に設定
//   → keys.coinbase.com へのポップアップ認証を許可
// - ONNX Runtime を使うページ: COOP を same-origin に設定
//   → SharedArrayBuffer のサポートに必要
const nextConfig: NextConfig = {
  compress: true,
  // NOTE: Next.js 16 removed eslint config from next.config.ts
  // ESLint is now run separately via `pnpm lint`

  // Temporarily disable React Strict Mode for WebGL debugging
  // Strict Mode causes double mounting which can affect WebGL contexts
  reactStrictMode: false,

  // Native Node.js addons that must not be bundled (Turbopack/webpack)
  serverExternalPackages: ['@resvg/resvg-js'],

  // Next.js 16 uses Turbopack by default. Empty config silences the warning
  // when webpack config exists but turbopack config is not needed.
  turbopack: {},

  async headers() {
    return [
      // Base Account SDK 互換: メインページ、ミントページなど（ウォレット接続が必要）
      {
        source: '/',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' }
        ]
      },
      {
        source: '/mint/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' }
        ]
      },
      // ONNX Runtime 互換: AR/Sky Segmentation ページ
      {
        source: '/ar/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    // Fix for WalletConnect/MetaMask SDK - mock browser APIs during SSR
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Mock indexedDB and other browser APIs for SSR
        'fake-indexeddb': false,
      };
    }

    // External packages that should not be bundled for SSR
    if (isServer) {
      config.externals.push({
        // Prevent SSR issues with optional dependencies
        'pino-pretty': 'pino-pretty',
        '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage',
      });
    }

    return config;
  },
};

export default nextConfig;
