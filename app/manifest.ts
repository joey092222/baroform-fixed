import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?app=1",
    name: "바로폼 — 대학생 설문 플랫폼",
    short_name: "바로폼",
    description: "학교의 생각을 가장 빠르게 모으고 확인하는 대학생 설문 플랫폼",
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    background_color: "#f2f5fa",
    theme_color: "#0a1c39",
    lang: "ko-KR",
    categories: ["education", "productivity", "social"],
    icons: [
      {
        src: "/pwa/icon-192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
