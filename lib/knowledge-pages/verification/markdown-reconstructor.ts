// lib/knowledge-pages/verification/markdown-reconstructor.ts

/**
 * 마크다운 재구성 모듈
 *
 * 원본 문서 텍스트를 깔끔한 마크다운 형식으로 재구성합니다.
 * 검증 가능한 정보(숫자, 연락처, 날짜 등)를 정확히 보존하면서
 * 구조화된 마크다운을 생성합니다.
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { db } from '@/lib/db';
import { validationSessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { DocumentStructure } from '../types';
import {
  truncateWithWarning,
  TRUNCATION_LIMITS,
  type TruncationResult,
} from '../utils/truncation';

// GOOGLE_GENERATIVE_AI_API_KEY 환경변수 체크
function checkGoogleApiKey(): void {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 설정되지 않았습니다. ' +
        '.env.local 파일에 유효한 Google API 키를 추가해주세요.'
    );
  }
}

/**
 * 마크다운 재구성 시스템 프롬프트
 */
export const MARKDOWN_RECONSTRUCTION_SYSTEM_PROMPT = `당신은 문서 정리 전문가입니다.
주어진 원본 텍스트를 깔끔한 마크다운 형식으로 재구성하세요.

## 핵심 원칙
1. **정보 보존**: 모든 정보를 정확히 유지하세요. 특히:
   - 숫자 (금액, 수량, 퍼센트)
   - 연락처 (전화번호, 이메일, 주소)
   - 날짜 (년/월/일)
   - 고유명사 (회사명, 제품명, 인명)

2. **구조화**: 논리적 흐름에 맞게 구조화하세요:
   - ## 헤더로 섹션 구분
   - 목록이 있으면 - 또는 1. 사용
   - 표 데이터는 마크다운 테이블 사용

3. **정제**: 불필요한 요소 제거:
   - 페이지 번호, 헤더/푸터 반복
   - 의미 없는 공백, 깨진 텍스트
   - 광고, 워터마크

4. **가독성**: 읽기 쉽게 정리:
   - 논리적 문단 구분
   - 중요 내용 **굵게** 표시
   - 인용이나 참고는 > 사용

## 중요 주의사항
- 절대로 내용을 생략하지 마세요. "(이하 생략)", "..." 등으로 내용을 줄이지 마세요.
- 문서 전체를 완벽하게 변환해야 합니다.
- 원본에 있는 모든 정보가 결과물에도 있어야 합니다.

## 출력 형식
마크다운 텍스트만 반환하세요.
설명이나 코드 블록 표시 없이 마크다운 내용만 출력합니다.`;

/**
 * 구조 분석 시스템 프롬프트
 */
export const STRUCTURE_EXTRACTION_SYSTEM_PROMPT = `당신은 문서 분석 전문가입니다.
주어진 마크다운 문서의 구조를 JSON으로 분석하세요.

## 분석 대상
1. 전체 제목
2. 섹션 목록 (계층 구조 포함)
3. 각 섹션의 시작/끝 라인 번호

## 출력 형식 (JSON)
\`\`\`json
{
  "title": "문서 제목",
  "sections": [
    {
      "id": "section-1",
      "title": "섹션 제목",
      "level": 2,
      "startLine": 1,
      "endLine": 10,
      "children": []
    }
  ]
}
\`\`\`

JSON만 반환하세요.`;

interface ReconstructionResult {
  markdown: string;
  structure: DocumentStructure | null;
  /** truncation 발생 정보 (경고 표시용) */
  truncation?: TruncationResult;
}

/**
 * 원본 텍스트를 마크다운으로 재구성
 *
 * @param originalText - 파싱된 원본 문서 텍스트
 * @returns 재구성된 마크다운과 구조 JSON
 */
export async function reconstructMarkdown(
  originalText: string
): Promise<ReconstructionResult> {
  // API 키 확인
  checkGoogleApiKey();

  // Gemini 2.0 Flash는 1M 토큰 컨텍스트 지원
  // 입력 제한을 200,000자로 설정 (약 80k 토큰)
  const truncation = truncateWithWarning(originalText, {
    maxChars: TRUNCATION_LIMITS.MARKDOWN_RECONSTRUCTION,
    context: 'markdown-reconstructor',
    truncationMessage: '\n\n[문서가 너무 길어 일부만 처리됩니다...]',
  });

  // Step 1: 마크다운 재구성 (Gemini 2.0 Flash - 최대 65k 출력 토큰)
  const { text: markdown } = await generateText({
    model: google('gemini-2.0-flash'),
    system: MARKDOWN_RECONSTRUCTION_SYSTEM_PROMPT,
    prompt: `다음 원본 텍스트를 깔끔한 마크다운으로 재구성하세요. 절대로 내용을 생략하지 마세요:\n\n${truncation.text}`,
    maxOutputTokens: 65536,
    temperature: 0,
  });

  // 마크다운 코드 블록 표시 제거
  const cleanMarkdown = markdown.replace(/```(?:markdown)?\n?|\n?```/g, '').trim();

  // Step 2: 구조 분석 (Gemini 2.0 Flash)
  let structure: DocumentStructure | null = null;
  try {
    const { text: structureJson } = await generateText({
      model: google('gemini-2.0-flash'),
      system: STRUCTURE_EXTRACTION_SYSTEM_PROMPT,
      prompt: `다음 마크다운 문서의 구조를 분석하세요:\n\n${cleanMarkdown}`,
      maxOutputTokens: 8192,
      temperature: 0,
    });

    // JSON 파싱
    const cleanJson = structureJson.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // DocumentStructure 형식으로 변환
    structure = {
      title: parsed.title || '문서',
      pages: parsed.sections?.map(convertSectionToPage) || [],
    };
  } catch (error) {
    console.warn('[reconstructMarkdown] Structure analysis failed:', error);
    // 구조 분석 실패해도 마크다운은 반환
  }

  return {
    markdown: cleanMarkdown,
    structure,
    truncation: truncation.wasTruncated ? truncation : undefined,
  };
}

/**
 * 섹션을 PageNode로 변환 (헬퍼)
 * startLine/endLine/level 정보를 보존하여 createPagesFromStructure에서 사용
 */
function convertSectionToPage(section: {
  id: string;
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  children?: unknown[];
}): {
  id: string;
  title: string;
  sourcePages: number[];
  contentSummary: string;
  children: ReturnType<typeof convertSectionToPage>[];
  startLine: number;
  endLine: number;
  level: number;
} {
  return {
    id: section.id,
    title: section.title,
    sourcePages: [section.startLine],
    contentSummary: `${section.title} 섹션`,
    children: (section.children as typeof section[] | undefined)?.map(convertSectionToPage) || [],
    // Human-in-the-loop 검증에서 콘텐츠 추출에 필요한 라인 정보 보존
    startLine: section.startLine,
    endLine: section.endLine,
    level: section.level,
  };
}

/**
 * 세션에 재구성된 마크다운 저장
 *
 * @param sessionId - 검증 세션 ID
 * @param originalText - 원본 텍스트
 * @returns 재구성 결과
 */
export async function reconstructAndSave(
  sessionId: string,
  originalText: string
): Promise<ReconstructionResult> {
  const result = await reconstructMarkdown(originalText);

  // DB 업데이트
  await db
    .update(validationSessions)
    .set({
      reconstructedMarkdown: result.markdown,
      structureJson: result.structure,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  return result;
}
