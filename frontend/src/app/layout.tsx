import type { Metadata, Viewport } from 'next'
import { Inter, Orbitron } from 'next/font/google'
import './globals.css'
import SupportWidget from '@/components/SupportWidget'
import Footer from '@/components/Footer'
import { SiteSettingsProvider } from '@/context/SiteSettingsContext'

const inter = Inter({ subsets: ['latin'] })
const orbitron = Orbitron({ 
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "MARK'S AI 3.0 - ADVANCE AI SCALPER | Automated Gold AI Trading",
  description: 'The Most Powerful Automated Gold AI Trading. Start earning with AI — no trading experience needed. 24/5 automated trading, 70-250% expected profit, start with just $10.',
  metadataBase: new URL('https://markstrades.com'),
  openGraph: {
    title: "MARK'S AI 3.0 — Automated Gold AI Trading",
    description: 'Start earning with AI-powered trading. No experience needed. 24/5 automated gold scalping with 70-250% expected profit. Start with just $10.',
    url: 'https://markstrades.com',
    siteName: "Mark's AI Trading",
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: "MARK'S AI 3.0 — Automated Gold AI Trading",
    description: 'Start earning with AI-powered trading. No experience needed. 24/5 automated gold scalping. Start with just $10.',
  },
  other: {
    'theme-color': '#06b6d4',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} ${orbitron.variable}`}>
        <SiteSettingsProvider>
          {children}
          <Footer />
          <SupportWidget />
        </SiteSettingsProvider>
      </body>
    </html>
  )
}
