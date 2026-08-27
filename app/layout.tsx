import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import {
  defaultOpenGraphImagePath,
  defaultSiteDescription,
  defaultSiteTitle,
  getSiteUrl,
} from "./survey-share";
import { PwaRegister } from "./pwa-register";
import "./design-tokens.css";
import "./editorial-pages.css";
import "./studio.css";
import "./secondary-pages.css";
import "./results-dashboard.css";
import "./plaza.css";

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
    icon: "/favicon.svg?v=2",
    shortcut: "/favicon.svg?v=2",
    apple: [{ url: "/pwa/apple-touch-icon.png?v=2", sizes: "180x180" }],
  },
  applicationName: "바로폼",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "바로폼",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f5fa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
