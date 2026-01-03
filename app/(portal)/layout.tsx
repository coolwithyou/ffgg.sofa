/**
 * 고객 포털 레이아웃
 * [Deprecated] 포탈은 Console로 대체됨 - 모든 포탈 경로를 Console로 리다이렉트
 */

import { redirect } from 'next/navigation';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  // 포탈은 더 이상 사용되지 않음 - Console로 리다이렉트
  redirect('/console');
}
