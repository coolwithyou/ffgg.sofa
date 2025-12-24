/**
 * PDF 파서
 * pdf-parse v2 라이브러리를 사용하여 PDF 문서에서 텍스트 추출
 */

import { PDFParse } from 'pdf-parse';

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
    const parser = new PDFParse({ data: buffer });

    // 문서 정보 추출
    const info = await parser.getInfo();

    // 텍스트 추출
    const textResult = await parser.getText();

    // 파서 정리
    await parser.destroy();

    // 날짜 정보 추출
    const dateNode = info.getDateNode();
    const creationDate = dateNode.CreationDate || dateNode.XmpCreateDate;

    return {
      text: cleanText(textResult.text),
      metadata: {
        pageCount: info.total,
        title: (info.info?.Title as string) || undefined,
        author: (info.info?.Author as string) || undefined,
        creationDate: creationDate || undefined,
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
