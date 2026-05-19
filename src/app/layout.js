import Script from 'next/script';

export const metadata = {
  title: 'CryptoPulse | Live Cryptocurrency Market Data & Prices',
  description: 'Track real-time cryptocurrency prices, 24h changes, market cap, and volume across Bitcoin, Ethereum, and thousands of altcoins. Live data, zero delay.',
  keywords: ['cryptocurrency', 'crypto prices', 'bitcoin price', 'ethereum price', 'live crypto market', 'crypto tracker', 'altcoin prices', 'market cap', 'crypto pulse'],
  authors: [{ name: 'CryptoPulse' }],
  other: {
    'google-adsense-account': 'ca-pub-7322019754286753'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    type: 'website',
    title: 'CryptoPulse | Live Cryptocurrency Market Data & Prices',
    description: 'Real-time cryptocurrency market data aggregator with live price updates, 24h changes, and volume tracking across all major coins.',
    siteName: 'CryptoPulse',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CryptoPulse | Live Crypto Market Data',
    description: 'Track real-time crypto prices and market movements with CryptoPulse.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7322019754286753"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
