/**
 * 문서 업로드 API
 * POST /api/documents/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { validateFile, uploadFile, type AllowedMimeType } from '@/lib/upload';
import { db, documents } from '@/lib/db';
import { createAuditLogFromRequest, AuditAction, TargetType } from '@/lib/audit';
import { AppError, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { inngest } from '@/inngest/client';

// 문서 업로드에 허용된 타입
const DOCUMENT_ALLOWED_TYPES: AllowedMimeType[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
];

export async function POST(request: NextRequest) {
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

  const { session, tenant } = isolation;

  try {
    // 3. FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '파일이 필요합니다.').toSafeResponse(),
        { status: 400 }
      );
    }

    // 4. 파일 검증 (확장자 + Magic Number)
    const validationResult = await validateFile(file, {
      allowedTypes: DOCUMENT_ALLOWED_TYPES,
    });

    if (!validationResult.valid) {
      logger.warn('File validation failed', {
        filename: file.name,
        errors: validationResult.errors,
        userId: session.userId,
        tenantId: tenant.tenantId,
      });

      return NextResponse.json(
        new AppError(ErrorCode.INVALID_FILE_TYPE, validationResult.errors.join(', ')).toSafeResponse(),
        { status: 400 }
      );
    }

    // 5. 파일 업로드
    const fileBuffer = await file.arrayBuffer();
    const uploadResult = await uploadFile(Buffer.from(fileBuffer), {
      tenantId: tenant.tenantId,
      filename: validationResult.sanitizedFilename!,
      contentType: validationResult.detectedMimeType,
      folder: 'documents',
      metadata: {
        originalFilename: file.name,
        uploadedBy: session.userId,
      },
    });

    if (!uploadResult.success) {
      logger.error('File upload to storage failed', new Error(uploadResult.error || 'Unknown error'), {
        filename: file.name,
        tenantId: tenant.tenantId,
      });

      return NextResponse.json(
        new AppError(ErrorCode.FILE_UPLOAD_FAILED).toSafeResponse(),
        { status: 500 }
      );
    }

    // 6. DB에 문서 레코드 생성
    const [document] = await db
      .insert(documents)
      .values({
        tenantId: tenant.tenantId,
        filename: validationResult.sanitizedFilename!,
        filePath: uploadResult.key!,
        fileSize: file.size,
        fileType: validationResult.detectedMimeType,
        status: 'uploaded',
        metadata: {
          originalFilename: file.name,
          uploadedBy: session.userId,
          url: uploadResult.url,
        },
      })
      .returning();

    // 7. 감사 로그 기록
    await createAuditLogFromRequest(request, {
      userId: session.userId,
      tenantId: tenant.tenantId,
      action: AuditAction.DOCUMENT_CREATE,
      targetType: TargetType.DOCUMENT,
      targetId: document.id,
      result: 'success',
      details: {
        filename: validationResult.sanitizedFilename,
        fileSize: file.size,
        fileType: validationResult.detectedMimeType,
      },
    });

    // 8. Inngest 이벤트 발송 (문서 처리 시작)
    await inngest.send({
      name: 'document/uploaded',
      data: {
        documentId: document.id,
        tenantId: tenant.tenantId,
        userId: session.userId,
        filename: validationResult.sanitizedFilename!,
        fileType: validationResult.detectedMimeType!,
        filePath: uploadResult.key!,
      },
    });

    logger.info('Document uploaded successfully', {
      documentId: document.id,
      filename: validationResult.sanitizedFilename,
      tenantId: tenant.tenantId,
      userId: session.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        filename: document.filename,
        fileSize: document.fileSize,
        fileType: document.fileType,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    logger.error('Document upload failed', error as Error, {
      tenantId: tenant.tenantId,
      userId: session.userId,
    });

    return NextResponse.json(
      new AppError(ErrorCode.FILE_UPLOAD_FAILED).toSafeResponse(),
      { status: 500 }
    );
  }
}
