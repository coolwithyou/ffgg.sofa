/**
 * 포인트 패키지 목록 API
 *
 * GET /api/points/packages - 구매 가능한 포인트 패키지 목록
 *
 * @returns 포인트 패키지 목록
 */

import { NextResponse } from 'next/server';
import { POINT_PACKAGES } from '@/lib/points';

export interface PointPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  pricePerPoint: number;
  discount: number;
}

export interface PointPackagesResponse {
  packages: PointPackage[];
}

export async function GET() {
  // 상수에서 패키지 목록 반환 (인증 불필요 - 공개 정보)
  const response: PointPackagesResponse = {
    packages: POINT_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      points: pkg.points,
      price: pkg.price,
      pricePerPoint: pkg.pricePerPoint,
      discount: pkg.discount,
    })),
  };

  return NextResponse.json(response);
}
