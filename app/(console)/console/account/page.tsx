import { redirect } from 'next/navigation';

/**
 * /console/account 접근 시 프로필 페이지로 리다이렉트
 */
export default function AccountPage() {
  redirect('/console/account/profile');
}
