/**
 * 시스템 상태 API
 * 기능 활성화 상태 조회
 */

import { NextResponse } from 'next/server';
import { isContextGenerationEnabled } from '@/lib/rag/context';

export async function GET() {
  return NextResponse.json({
    contextualChunking: isContextGenerationEnabled(),
  });
}
