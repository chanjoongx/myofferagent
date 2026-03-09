import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // pdfjs-dist는 클라이언트 전용 — 서버에서 canvas 참조 시 에러 방지
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
