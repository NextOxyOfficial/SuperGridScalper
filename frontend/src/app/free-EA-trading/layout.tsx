import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "FREE AI Gold Trading Bot — Mark's AI 3.0 | No Payment Required",
  description: 'Get a completely FREE AI-powered gold trading bot license. Open an Exness Standard Cent account through our link, claim your free license, and start automated trading with just $10. 24/5 automated gold scalping, 70-250% expected profit.',
  openGraph: {
    title: "🎁 FREE AI Gold Trading Bot — Start Trading for $0",
    description: 'Get a FREE license for our AI-powered gold trading bot. Open an Exness account through our link, claim your free license, and let AI trade gold for you 24/5. Start with just $10 deposit — zero subscription cost!',
    url: 'https://markstrades.com/free-EA-trading',
    siteName: "Mark's AI Trading",
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: "🎁 FREE AI Gold Trading Bot — No Payment Required",
    description: 'Get a FREE AI trading bot license. Open an Exness account through our link and start automated gold trading with just $10. Zero subscription cost!',
  },
}

export default function FreeTradingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
