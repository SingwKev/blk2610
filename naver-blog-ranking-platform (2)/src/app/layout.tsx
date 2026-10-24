import type { Metadata } from "next";
import { Noto_Sans_KR, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-kr",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono-num",
  display: "swap",
});

export const metadata: Metadata = {
  title: "블랭크 (BLNK) — 네이버 블로그 지수·순위·멘토링",
  description:
    "네이버 블로그 방문자·검색 노출 진단, 상위 블로거 랭킹, Q&A 멘토링 공간",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${jetbrainsMono.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased selection:bg-[#0071E3]/15 selection:text-[#1D1D1F]">
        {children}
      </body>
    </html>
  );
}
