/**
 * 문서 미리보기 API
 * 업로드 전 청킹 결과와 품질 점수를 미리 확인
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { parseDocument, type SupportedFileType } from '@/lib/parsers';
import { smartChunk, analyzeStructure } from '@/lib/rag/chunking';
import { validateFile, type AllowedMimeType } from '@/lib/upload';
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

interface ChunkPreview {
  index: number;
  content: string;
  contentPreview: string;
  qualityScore: number;
  metadata: {
    isQAPair: boolean;
    hasHeader: boolean;
    isTable: boolean;
    isList: boolean;
  };
  autoApproved: boolean;
}

interface PreviewWarning {
  type: 'too_short' | 'too_long' | 'incomplete_qa' | 'low_quality';
  count: number;
  message: string;
}

interface PreviewResponse {
  success: true;
  preview: {
    structure: {
      hasQAPairs: boolean;
      hasHeaders: boolean;
      hasTables: boolean;
      hasLists: boolean;
    };
    chunks: ChunkPreview[];
    summary: {
      totalChunks: number;
      avgQualityScore: number;
      autoApprovedCount: number;
      pendingCount: number;
      warnings: PreviewWarning[];
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
    const content = parseResult.text;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '파일에서 텍스트를 추출할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 구조 분석
    const structure = analyzeStructure(content);

    // 스마트 청킹
    const chunks = await smartChunk(content, {
      maxChunkSize: 500,
      overlap: 50,
      preserveStructure: true,
    });

    // 미리보기 데이터 생성
    const chunkPreviews: ChunkPreview[] = chunks.map((chunk) => ({
      index: chunk.index,
      content: chunk.content,
      contentPreview:
        chunk.content.length > 200
          ? chunk.content.slice(0, 200) + '...'
          : chunk.content,
      qualityScore: chunk.qualityScore,
      metadata: {
        isQAPair: chunk.metadata.isQAPair,
        hasHeader: chunk.metadata.hasHeader,
        isTable: chunk.metadata.isTable,
        isList: chunk.metadata.isList,
      },
      autoApproved: chunk.qualityScore >= 85,
    }));

    // 경고 분석
    const warnings: PreviewWarning[] = [];

    // 너무 짧은 청크
    const shortChunks = chunks.filter((c) => c.content.length < 100);
    if (shortChunks.length > 0) {
      warnings.push({
        type: 'too_short',
        count: shortChunks.length,
        message: `${shortChunks.length}개 청크가 100자 미만으로 짧습니다.`,
      });
    }

    // 너무 긴 청크
    const longChunks = chunks.filter((c) => c.content.length > 800);
    if (longChunks.length > 0) {
      warnings.push({
        type: 'too_long',
        count: longChunks.length,
        message: `${longChunks.length}개 청크가 800자를 초과합니다.`,
      });
    }

    // 불완전한 Q&A
    const incompleteQA = chunks.filter(
      (c) =>
        (c.content.includes('Q:') || c.content.includes('질문:')) &&
        !(c.content.includes('A:') || c.content.includes('답변:'))
    );
    if (incompleteQA.length > 0) {
      warnings.push({
        type: 'incomplete_qa',
        count: incompleteQA.length,
        message: `${incompleteQA.length}개 Q&A 쌍이 불완전합니다.`,
      });
    }

    // 낮은 품질
    const lowQualityChunks = chunks.filter((c) => c.qualityScore < 50);
    if (lowQualityChunks.length > 0) {
      warnings.push({
        type: 'low_quality',
        count: lowQualityChunks.length,
        message: `${lowQualityChunks.length}개 청크의 품질 점수가 50점 미만입니다.`,
      });
    }

    // 요약 계산
    const totalChunks = chunks.length;
    const avgQualityScore =
      totalChunks > 0
        ? chunks.reduce((sum, c) => sum + c.qualityScore, 0) / totalChunks
        : 0;
    const autoApprovedCount = chunks.filter((c) => c.qualityScore >= 85).length;
    const pendingCount = totalChunks - autoApprovedCount;

    const duration = Date.now() - startTime;
    logger.info('Document preview completed', {
      tenantId: tenant.tenantId,
      filename: file.name,
      fileSize: file.size,
      totalChunks,
      avgQualityScore: avgQualityScore.toFixed(2),
      autoApprovedCount,
      duration,
    });

    return NextResponse.json({
      success: true,
      preview: {
        structure: {
          hasQAPairs: structure.hasQAPairs,
          hasHeaders: structure.hasHeaders,
          hasTables: structure.hasTables,
          hasLists: structure.hasLists,
        },
        chunks: chunkPreviews,
        summary: {
          totalChunks,
          avgQualityScore,
          autoApprovedCount,
          pendingCount,
          warnings,
        },
      },
    });
  } catch (error) {
    logger.error(
      'Document preview failed',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId: tenant.tenantId }
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '미리보기 생성 실패' },
      { status: 500 }
    );
  }
}
