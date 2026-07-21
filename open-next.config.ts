// OpenNext Cloudflare 어댑터 설정
// @opennextjs/cloudflare가 Next.js 앱을 Cloudflare Workers에서 실행할 수 있도록 변환
// (기본값 사용: incremental cache는 "dummy" — TECHNICAL.md §14 참고)
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
