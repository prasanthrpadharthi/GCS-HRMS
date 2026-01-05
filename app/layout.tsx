import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AlertProvider } from "@/components/ui/alert-custom"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GCS Attendance System",
  description: "Employee attendance and leave management system for GCS",
  generator: "v0.app",
  manifest: "/manifest.json",
  keywords: ["attendance", "leave management", "employee", "GCS"],
  authors: [{ name: "GCS" }],
  icons: {
    icon: [
      {
        url: "/images/image.jpeg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/images/image.jpeg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/images/image.jpeg",
  },
}

export const viewport: Viewport = {
  themeColor: "#B45309",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GCS Attendance" />
      </head>
      <body className={`font-sans antialiased`}>
        <AlertProvider>
          {children}
          <Analytics />
        </AlertProvider>
      </body>
    </html>
  )
}
