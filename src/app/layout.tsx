import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Footer } from '@/components/Footer'
import { DynamicTitle } from '@/components/DynamicTitle'
import { getSiteUrl } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'GullyScore Pro - Cricket Scoring App',
  description:
    'Professional real-time gully cricket scoring platform. Track live scores, player stats, leaderboards and tournaments.',
  metadataBase: new URL(getSiteUrl()),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GullyScore',
  },
  openGraph: {
    title: 'GullyScore Pro',
    description: 'Real-time gully cricket scoring system',
    type: 'website',
    url: getSiteUrl(),
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <Providers>
          <DynamicTitle />
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
