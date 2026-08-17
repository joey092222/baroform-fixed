import type { NextConfig } from "next";

const htmlLimitedBots =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|KAKAOTALK|kakaotalk-scrap|kakao/i;

const nextConfig: NextConfig = {
  // Kakao's scraper needs metadata in the initial <head>, not streamed later.
  htmlLimitedBots,
};

export default nextConfig;
