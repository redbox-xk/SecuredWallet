import React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const _inter = Inter({ subsets: ["latin"] });
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CKS — Crypto Klein Shop | Self-Custody Wallet",
  description:
    "Your Crypto. Your Keys. Your Control. A premium self-custody wallet for secure multi-network Web3 finance.",
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
    title: "CKS — Crypto Klein Shop | Self-Custody Wallet",
    description:
      "Premium self-custody wallet with multi-network support and transparent Web3 finance tools.",
    type: "website",
    images: ["https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Image-5D6E2D7A-WUg9vcEYXUynN6pyVtfGpBo0hTdDwR.jpeg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "CKS — Crypto Klein Shop | Self-Custody Wallet",
    description:
      "Premium self-custody wallet with multi-network support and transparent Web3 finance tools.",
    images: ["https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Image-5D6E2D7A-WUg9vcEYXUynN6pyVtfGpBo0hTdDwR.jpeg"],
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
  themeColor: "#F5F2E9",
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
