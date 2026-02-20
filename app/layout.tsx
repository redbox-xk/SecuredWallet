import React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const _inter = Inter({ subsets: ["latin"] });
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SecWallet - Secure Ethereum Wallet",
  description:
    "Lightweight, secure Ethereum wallet. Create, recover, send and receive ETH across multiple networks with real-time market data.",
  keywords: [
    "Crypto",
    "Wallet",
    "Ethereum",
    "ETH",
    "Polygon",
    "BNB",
    "Arbitrum",
    "Security",
  ],
  authors: [{ name: "SecWallet" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "SecWallet - Secure Ethereum Wallet",
    description:
      "Lightweight, secure Ethereum wallet with multi-network support and real-time market data.",
    type: "website",
    images: ["/sec-badge.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SecWallet - Secure Ethereum Wallet",
    description:
      "Lightweight, secure Ethereum wallet with multi-network support and real-time market data.",
    images: ["/sec-badge.jpg"],
  },
  icons: {
    icon: "/sec-badge.jpg",
    apple: "/sec-badge.jpg",
  },
    generator: 'v0.app'
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
