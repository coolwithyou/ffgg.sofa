import { redirect } from 'next/navigation';

/**
 * Console 메인 페이지
 *
 * /console 접속 시 /console/appearance로 리다이렉트
 * (계획: 첫 페이지는 Appearance)
 */
export default function ConsolePage() {
  redirect('/console/appearance');
}
