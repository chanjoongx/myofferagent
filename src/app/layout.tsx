import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/ui/Toast";
import { PREFS_INIT_SCRIPT } from "@/lib/prefs-store";
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
  /* 확대를 막지 않습니다. `maximumScale: 1` + `userScalable: false`는
   * 안드로이드 크롬이 실제로 존중해서 핀치 줌이 막히고, WCAG 1.4.4 위반입니다.
   * (원래는 iOS에서 입력 포커스 시 자동 확대를 막으려던 것인데,
   *  그건 입력 폰트를 16px 이상으로 두면 해결됩니다 — 이미 그렇게 되어 있습니다.) */
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://myofferagent.com"),
  title: "My Offer Agent | AI Career Agent",
  description:
    "AI career agent for resume building, ATS analysis, job matching, and cover letter generation.",
  manifest: "/site.webmanifest",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "My Offer Agent",
    description:
      "AI career agent for resume building, ATS analysis, job matching, and cover letter generation.",
    type: "website",
    siteName: "My Offer Agent",
    url: "https://myofferagent.com",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "My Offer Agent, an AI career agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Offer Agent",
    description: "AI career agent for resume building, ATS analysis, and job matching.",
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
      <head>
        {/*
          첫 페인트 **전에** 테마와 언어를 확정합니다.

          서버는 항상 `lang="ko" class="dark"`로 프리렌더합니다 — localStorage와
          navigator.language를 알 수 없기 때문입니다. React가 하이드레이션한 뒤에
          고치면 이미 늦어서, 라이트 테마 사용자는 매 로드마다 다크가 번쩍였습니다.
          이 스크립트는 렌더 차단 위치에서 실행되므로 사용자는 깜빡임을 보지 않습니다.
          (CSP의 script-src에 'unsafe-inline'이 있어 허용됩니다.)
        */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_INIT_SCRIPT }} />
      </head>
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
