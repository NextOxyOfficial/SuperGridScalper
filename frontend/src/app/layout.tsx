import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: "MARK'S AI 3.0 - ADVANCE AI SCALPER | Automated Gold AI Trading",
  description: 'The Most Powerful Automated Gold AI Trading. Experience the future of trading with advanced neural network algorithms.',
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
