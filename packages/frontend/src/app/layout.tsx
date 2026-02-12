// Import SSR polyfills FIRST to mock browser APIs for server-side rendering
import "@/lib/ssr-polyfills";
import { GoogleTagManager } from "@next/third-parties/google";
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { FallbackIndicator } from "@/components/features/FallbackIndicator";
import { ClientLayout } from "@/components/layout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

// Subset font for date/time display (7.8KB, contains only datetime characters)
const robotoCondensedDateTime = localFont({
  src: "./fonts/RobotoCondensed-DateTime.woff2",
  variable: "--font-datetime",
  display: "swap",
});

// Norosi weather icon font (3.9KB, contains weather icons U+E900-U+E90C)
const norosiIcon = localFont({
  src: "./fonts/Norosi-Regular.woff2",
  variable: "--font-norosi-icon",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NOROSI — Location-Based NFT Network",
    template: "%s | NOROSI",
  },
  description:
    "Mint location-based NFTs connected through a global exploration network. Each token encodes real coordinates on Earth, linked by proximity and discovery.",
  metadataBase: new URL("https://norosi.xyz"),
  openGraph: {
    type: "website",
    siteName: "NOROSI",
    title: "NOROSI — Location-Based NFT Network",
    description:
      "Mint location-based NFTs connected through a global exploration network. Each token encodes real coordinates on Earth, linked by proximity and discovery.",
    url: "https://norosi.xyz",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NOROSI — Location-Based NFT Network",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOROSI — Location-Based NFT Network",
    description:
      "Mint location-based NFTs connected through a global exploration network.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "theme-color": "#0a0a0a",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${robotoCondensedDateTime.variable} ${norosiIcon.variable}`}
    >
      {process.env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      )}
      <body className="antialiased">
        <Providers>
          <FallbackIndicator />
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
