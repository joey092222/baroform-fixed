import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";
import "./acctual-redesign.css";

export const metadata: Metadata = {
  title: "바로폼 | 우리 학교 설문 플랫폼",
  description:
    "학교 안의 설문을 발견하고, 한 문장으로 설문을 만들고, 결과까지 바로 분석하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
