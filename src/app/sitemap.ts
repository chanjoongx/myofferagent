import type { MetadataRoute } from "next";

/**
 * robots.ts와 한 쌍입니다. 현재 정책은 LinkedInBot 외 전체 비허용이라
 * 검색 노출용은 아니지만, 사이트의 공개 경로 두 개를 표준 위치에 선언해
 * 두면 이후 인덱싱을 열 때 이 파일만 그대로 쓰면 됩니다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://myofferagent.com/",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://myofferagent.com/agent",
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
