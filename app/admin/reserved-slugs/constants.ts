/**
 * 예약 슬러그 상수 정의
 */

// 카테고리 타입
export const CATEGORIES = ['profanity', 'brand', 'premium', 'system', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// 카테고리 라벨
export const CATEGORY_LABELS: Record<Category, string> = {
  profanity: '부적절한 표현',
  brand: '브랜드',
  premium: '프리미엄',
  system: '시스템',
  other: '기타',
};

// 카테고리 스타일
export const CATEGORY_STYLES: Record<Category, string> = {
  profanity: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  brand: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  premium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  system: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

// 예약 슬러그 아이템 인터페이스
export interface ReservedSlugItem {
  id: string;
  slug: string;
  category: string;
  reason: string | null;
  createdAt: Date | null;
  createdByName: string | null;
  createdByEmail: string | null;
}
