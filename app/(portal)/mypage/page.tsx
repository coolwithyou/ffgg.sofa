import { redirect } from 'next/navigation';

/**
 * 마이페이지 기본 라우트
 * /mypage 접근 시 /mypage/profile로 리다이렉트
 */
export default function MyPageRoot() {
  redirect('/mypage/profile');
}
