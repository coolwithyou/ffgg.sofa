import type { NextConfig } from "next";

/**
 * Next.js 설정
 * [W-007] 보안 헤더 설정
 */
const nextConfig: NextConfig = {
  // Node.js 전용 패키지를 서버 외부 패키지로 지정 (번들링 제외)
  // __dirname 에러 방지
  serverExternalPackages: ['unpdf', 'mammoth', 'pdfjs-dist'],

  // 보안 헤더 설정
  async headers() {
    return [
      {
        // 모든 경로에 적용
        source: "/:path*",
        headers: [
          // XSS 공격 방지
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // MIME 타입 스니핑 방지
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // 클릭재킹 방지
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Referrer 정보 제한
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // HTTPS 강제 (프로덕션)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // 권한 정책
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CSP (Content Security Policy)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js 필요
              "style-src 'self' 'unsafe-inline'", // Tailwind 필요
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://*.neon.tech wss://*.neon.tech",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // 위젯 경로는 iframe 허용 (X-Frame-Options 제외)
        source: "/widget/:path*",
        headers: [
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // 위젯은 iframe 허용
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://*.neon.tech wss://*.neon.tech",
              "frame-ancestors *", // iframe 허용
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // API 라우트에 대한 추가 헤더
        source: "/api/:path*",
        headers: [
          // CORS 설정 (필요시 도메인 제한)
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.ALLOWED_ORIGIN || "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Tenant-ID",
          },
          // 캐시 방지 (민감한 데이터)
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },

  // 이미지 최적화 설정
  images: {
    remotePatterns: [
      // 필요한 외부 이미지 도메인 추가
    ],
  },

  // 환경변수 (클라이언트 노출)
  env: {
    // 클라이언트에서 접근 가능한 환경변수만 여기에
  },

  // 실험적 기능
  experimental: {
    // Server Actions는 Next.js 15에서 기본 활성화
  },
};

export default nextConfig;
