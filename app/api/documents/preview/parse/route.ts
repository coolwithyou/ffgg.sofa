/**
 * 문서 파싱 미리보기 API (1단계)
 *
 * 문서를 파싱하여 텍스트를 추출하고, 구조를 분석합니다.
 * AI 청킹 비용 추정 정보도 함께 제공합니다.
 *
 * 2단계 플로우:
 * 1단계: 파싱 + 텍스트 미리보기 (이 API) - AI 없음, 빠름
 * 2단계: AI 시맨틱 청킹 (/api/documents/preview/chunk) - 포인트 소모
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { parseDocument, type SupportedFileType } from '@/lib/parsers';
import { analyzeStructure, classifyDocumentType } from '@/lib/rag/chunking';
import { validateFile, type AllowedMimeType } from '@/lib/upload';
import { estimateChunkingCost } from '@/lib/rag/chunk-cost-estimator';
import { logger } from '@/lib/logger';

// 지원 파일 타입 매핑
const MIME_TYPE_MAP: Record<string, SupportedFileType> = {
  'application/pdf': 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain': 'text/plain',
  'text/markdown': 'text/markdown',
  'text/csv': 'text/csv',
  'application/json': 'application/json',
};

// 미리보기에 허용된 타입
const PREVIEW_ALLOWED_TYPES: AllowedMimeType[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
];

export interface ParsePreviewResponse {
  success: true;
  parse: {
    /** 추출된 전체 텍스트 */
    text: string;
    /** 텍스트 길이 (문자 수) */
    textLength: number;
    /** 문서 구조 분석 결과 */
    structure: {
      hasQAPairs: boolean;
      hasHeaders: boolean;
      hasTables: boolean;
      hasLists: boolean;
    };
    /** 문서 유형 */
    documentType: 'faq' | 'technical' | 'legal' | 'general';
    /** 파일 메타데이터 */
    metadata: {
      filename: string;
      fileType: string;
      fileSize: number;
      parseTime: number;
    };
    /** AI 청킹 비용 추정 */
    estimation: {
      estimatedChunks: number;
      estimatedPoints: number;
      estimatedTime: number;
      segmentCount: number;
    };
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Rate Limiting
  const rateLimitResponse = await withRateLimit(request, 'upload', 'basic');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // 2. 인증 및 테넌트 격리
  const isolation = await withTenantIsolation(request);
  if (!isolation.success) {
    return isolation.response;
  }

  const { tenant } = isolation;

  try {
    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    // 파일 검증
    const validation = await validateFile(file, {
      allowedTypes: PREVIEW_ALLOWED_TYPES,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') || '유효하지 않은 파일입니다.' },
        { status: 400 }
      );
    }

    // MIME 타입 확인
    const fileType = MIME_TYPE_MAP[validation.detectedMimeType || file.type];
    if (!fileType) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다.' },
        { status: 400 }
      );
    }

    // 문서 파싱
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parseDocument(buffer, fileType);
    const text = parseResult.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: '파일에서 텍스트를 추출할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 구조 분석
    const structure = analyzeStructure(text);

    // 문서 유형 분류
    const documentType = classifyDocumentType(text);

    // AI 청킹 비용 추정
    const textLength = text.length;
    const estimation = estimateChunkingCost(textLength);

    const parseTime = Date.now() - startTime;

    logger.info('Document parse preview completed', {
      tenantId: tenant.tenantId,
      filename: file.name,
      fileSize: file.size,
      textLength,
      documentType,
      estimation,
      parseTime,
    });

    const response: ParsePreviewResponse = {
      success: true,
      parse: {
        text,
        textLength,
        structure: {
          hasQAPairs: structure.hasQAPairs,
          hasHeaders: structure.hasHeaders,
          hasTables: structure.hasTables,
          hasLists: structure.hasLists,
        },
        documentType,
        metadata: {
          filename: file.name,
          fileType: fileType,
          fileSize: file.size,
          parseTime,
        },
        estimation,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      'Document parse preview failed',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId: tenant.tenantId }
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '문서 파싱 실패' },
      { status: 500 }
    );
  }
}
