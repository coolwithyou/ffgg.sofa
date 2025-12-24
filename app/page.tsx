'use client';

/**
 * 랜딩 페이지
 * [Week 12] 런칭 준비
 */

import Link from 'next/link';
import { useState } from 'react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="fixed top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold text-gray-900">SOFA</span>
          </div>

          {/* 데스크톱 메뉴 */}
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-gray-600 hover:text-gray-900">
              기능
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900">
              요금
            </a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900">
              FAQ
            </a>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              무료로 시작하기
            </Link>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="메뉴 열기"
          >
            <svg
              className="h-6 w-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {mobileMenuOpen && (
          <div className="border-t bg-white md:hidden">
            <div className="space-y-1 px-4 py-3">
              <a
                href="#features"
                className="block py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                기능
              </a>
              <a
                href="#pricing"
                className="block py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                요금
              </a>
              <a
                href="#faq"
                className="block py-2 text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
              <Link
                href="/login"
                className="block py-2 text-gray-600 hover:text-gray-900"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="mt-2 block rounded-lg bg-orange-500 py-2 text-center text-sm font-medium text-white hover:bg-orange-600"
              >
                무료로 시작하기
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              기업 문서를 이해하는
              <br />
              <span className="text-orange-500">AI 고객상담 챗봇</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              PDF, Word, Excel 문서를 업로드하면 AI가 자동으로 학습합니다.
              <br />
              카카오톡, 웹 위젯으로 24시간 고객 상담을 제공하세요.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-lg bg-orange-500 px-6 py-3 text-lg font-semibold text-white shadow-lg hover:bg-orange-600"
              >
                14일 무료 체험
              </Link>
              <a
                href="#demo"
                className="rounded-lg border border-gray-300 px-6 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                데모 보기
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              신용카드 불필요 · 언제든 취소 가능
            </p>
          </div>
        </div>

        {/* 데모 이미지 영역 */}
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border bg-gray-100 shadow-2xl">
            <div className="flex items-center gap-2 border-b bg-gray-200 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400"></div>
              <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
              <div className="h-3 w-3 rounded-full bg-green-400"></div>
            </div>
            <div className="aspect-video bg-gradient-to-br from-orange-50 to-orange-100 p-8">
              <div className="flex h-full items-center justify-center text-gray-500">
                <span className="text-lg">대시보드 스크린샷</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 섹션 */}
      <section id="features" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              비즈니스에 최적화된 AI 챗봇
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              복잡한 설정 없이 바로 시작하세요
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* 기능 1 */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <DocumentIcon className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                문서 자동 학습
              </h3>
              <p className="mt-2 text-gray-600">
                PDF, Word, Excel 파일을 업로드하면 AI가 자동으로 내용을 분석하고
                학습합니다.
              </p>
            </div>

            {/* 기능 2 */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <ChatIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                카카오톡 연동
              </h3>
              <p className="mt-2 text-gray-600">
                카카오톡 채널과 연동하여 고객이 익숙한 플랫폼에서 상담을 받을 수
                있습니다.
              </p>
            </div>

            {/* 기능 3 */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <WidgetIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                웹 위젯 임베드
              </h3>
              <p className="mt-2 text-gray-600">
                간단한 코드 삽입으로 웹사이트에 챗봇을 추가하세요. 브랜드에 맞게
                커스터마이징 가능합니다.
              </p>
            </div>

            {/* 기능 4 */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <ShieldIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                데이터 보안
              </h3>
              <p className="mt-2 text-gray-600">
                기업별 데이터 격리, 암호화 저장으로 민감한 정보를 안전하게
                보호합니다.
              </p>
            </div>

            {/* 기능 5 */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                <ChartIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                상담 분석
              </h3>
              <p className="mt-2 text-gray-600">
                고객 질문 패턴, 응답 만족도를 분석하여 서비스 개선에
                활용하세요.
              </p>
            </div>

            {/* 기능 6 */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                <SupportIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                전담 지원
              </h3>
              <p className="mt-2 text-gray-600">
                문서 검토, 챗봇 최적화까지 전담 매니저가 함께합니다. 기술 지원도
                물론 포함.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 요금 섹션 */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              합리적인 요금제
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              사용량에 맞게 선택하세요
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {/* 스타터 플랜 */}
            <div className="rounded-2xl border bg-white p-8">
              <h3 className="text-lg font-semibold text-gray-900">스타터</h3>
              <p className="mt-2 text-sm text-gray-600">소규모 비즈니스</p>
              <p className="mt-6">
                <span className="text-4xl font-bold text-gray-900">₩49,000</span>
                <span className="text-gray-600">/월</span>
              </p>
              <ul className="mt-8 space-y-4">
                <PricingFeature>월 1,000건 대화</PricingFeature>
                <PricingFeature>문서 10개 업로드</PricingFeature>
                <PricingFeature>웹 위젯</PricingFeature>
                <PricingFeature>이메일 지원</PricingFeature>
              </ul>
              <Link
                href="/signup?plan=starter"
                className="mt-8 block w-full rounded-lg border border-orange-500 py-3 text-center font-medium text-orange-500 hover:bg-orange-50"
              >
                시작하기
              </Link>
            </div>

            {/* 프로 플랜 */}
            <div className="relative rounded-2xl border-2 border-orange-500 bg-white p-8">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-1 text-sm font-medium text-white">
                인기
              </div>
              <h3 className="text-lg font-semibold text-gray-900">프로</h3>
              <p className="mt-2 text-sm text-gray-600">성장하는 기업</p>
              <p className="mt-6">
                <span className="text-4xl font-bold text-gray-900">₩149,000</span>
                <span className="text-gray-600">/월</span>
              </p>
              <ul className="mt-8 space-y-4">
                <PricingFeature>월 5,000건 대화</PricingFeature>
                <PricingFeature>문서 50개 업로드</PricingFeature>
                <PricingFeature>웹 위젯 + 카카오톡</PricingFeature>
                <PricingFeature>상담 분석 리포트</PricingFeature>
                <PricingFeature>우선 지원</PricingFeature>
              </ul>
              <Link
                href="/signup?plan=pro"
                className="mt-8 block w-full rounded-lg bg-orange-500 py-3 text-center font-medium text-white hover:bg-orange-600"
              >
                시작하기
              </Link>
            </div>

            {/* 엔터프라이즈 플랜 */}
            <div className="rounded-2xl border bg-white p-8">
              <h3 className="text-lg font-semibold text-gray-900">엔터프라이즈</h3>
              <p className="mt-2 text-sm text-gray-600">대기업/맞춤 솔루션</p>
              <p className="mt-6">
                <span className="text-4xl font-bold text-gray-900">문의</span>
              </p>
              <ul className="mt-8 space-y-4">
                <PricingFeature>무제한 대화</PricingFeature>
                <PricingFeature>무제한 문서</PricingFeature>
                <PricingFeature>모든 채널 지원</PricingFeature>
                <PricingFeature>전용 인프라</PricingFeature>
                <PricingFeature>SLA 보장</PricingFeature>
                <PricingFeature>전담 매니저</PricingFeature>
              </ul>
              <a
                href="mailto:contact@sofa.ai"
                className="mt-8 block w-full rounded-lg border border-gray-300 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
              >
                문의하기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ 섹션 */}
      <section id="faq" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              자주 묻는 질문
            </h2>
          </div>

          <div className="mt-12 space-y-6">
            <FAQItem question="어떤 문서 형식을 지원하나요?">
              PDF, Word (.docx), Excel (.xlsx, .csv), 텍스트 파일을 지원합니다.
              이미지가 포함된 문서도 처리 가능하며, 표 형식 데이터도 정확하게
              학습합니다.
            </FAQItem>
            <FAQItem question="카카오톡 연동은 어떻게 하나요?">
              카카오 채널을 보유하고 있다면 오픈빌더 스킬 서버 연동을 통해
              간단하게 설정할 수 있습니다. 상세 가이드와 함께 전담 지원을
              제공합니다.
            </FAQItem>
            <FAQItem question="학습된 데이터는 안전한가요?">
              모든 데이터는 테넌트별로 완전히 격리되며, 암호화되어 저장됩니다.
              외부에 공유되거나 다른 고객의 AI 학습에 사용되지 않습니다.
            </FAQItem>
            <FAQItem question="무료 체험 후 자동 결제되나요?">
              아니요. 14일 무료 체험 후 유료 플랜을 직접 선택하셔야 결제가
              진행됩니다. 자동 결제 없이 안심하고 체험하세요.
            </FAQItem>
            <FAQItem question="기존 문서를 수정하면 챗봇도 업데이트되나요?">
              네. 문서를 수정하거나 새 버전을 업로드하면 자동으로 재학습됩니다.
              검토 후 즉시 반영됩니다.
            </FAQItem>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="bg-orange-500 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            지금 바로 시작하세요
          </h2>
          <p className="mt-4 text-lg text-orange-100">
            14일 무료 체험으로 SOFA의 가치를 직접 확인하세요
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-lg font-semibold text-orange-500 hover:bg-gray-100"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
                <span className="text-lg font-bold text-white">S</span>
              </div>
              <span className="text-xl font-bold text-gray-900">SOFA</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-600">
              <a href="/privacy" className="hover:text-gray-900">
                개인정보처리방침
              </a>
              <a href="/terms" className="hover:text-gray-900">
                이용약관
              </a>
              <a href="mailto:contact@sofa.ai" className="hover:text-gray-900">
                문의하기
              </a>
            </div>
            <p className="text-sm text-gray-500">
              © 2024 SOFA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// 가격표 기능 아이템
function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <svg
        className="h-5 w-5 text-orange-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span className="text-gray-600">{children}</span>
    </li>
  );
}

// FAQ 아이템
function FAQItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-white">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium text-gray-900">{question}</span>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t px-6 py-4">
          <p className="text-gray-600">{children}</p>
        </div>
      )}
    </div>
  );
}

// 아이콘들
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function WidgetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}
