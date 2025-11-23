import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Team3D Task Tracker',
  description: 'Daily tasks tracker with RPG elements',
  icons: {
    icon: '/team3dicon.webp',
    shortcut: '/team3dicon.webp',
    apple: '/team3dicon.webp',
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
        <link rel="icon" href="/team3dicon.webp" type="image/webp" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body>{children}</body>
    </html>
  )
}

