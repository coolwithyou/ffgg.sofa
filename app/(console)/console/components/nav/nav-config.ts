import {
  LayoutDashboard,
  Bot,
  Palette,
  Settings,
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
 * - Chatbot: AI 설정, 문서, 데이터셋, FAQ, 검수 (챗봇 핵심 기능)
 * - Appearance: Page(공개 페이지), Widget(위젯 설정)
 * - Settings: 일반, 연동(카카오 등)
 *
 * Note: AI 설정은 RAG 파이프라인의 핵심 게이트 역할을 하므로
 * 챗봇 섹션 최상단에 배치하여 중요도를 높임
 */
export const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
    href: '/console/dashboard',
  },
  {
    id: 'chatbot',
    label: '챗봇',
    icon: Bot,
    subItems: [
      { id: 'ai', label: 'AI 설정', href: '/console/chatbot/ai' },
      { id: 'documents', label: '문서', href: '/console/chatbot' },
      { id: 'datasets', label: '데이터셋', href: '/console/chatbot/datasets' },
      { id: 'faq', label: 'FAQ', href: '/console/chatbot/faq' },
      { id: 'review', label: '검수', href: '/console/chatbot/review' },
    ],
  },
  {
    id: 'appearance',
    label: '디자인',
    icon: Palette,
    subItems: [
      { id: 'page', label: '공개 페이지', href: '/console/appearance' },
      { id: 'widget', label: '위젯', href: '/console/appearance/widget' },
    ],
  },
  {
    id: 'settings',
    label: '설정',
    icon: Settings,
    subItems: [
      { id: 'general', label: '일반', href: '/console/settings' },
      { id: 'integrations', label: '연동', href: '/console/settings/integrations' },
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
