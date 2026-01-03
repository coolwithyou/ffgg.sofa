import { redirect } from 'next/navigation';

/**
 * Console 메인 페이지
 *
 * /console 접속 시 /console/page로 리다이렉트
 * (페이지 디자인 에디터가 기본 화면)
 */
export default function ConsolePage() {
  redirect('/console/page');
}
