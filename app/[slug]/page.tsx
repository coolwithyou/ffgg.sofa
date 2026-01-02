/**
 * 공개 페이지 서버 컴포넌트
 *
 * Linktree 스타일 독립 페이지로, 슬러그로 챗봇을 조회하여 렌더링합니다.
 * - 예약어 슬러그는 404 반환
 * - publicPageEnabled가 false인 챗봇도 404 반환
 * - ISR 캐싱으로 5분마다 재검증
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { db, chatbots, tenants } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { isReservedSlug } from '@/lib/public-page/reserved-slugs';
import { parsePublicPageConfig } from '@/lib/public-page/types';
import { PublicPageView } from './public-page-view';

interface PublicPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 슬러그로 챗봇 조회
 */
async function getChatbotBySlug(slug: string) {
  const result = await db
    .select({
      id: chatbots.id,
      name: chatbots.name,
      tenantId: chatbots.tenantId,
      slug: chatbots.slug,
      publicPageEnabled: chatbots.publicPageEnabled,
      publicPageConfig: chatbots.publicPageConfig,
      widgetConfig: chatbots.widgetConfig,
    })
    .from(chatbots)
    .innerJoin(tenants, eq(chatbots.tenantId, tenants.id))
    .where(
      and(
        eq(chatbots.slug, slug),
        eq(chatbots.publicPageEnabled, true),
        eq(tenants.status, 'active')
      )
    )
    .limit(1);

  return result[0] || null;
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { slug } = await params;

  // 예약어 체크
  if (isReservedSlug(slug)) {
    notFound();
  }

  // 챗봇 조회
  const chatbot = await getChatbotBySlug(slug);

  if (!chatbot) {
    notFound();
  }

  // 공개 페이지 설정 파싱
  const config = parsePublicPageConfig(chatbot.publicPageConfig);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <PublicPageView
        chatbotId={chatbot.id}
        chatbotName={chatbot.name}
        tenantId={chatbot.tenantId}
        config={config}
        widgetConfig={chatbot.widgetConfig as Record<string, unknown> | null}
      />
    </Suspense>
  );
}

/**
 * 동적 메타데이터 생성 (SEO)
 */
export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;

  // 예약어는 메타데이터 생성 불필요
  if (isReservedSlug(slug)) {
    return { title: 'Not Found' };
  }

  const chatbot = await getChatbotBySlug(slug);

  if (!chatbot) {
    return { title: 'Not Found' };
  }

  const config = parsePublicPageConfig(chatbot.publicPageConfig);
  const title = config.seo.title || config.header.title || chatbot.name;
  const description = config.seo.description || config.header.description || `${chatbot.name}과 대화하세요`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: config.seo.ogImage ? [config.seo.ogImage] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: config.seo.ogImage ? [config.seo.ogImage] : [],
    },
  };
}

// ISR 캐싱 (5분)
export const revalidate = 300;
