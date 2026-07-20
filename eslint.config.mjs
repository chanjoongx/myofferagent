import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // cf:build 산출물 — 없으면 `npm run lint`가 컴파일된 worker.js와 수천 개의
    // 생성 청크를 훑어 느려지거나 실패합니다.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
