/**
 * 포인트 패키지 시드 데이터
 * [Billing System] 추가 포인트 구매 패키지 정의
 *
 * 패키지:
 * - points_5000: 5,000P / ₩30,000 (6원/P)
 * - points_10000: 10,000P / ₩50,000 (5원/P, 17% 할인)
 *
 * 사용법:
 *   pnpm tsx drizzle/seed/point-packages.ts
 */

import { db } from '@/lib/db';
import { pointPackages, type NewPointPackage } from '../schema';
import { POINT_PACKAGES } from '@/lib/billing/constants';

export const pointPackagesSeed: NewPointPackage[] = [
  {
    id: POINT_PACKAGES.points_5000.id,
    name: POINT_PACKAGES.points_5000.name,
    description: '기본 포인트 패키지',
    points: POINT_PACKAGES.points_5000.points,
    price: POINT_PACKAGES.points_5000.price,
    pricePerPoint: POINT_PACKAGES.points_5000.pricePerPoint,
    discountPercent: POINT_PACKAGES.points_5000.discountPercent,
    isActive: true,
    sortOrder: 0,
  },
  {
    id: POINT_PACKAGES.points_10000.id,
    name: POINT_PACKAGES.points_10000.name,
    description: '대용량 포인트 패키지 (17% 할인)',
    points: POINT_PACKAGES.points_10000.points,
    price: POINT_PACKAGES.points_10000.price,
    pricePerPoint: POINT_PACKAGES.points_10000.pricePerPoint,
    discountPercent: POINT_PACKAGES.points_10000.discountPercent,
    isActive: true,
    sortOrder: 1,
  },
];

/**
 * 포인트 패키지 시드 실행
 * - 기존 패키지가 있으면 업데이트 (upsert)
 * - 새 패키지면 추가
 */
export async function seedPointPackages() {
  console.log('💎 포인트 패키지 시드 데이터 삽입 시작...');

  for (const pkg of pointPackagesSeed) {
    await db
      .insert(pointPackages)
      .values(pkg)
      .onConflictDoUpdate({
        target: pointPackages.id,
        set: {
          name: pkg.name,
          description: pkg.description,
          points: pkg.points,
          price: pkg.price,
          pricePerPoint: pkg.pricePerPoint,
          discountPercent: pkg.discountPercent,
          isActive: pkg.isActive,
          sortOrder: pkg.sortOrder,
          updatedAt: new Date(),
        },
      });

    console.log(`  ✅ ${pkg.name} (${pkg.id}) 패키지 생성/업데이트 완료`);
  }

  console.log('✨ 포인트 패키지 시드 완료!');
}

// 직접 실행 시
const isMainModule = require.main === module;
if (isMainModule) {
  seedPointPackages()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('시드 실패:', err);
      process.exit(1);
    });
}
