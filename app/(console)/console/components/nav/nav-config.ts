import {
  LayoutDashboard,
  BookOpen,
  Palette,
  Settings,
  Bot,
  type LucideIcon,
} from 'lucide-react';

/**
 * 네비게이션 메뉴 아이템 타입
 */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Secondary Panel에 표시할 서브메뉴 */
  subItems?: {
    id: string;
    label: string;
    href: string;
  }[];
}

/**
 * 1차 네비게이션 메뉴 구성
 *
 * 구조:
 * - Dashboard: 챗봇 개요, 최근 활동
 * - Knowledge: 문서, 데이터셋, FAQ (Phase 2)
 * - Appearance: Page, Widget (현재 Console Editor)
 * - Settings: 일반, AI, 연동
 */
export const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
    href: '/console/dashboard',
  },
  {
    id: 'knowledge',
    label: '지식',
    icon: BookOpen,
    subItems: [
      { id: 'documents', label: '문서', href: '/console/knowledge' },
      { id: 'datasets', label: '데이터셋', href: '/console/knowledge/datasets' },
      { id: 'faq', label: 'FAQ', href: '/console/knowledge/faq' },
      { id: 'review', label: '검수', href: '/console/knowledge/review' },
    ],
  },
  {
    id: 'appearance',
    label: '디자인',
    icon: Palette,
    subItems: [
      { id: 'page', label: 'Page', href: '/console/appearance' },
      { id: 'widget', label: 'Widget', href: '/console/appearance/widget' },
    ],
  },
  {
    id: 'settings',
    label: '설정',
    icon: Settings,
    subItems: [
      { id: 'general', label: '일반', href: '/console/settings' },
      { id: 'ai', label: 'AI', href: '/console/settings/ai' },
      { id: 'integrations', label: '연동', href: '/console/settings/integrations' },
    ],
  },
  {
    id: 'chatbot',
    label: '챗봇',
    icon: Bot,
    subItems: [
      { id: 'chatbot-datasets', label: '데이터셋 연결', href: '/console/chatbot/datasets' },
      { id: 'chatbot-widget', label: '위젯', href: '/console/chatbot/widget' },
      { id: 'chatbot-kakao', label: '카카오', href: '/console/chatbot/kakao' },
      { id: 'chatbot-public-page', label: '공개 페이지', href: '/console/chatbot/public-page' },
    ],
  },
];

/**
 * 네비게이션 ID로 아이템 찾기
 */
export function findNavItem(id: string): NavItem | undefined {
  return navItems.find((item) => item.id === id);
}

/**
 * 현재 경로에서 활성화된 네비게이션 아이템 찾기
 */
export function findActiveNavItem(pathname: string): NavItem | undefined {
  // 정확한 매칭 우선
  for (const item of navItems) {
    if (item.href === pathname) return item;
    if (item.subItems?.some((sub) => sub.href === pathname)) return item;
  }

  // 부분 매칭 (prefix)
  for (const item of navItems) {
    if (item.href && pathname.startsWith(item.href)) return item;
    if (item.subItems?.some((sub) => pathname.startsWith(sub.href))) return item;
  }

  return undefined;
}
