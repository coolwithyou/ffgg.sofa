import type { NextConfig } from "next";

/**
 * Next.js 설정
 * [W-007] 보안 헤더 설정
 * [Phase 4] CSP 보안 강화 - 개발/프로덕션 환경 분리
 */

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Turbopack 설정 (Next.js 16+ 기본)
  turbopack: {},

  // react-pdf 호환성을 위한 Webpack 설정 (Turbopack fallback 시 사용)
  // Note: Turbopack에서 canvas: false가 직접 지원되지 않음
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  // Node.js 전용 패키지를 서버 외부 패키지로 지정 (번들링 제외)
  // __dirname 에러 방지 - Vercel 서버리스 환경에서 ESM/CommonJS 호환성 문제 해결
  serverExternalPackages: [
    // 문서 파싱 관련
    'unpdf',
    'mammoth',
    'pdfjs-dist',
    // 백그라운드 작업
    'inngest',
    // 데이터베이스 관련
    '@neondatabase/serverless',
    'drizzle-orm',
  ],

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
          // [Phase 4] 개발 환경에서만 'unsafe-eval' 허용 (HMR용), 프로덕션에서는 제거
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' http://t1.daumcdn.net https://t1.daumcdn.net http://dapi.kakao.com https://dapi.kakao.com`.trim().replace(/\s+/g, ' '), // Next.js + Kakao SDK
              "style-src 'self' 'unsafe-inline'", // Tailwind 필요
              "img-src 'self' data: blob: https: http://*.daumcdn.net https://*.daumcdn.net", // Kakao Maps 타일 이미지
              "font-src 'self' data:",
              `connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://*.neon.tech wss://*.neon.tech https://*.supabase.co https://*.supabase.in wss://*.supabase.co http://dapi.kakao.com https://dapi.kakao.com ${isDev ? "ws://localhost:*" : ""}`.trim().replace(/\s+/g, ' '), // Supabase + Kakao Geocoder API
              "frame-src http://postcode.map.daum.net https://postcode.map.daum.net https://www.google.com https://maps.google.com", // Daum 우편번호 + Google Maps iframe
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
          // [Phase 4] CSP 보안 강화 - 개발/프로덕션 환경 분리
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' https://t1.daumcdn.net https://dapi.kakao.com`.trim().replace(/\s+/g, ' '),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: http://*.daumcdn.net https://*.daumcdn.net", // Kakao Maps 타일 이미지
              "font-src 'self' data:",
              `connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://*.neon.tech wss://*.neon.tech https://*.supabase.co wss://*.supabase.co https://dapi.kakao.com ${isDev ? "ws://localhost:*" : ""}`.trim().replace(/\s+/g, ' '),
              "frame-ancestors *", // iframe 허용
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // 공개 페이지 (슬러그 기반) - iframe 완전 차단
        // /widget, /api, /_next 등 시스템 경로 제외
        source: "/:slug([a-z0-9][a-z0-9-]{1,28}[a-z0-9])",
        headers: [
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // 공개 페이지는 iframe 차단 (클릭재킹 방지)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // [Phase 4] CSP 보안 강화 - 개발/프로덕션 환경 분리
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' https://t1.daumcdn.net https://dapi.kakao.com`.trim().replace(/\s+/g, ' '),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: http://*.daumcdn.net https://*.daumcdn.net", // Kakao Maps 타일 이미지
              "font-src 'self' data:",
              `connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://*.neon.tech wss://*.neon.tech https://*.supabase.co wss://*.supabase.co https://dapi.kakao.com ${isDev ? "ws://localhost:*" : ""}`.trim().replace(/\s+/g, ' '),
              "frame-src https://www.google.com https://maps.google.com", // Google Maps iframe 허용
              "frame-ancestors 'none'", // iframe 완전 차단
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // 공개 페이지 캐싱 (ISR 지원)
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
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
