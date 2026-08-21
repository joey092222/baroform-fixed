import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import {
  defaultOpenGraphImagePath,
  defaultSiteDescription,
  defaultSiteTitle,
  getSiteUrl,
} from "./survey-share";
import "./design-tokens.css";
import "./editorial-pages.css";
import "./studio.css";
import "./secondary-pages.css";
import "./results-dashboard.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: defaultSiteTitle,
  description: defaultSiteDescription,
  openGraph: {
    title: defaultSiteTitle,
    description: defaultSiteDescription,
    type: "website",
    siteName: "바로폼",
    locale: "ko_KR",
    url: "/",
    images: [
      {
        url: defaultOpenGraphImagePath,
        width: 800,
        height: 400,
        alt: "바로폼 설문 플랫폼",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultSiteTitle,
    description: defaultSiteDescription,
    images: [defaultOpenGraphImagePath],
  },
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
