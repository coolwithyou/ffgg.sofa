'use client';

/**
 * 드롭 인디케이터 컴포넌트
 *
 * 드래그 중인 블록이 삽입될 위치를 시각적으로 표시합니다.
 * - 블록 크기를 미리 보여주는 고스트 영역
 * - 애니메이션 효과로 사용자 주목도 향상
 */

import { cn } from '@/lib/utils';
import {
  BLOCK_METAS,
  type BlockTypeValue,
} from '@/lib/public-page/block-types';
import {
  LayoutTemplate,
  MessageSquare,
  Square,
  Link,
  Type,
  Minus,
  Share2,
  Image,
  Images,
  Video,
  HelpCircle,
  FileText,
  MapPin,
  Bot,
  BookOpen,
  Sparkles,
  Clock,
  type LucideIcon,
} from 'lucide-react';

/**
 * 아이콘 매핑
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutTemplate,
  MessageSquare,
  Square,
  Link,
  Type,
  Minus,
  Share2,
  Image,
  Images,
  Video,
  HelpCircle,
  FileText,
  MapPin,
  // Phase 3 블록 (SOFA 차별화)
  Bot,
  BookOpen,
  Sparkles,
  Clock,
};

/**
 * 블록 타입별 예상 높이 (px)
 */
const BLOCK_HEIGHT_MAP: Record<BlockTypeValue, number> = {
  header: 120,
  chatbot: 400,
  placeholder: 80,
  // Phase 1 블록
  link: 64,
  text: 48,
  divider: 32,
  social_icons: 56,
  // Phase 2 블록
  image: 280,
  image_carousel: 280,
  video: 280,
  faq_accordion: 200,
  contact_form: 300,
  map: 280,
  // Phase 3 블록 (SOFA 차별화)
  ai_chat_preview: 200,
  knowledge_base_link: 100,
  faq_quick_actions: 120,
  conversation_starter: 150,
  operating_hours: 250,
};

interface DropIndicatorProps {
  /** 드래그 중인 블록 타입 */
  blockType: BlockTypeValue;
  /** 추가 클래스 */
  className?: string;
}

export function DropIndicator({ blockType, className }: DropIndicatorProps) {
  const meta = BLOCK_METAS[blockType];
  const Icon = ICON_MAP[meta.icon] ?? Square;
  const height = BLOCK_HEIGHT_MAP[blockType] ?? 80;

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed border-primary bg-primary/5',
        'flex items-center justify-center',
        'animate-pulse transition-all duration-200',
        className
      )}
      style={{ minHeight: `${height}px` }}
    >
      {/* 블록 정보 표시 */}
      <div className="flex flex-col items-center gap-2 text-primary">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium">{meta.name} 블록 추가</span>
      </div>

      {/* 모서리 장식 */}
      <div className="absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-primary rounded-tl" />
      <div className="absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-primary rounded-tr" />
      <div className="absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-primary rounded-bl" />
      <div className="absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-primary rounded-br" />
    </div>
  );
}
