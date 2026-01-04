/**
 * 파일 프록시 API
 *
 * GET /api/files/:path*
 * - R2/S3 또는 로컬 저장소에서 파일을 스트리밍
 * - 공개 페이지 이미지는 인증 없이 접근 가능
 * - 기타 파일은 테넌트 소유권 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileFromStorage, getStorageType } from '@/lib/upload/storage';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// MIME 타입 매핑
const MIME_TYPES: Record<string, string> = {
  // 이미지
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  // 문서
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 텍스트
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  // 기타
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

/**
 * 파일 확장자로 MIME 타입 결정
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * GET /api/files/:path*
 * 파일 스트리밍
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // 경로 재구성
    const key = pathSegments.join('/');

    // 보안: 경로 탐색 공격 방지
    if (key.includes('..') || key.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // 키에서 tenantId 추출 (첫 번째 세그먼트)
    const tenantId = pathSegments[0];

    if (!tenantId) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // public-page 폴더의 파일은 공개 접근 허용
    // 형식: {tenantId}/public-page/{year}/{month}/{uuid}_{filename}
    const isPublicPageFile = pathSegments.length >= 2 && pathSegments[1] === 'public-page';

    // 공개 페이지 파일이 아닌 경우 추가 인증 필요 (현재는 public-page만 지원)
    if (!isPublicPageFile) {
      // TODO: 다른 타입의 파일은 세션 검증 필요
      // 현재는 public-page 파일만 허용
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 파일 다운로드
    const fileBuffer = await getFileFromStorage(key, tenantId);

    // MIME 타입 결정
    const filename = pathSegments[pathSegments.length - 1];
    const contentType = getMimeType(filename);

    // 캐시 헤더 설정 (이미지는 1년 캐시)
    const isImage = contentType.startsWith('image/');
    const cacheControl = isImage
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400';

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': cacheControl,
        // 보안 헤더
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    // 파일을 찾을 수 없음
    if (
      error instanceof Error &&
      (error.message.includes('ENOENT') ||
        error.message.includes('NoSuchKey') ||
        error.message.includes('not found'))
    ) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 권한 없음
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    logger.error('File proxy error', error as Error);

    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}
