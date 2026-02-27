import type { Metadata } from 'next'
import { Space_Mono, Barlow_Condensed } from 'next/font/google'
import './globals.css'

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Veo Geo League',
  description: 'High-stakes GeoGuessr tracker for the league',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${barlowCondensed.variable}`}>
      <body className="bg-veo-bg text-veo-text font-body antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
