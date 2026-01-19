/**
 * Document → Knowledge Pages 변환 파이프라인
 *
 * 업로드된 문서를 LLM을 사용하여 계층적인 Knowledge Pages로 자동 변환합니다.
 *
 * 처리 흐름:
 * 1. 문서 텍스트 입력
 * 2. LLM으로 구조 분석 → 페이지 트리 JSON 생성
 * 3. 각 페이지별 LLM 콘텐츠 생성
 * 4. Knowledge Pages DB 저장 (Draft 상태)
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createKnowledgePage } from '@/app/(console)/console/chatbot/blog/actions';
import { logger } from '@/lib/logger';
import {
  STRUCTURE_ANALYSIS_SYSTEM_PROMPT,
  createStructureAnalysisPrompt,
} from './prompts/structure-analysis';
import {
  CONTENT_GENERATION_SYSTEM_PROMPT,
  createContentGenerationPrompt,
} from './prompts/content-generation';
import {
  truncateWithWarning,
  TRUNCATION_LIMITS,
} from './utils/truncation';
import type {
  DocumentStructure,
  PageNode,
  GeneratedPage,
  ConversionOptions,
  ConversionProgress,
  ConversionResult,
} from './types';

/**
 * 문서 → Knowledge Pages 변환 메인 함수
 *
 * @param documentText - 파싱된 문서 텍스트
 * @param options - 변환 옵션
 * @param onProgress - 진행 상태 콜백 (선택)
 * @returns 변환 결과
 *
 * @example
 * ```typescript
 * const result = await convertDocumentToPages(
 *   documentText,
 *   { chatbotId: 'xxx', documentId: 'yyy' },
 *   (progress) => console.log(progress.currentStep)
 * );
 * ```
 */
export async function convertDocumentToPages(
  documentText: string,
  options: ConversionOptions,
  onProgress?: (progress: ConversionProgress) => void
): Promise<ConversionResult> {
  const { chatbotId, documentId, parentPageId } = options;

  try {
    // Step 1: 구조 분석
    onProgress?.({
      status: 'analyzing',
      currentStep: '문서 구조 분석 중...',
      totalPages: 0,
      completedPages: 0,
    });

    logger.info('[DocumentToPages] Starting structure analysis', {
      chatbotId,
      documentId,
      textLength: documentText.length,
    });

    const structure = await analyzeDocumentStructure(documentText);
    const totalPages = countPages(structure.pages);

    logger.info('[DocumentToPages] Structure analysis completed', {
      title: structure.title,
      totalPages,
    });

    // Step 2: 페이지별 콘텐츠 생성
    onProgress?.({
      status: 'generating',
      currentStep: '페이지 콘텐츠 생성 중...',
      totalPages,
      completedPages: 0,
    });

    let completedPages = 0;
    const generatedPages = await generatePagesContent(
      structure.pages,
      documentText,
      '',
      () => {
        completedPages++;
        onProgress?.({
          status: 'generating',
          currentStep: `페이지 생성 중 (${completedPages}/${totalPages})`,
          totalPages,
          completedPages,
        });
      }
    );

    // Step 3: Knowledge Pages DB 저장
    onProgress?.({
      status: 'saving',
      currentStep: 'Knowledge Pages 저장 중...',
      totalPages,
      completedPages: totalPages,
    });

    logger.info('[DocumentToPages] Saving pages to database', {
      chatbotId,
      totalPages,
    });

    await savePagesToDatabase(generatedPages, chatbotId, documentId, parentPageId || null);

    onProgress?.({
      status: 'completed',
      currentStep: '변환 완료',
      totalPages,
      completedPages: totalPages,
    });

    logger.info('[DocumentToPages] Conversion completed successfully', {
      chatbotId,
      documentId,
      totalPages,
    });

    return {
      success: true,
      pages: generatedPages,
      totalPageCount: totalPages,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    logger.error('[DocumentToPages] Conversion failed', error as Error, {
      chatbotId,
      documentId,
      errorMessage,
    });

    onProgress?.({
      status: 'failed',
      currentStep: '변환 실패',
      totalPages: 0,
      completedPages: 0,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Step 1: LLM으로 문서 구조 분석
 */
async function analyzeDocumentStructure(documentText: string): Promise<DocumentStructure> {
  // Gemini 2.5 Flash: 65,536 출력 토큰 지원 (현재 권장 모델)
  const truncation = truncateWithWarning(documentText, {
    maxChars: TRUNCATION_LIMITS.STRUCTURE_ANALYSIS,
    context: 'document-to-pages/structure-analysis',
    truncationMessage: '\n\n[문서가 너무 길어 일부만 분석합니다...]',
  });

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: STRUCTURE_ANALYSIS_SYSTEM_PROMPT,
    prompt: createStructureAnalysisPrompt(truncation.text),
    maxOutputTokens: 8192,
    temperature: 0,
  });

  // JSON 파싱 (코드 블록 제거)
  const cleanJson = text.replace(/```(?:json)?\n?|\n?```/g, '').trim();

  try {
    const structure = JSON.parse(cleanJson) as DocumentStructure;

    // 유효성 검증
    if (!structure.pages || !Array.isArray(structure.pages)) {
      throw new Error('Invalid structure: pages array is missing');
    }

    return structure;
  } catch (parseError) {
    logger.error('[DocumentToPages] Failed to parse structure JSON', parseError as Error, {
      rawText: text.slice(0, 500),
    });

    // 폴백: 단일 페이지로 변환
    return {
      title: '문서',
      pages: [
        {
          id: 'content',
          title: '전체 내용',
          sourcePages: [0],
          contentSummary: '문서 전체 내용',
          children: [],
        },
      ],
    };
  }
}

/**
 * Step 2: 페이지별 콘텐츠 생성 (재귀)
 */
async function generatePagesContent(
  nodes: PageNode[],
  fullDocumentText: string,
  breadcrumb: string,
  onPageComplete: () => void
): Promise<GeneratedPage[]> {
  const results: GeneratedPage[] = [];

  for (const node of nodes) {
    const currentBreadcrumb = breadcrumb ? `${breadcrumb} > ${node.title}` : node.title;

    // 해당 페이지의 소스 텍스트 추출
    // MVP에서는 전체 텍스트 사용, 추후 페이지 매핑 구현 필요
    const sourceText = extractSourceText(fullDocumentText, node.sourcePages);

    // LLM으로 콘텐츠 생성 (Gemini 2.0 Flash)
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: CONTENT_GENERATION_SYSTEM_PROMPT,
      prompt: createContentGenerationPrompt(
        node.title,
        currentBreadcrumb,
        node.contentSummary,
        sourceText,
        node.sourcePages
      ),
      maxOutputTokens: 16384,
      temperature: 0,
    });

    // 마크다운 코드 블록 제거
    const content = text.replace(/```(?:markdown)?\n?|\n?```/g, '').trim();

    // 하위 페이지 재귀 처리
    const children =
      node.children.length > 0 ? await generatePagesContent(node.children, fullDocumentText, currentBreadcrumb, onPageComplete) : [];

    results.push({
      id: node.id,
      title: node.title,
      content,
      sourcePages: node.sourcePages,
      confidence: calculateConfidence(content, sourceText),
      children,
    });

    onPageComplete();
  }

  return results;
}

/**
 * Step 3: Knowledge Pages DB 저장 (재귀)
 */
async function savePagesToDatabase(
  pages: GeneratedPage[],
  chatbotId: string,
  documentId: string | undefined,
  parentId: string | null
): Promise<void> {
  for (const page of pages) {
    const result = await createKnowledgePage({
      chatbotId,
      parentId,
      title: page.title,
      content: page.content,
      sourceDocumentId: documentId,
    });

    if (result.success && result.page && page.children.length > 0) {
      // 하위 페이지 재귀 저장
      await savePagesToDatabase(page.children, chatbotId, documentId, result.page.id);
    } else if (!result.success) {
      logger.error(
        '[DocumentToPages] Failed to create page',
        new Error(result.error || 'Unknown error'),
        { title: page.title }
      );
    }
  }
}

/**
 * 헬퍼: 전체 페이지 수 계산
 */
function countPages(nodes: PageNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countPages(node.children), 0);
}

/**
 * 헬퍼: 소스 텍스트 추출
 *
 * MVP에서는 전체 텍스트 반환
 * TODO: PDF 페이지 매핑 구현 시 개선 필요
 */
function extractSourceText(fullText: string, _sourcePages: number[]): string {
  // Gemini 2.0 Flash는 큰 컨텍스트 지원
  const truncation = truncateWithWarning(fullText, {
    maxChars: TRUNCATION_LIMITS.SOURCE_TEXT_EXTRACTION,
    context: 'document-to-pages/extract-source-text',
    truncationMessage: '\n\n[텍스트가 너무 길어 일부만 사용합니다...]',
  });
  return truncation.text;
}

/**
 * 헬퍼: 콘텐츠 신뢰도 계산
 *
 * 생성된 콘텐츠와 원본 텍스트의 유사도를 기반으로 신뢰도 산출
 * MVP에서는 간단한 휴리스틱 사용
 */
function calculateConfidence(generatedContent: string, sourceText: string): number {
  // 기본 신뢰도
  let confidence = 0.8;

  // 콘텐츠 길이가 너무 짧으면 신뢰도 감소
  if (generatedContent.length < 100) {
    confidence -= 0.1;
  }

  // 콘텐츠 길이가 원본 대비 너무 짧으면 신뢰도 감소
  if (sourceText.length > 0 && generatedContent.length / sourceText.length < 0.1) {
    confidence -= 0.1;
  }

  // 숫자나 URL이 원본에 있는데 생성물에 없으면 신뢰도 감소
  const sourceNumbers = sourceText.match(/\d+/g) || [];
  const contentNumbers = generatedContent.match(/\d+/g) || [];
  if (sourceNumbers.length > 0 && contentNumbers.length === 0) {
    confidence -= 0.1;
  }

  return Math.max(0.5, Math.min(1, confidence));
}

/**
 * 페이지 총 수 계산 (외부 export용)
 */
export function countAllPages(pages: GeneratedPage[]): number {
  return pages.reduce((sum, page) => sum + 1 + countAllPages(page.children || []), 0);
}

// =============================================================================
// Human-in-the-loop 검증 후 페이지 생성
// =============================================================================

/**
 * 검증된 구조에서 Knowledge Pages 생성
 *
 * Human-in-the-loop 검증 세션이 승인된 후, 검증된 마크다운과 구조 정보를
 * 사용하여 Knowledge Pages를 생성합니다. LLM 호출 없이 직접 페이지를 생성합니다.
 *
 * @param structure - 검증 세션의 structureJson (PageNode[] with startLine/endLine)
 * @param markdown - 검증된 reconstructedMarkdown
 * @param chatbotId - 챗봇 ID
 * @param documentId - 원본 문서 ID
 * @param parentPageId - 상위 페이지 ID (선택)
 * @returns 생성된 페이지 수
 */
export async function createPagesFromStructure(
  structure: DocumentStructure,
  markdown: string,
  chatbotId: string,
  documentId: string,
  parentPageId?: string
): Promise<{ success: boolean; pageCount: number; error?: string }> {
  try {
    logger.info('[createPagesFromStructure] Starting page creation from verified structure', {
      chatbotId,
      documentId,
      pageCount: structure.pages.length,
    });

    // 마크다운을 라인 배열로 분할
    const lines = markdown.split('\n');

    // PageNode[] → GeneratedPage[] 변환 (라인 정보로 콘텐츠 추출)
    const generatedPages = convertPageNodesToGeneratedPages(structure.pages, lines);

    if (generatedPages.length === 0) {
      logger.warn('[createPagesFromStructure] No pages generated from structure');
      return { success: true, pageCount: 0 };
    }

    // DB에 저장 (undefined를 null로 변환)
    await savePagesToDatabase(generatedPages, chatbotId, documentId, parentPageId ?? null);

    const totalPages = countAllPages(generatedPages);
    logger.info('[createPagesFromStructure] Pages created successfully', {
      chatbotId,
      documentId,
      totalPages,
    });

    return { success: true, pageCount: totalPages };
  } catch (error) {
    logger.error('[createPagesFromStructure] Failed to create pages', error as Error, {
      chatbotId,
      documentId,
    });
    return {
      success: false,
      pageCount: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * PageNode[]를 GeneratedPage[]로 변환
 *
 * 라인 정보(startLine/endLine)를 사용하여 마크다운에서 콘텐츠 추출
 */
function convertPageNodesToGeneratedPages(
  nodes: PageNode[],
  lines: string[]
): GeneratedPage[] {
  return nodes.map((node) => {
    // 라인 정보가 있으면 해당 범위의 콘텐츠 추출
    let content: string;

    if (node.startLine !== undefined && node.endLine !== undefined) {
      // 0-based index 변환 (LLM이 1-based로 반환하므로)
      const startIdx = Math.max(0, node.startLine - 1);
      const endIdx = Math.min(lines.length, node.endLine);

      // 해당 범위의 라인 추출
      const sectionLines = lines.slice(startIdx, endIdx);

      // 섹션 제목 라인은 제외하고 콘텐츠만 사용
      // (제목은 page.title로 이미 저장됨)
      const contentLines = sectionLines.filter((line) => {
        const trimmed = line.trim();
        // 헤더 라인이면서 현재 섹션의 제목과 일치하면 제외
        if (trimmed.startsWith('#') && trimmed.includes(node.title)) {
          return false;
        }
        return true;
      });

      content = contentLines.join('\n').trim();
    } else {
      // 라인 정보가 없으면 요약을 콘텐츠로 사용
      content = node.contentSummary;
    }

    // 콘텐츠가 비어있으면 요약으로 대체
    if (!content || content.length < 10) {
      content = node.contentSummary || `${node.title} 섹션`;
    }

    return {
      id: node.id,
      title: node.title,
      content,
      sourcePages: node.sourcePages,
      // 검증된 콘텐츠이므로 높은 신뢰도
      confidence: 0.95,
      children: convertPageNodesToGeneratedPages(node.children, lines),
    };
  });
}
