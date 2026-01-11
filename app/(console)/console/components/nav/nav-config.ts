import {
  LayoutDashboard,
  Bot,
  FileText,
  Code,
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
 * 1차 네비게이션 메뉴 구성 (아웃풋 중심)
 *
 * 구조:
 * - Dashboard: 챗봇 개요, 최근 활동
 * - Chatbot: AI 설정, 문서, 데이터셋, FAQ, 검수, 연동(카카오) - 챗봇 응답 생성 관련
 * - Page: 공개 페이지 디자인 및 설정 - 페이지라는 결과물 중심
 * - Widget: 위젯 디자인 및 임베드 설정 - 위젯이라는 결과물 중심
 *
 * 설계 원칙:
 * - 고객이 보는 "결과물(Output)" 중심으로 메뉴 구성
 * - 관련 기능을 한 곳에 모아 탐색 비용 감소
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
      { id: 'blog', label: '블로그', href: '/console/chatbot/blog' },
      { id: 'validation', label: '문서 검증', href: '/console/chatbot/blog/validation' },
      { id: 'datasets', label: '데이터셋', href: '/console/chatbot/datasets' },
      { id: 'faq', label: 'FAQ', href: '/console/chatbot/faq' },
      { id: 'review', label: '검수', href: '/console/chatbot/review' },
      { id: 'settings', label: '기본 설정', href: '/console/chatbot/settings' },
      { id: 'integrations', label: '연동', href: '/console/chatbot/integrations' },
    ],
  },
  {
    id: 'page',
    label: '페이지',
    icon: FileText,
    subItems: [
      { id: 'design', label: '디자인', href: '/console/page' },
    ],
  },
  {
    id: 'widget',
    label: '위젯',
    icon: Code,
    subItems: [
      { id: 'design', label: '디자인', href: '/console/widget' },
      { id: 'embed', label: '임베드', href: '/console/widget/embed' },
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
