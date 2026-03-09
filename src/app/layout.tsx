import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://myofferagent.com"),
  title: "My Offer Agent | AI Career Agent",
  description:
    "AI-powered career agent — resume building, ATS analysis, job matching, and cover letter generation.",
  manifest: "/site.webmanifest",
  openGraph: {
    title: "My Offer Agent",
    description: "AI가 이력서부터 취업까지 함께합니다",
    type: "website",
    siteName: "My Offer Agent",
  },
  twitter: {
    card: "summary_large_image",
    title: "My Offer Agent",
    description: "AI-powered career agent — resume, ATS, job matching",
  },
  other: {
    "msapplication-TileColor": "#14b8a6",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
