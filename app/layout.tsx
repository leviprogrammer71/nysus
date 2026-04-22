import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Caveat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { InstallPrompt } from "./install-prompt";
import { BottomNav } from "./components/bottom-nav";
import { MoreMenu } from "./components/more-menu";

// Director's Desk typography stack — see PROGRESS.md § Design System
const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Nysus",
    template: "%s · Nysus",
  },
  description:
    "A filmmaker's notebook for chained AI video generation. Named after Dionysus — patron of theater, ecstatic vision, and the dissolving of boundaries.",
  applicationName: "Nysus",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nysus",
  },
  openGraph: {
    type: "website",
    title: "Nysus — a filmmaker's notebook",
    description:
      "Chained AI video generation, directed by conversation. Clip by clip, frame by frame — each shot seeds the next.",
    siteName: "Nysus",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Nysus — a filmmaker's notebook",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nysus — a filmmaker's notebook",
    description:
      "Chained AI video generation, directed by conversation.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1B2A3A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${hand.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-body">
        {/*
          md:pb-0 because the BottomNav is mobile-only. On small
          screens we reserve the full bar height plus safe-area so
          fixed content doesn't slide under the nav.
        */}
        <div className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
        <BottomNav />
        <MoreMenu />
        <InstallPrompt />
      </body>
    </html>
  );
}
