/**
 * PDF 파서
 * unpdf 라이브러리를 사용하여 PDF 문서에서 텍스트 추출
 * (pdf-parse v2는 Node.js 서버 환경에서 worker 로딩 문제가 있어 대체)
 */

import { extractText, getMeta, getDocumentProxy } from 'unpdf';

export interface PdfParseResult {
  text: string;
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
    creationDate?: Date;
  };
}

/**
 * PDF 버퍼에서 텍스트와 메타데이터 추출
 */
export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  try {
    // Buffer를 Uint8Array로 변환 (ArrayBuffer detached 문제 방지)
    const uint8Array = new Uint8Array(buffer);

    // 텍스트 추출
    const { text, totalPages } = await extractText(uint8Array, { mergePages: true });

    // 메타데이터 추출
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const metadata = await getMeta(pdf);

    // 날짜 파싱
    let creationDate: Date | undefined;
    if (metadata.info?.CreationDate && typeof metadata.info.CreationDate === 'string') {
      // PDF 날짜 형식: D:YYYYMMDDHHmmSS
      const dateStr = metadata.info.CreationDate.replace(/^D:/, '');
      const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
      if (match) {
        creationDate = new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4] || '0'),
          parseInt(match[5] || '0'),
          parseInt(match[6] || '0')
        );
      }
    }

    return {
      text: cleanText(Array.isArray(text) ? text.join('\n') : text),
      metadata: {
        pageCount: totalPages,
        title: (metadata.info?.Title as string) || undefined,
        author: (metadata.info?.Author as string) || undefined,
        creationDate,
      },
    };
  } catch (error) {
    throw new Error(
      `PDF 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}

/**
 * 텍스트 정리 (불필요한 공백, 특수문자 제거)
 */
function cleanText(text: string): string {
  return (
    text
      // 연속된 공백을 단일 공백으로
      .replace(/[ \t]+/g, ' ')
      // 3개 이상의 연속 줄바꿈을 2개로
      .replace(/\n{3,}/g, '\n\n')
      // 줄 앞뒤 공백 제거
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // 앞뒤 공백 제거
      .trim()
  );
}
