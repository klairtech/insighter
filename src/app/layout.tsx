import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ClientProviders } from "@/components/providers/ClientProviders";
import GoogleTagManager, {
  GoogleTagManagerNoScript,
} from "@/components/GoogleTagManager";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Insighter - AI-Powered Data Analytics Platform",
  description:
    "A comprehensive data analysis platform that connects databases, processes files, and provides AI-powered insights through natural language conversations.",
  keywords: [
    "AI",
    "data analytics",
    "database",
    "insights",
    "chat",
    "analytics platform",
  ],
  authors: [{ name: "Insighter Team" }],
  robots: "index, follow",
  icons: {
    icon: [
      {
        url: "/favicon.svg?v=3",
        type: "image/svg+xml",
      },
      { url: "/favicon.ico?v=3", sizes: "any" },
    ],
    apple: {
      url: "/favicon.svg?v=3",
      type: "image/svg+xml",
    },
  },
  openGraph: {
    title: "Insighter - AI-Powered Data Analytics Platform",
    description:
      "Connect databases, process files, and get AI-powered insights through natural language conversations.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" href="/favicon.svg?v=3" />
        <GoogleTagManager />
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} antialiased bg-background text-foreground`}
      >
        <GoogleTagManagerNoScript />
        <ClientProviders>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <AnalyticsProvider>
              <div className="min-h-screen bg-background">
                <Navigation />
                <main className="flex-1 pt-24">{children}</main>
              </div>
            </AnalyticsProvider>
          </Suspense>
        </ClientProviders>
      </body>
    </html>
  );
}
