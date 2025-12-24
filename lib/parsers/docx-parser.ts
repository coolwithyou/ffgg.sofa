/**
 * DOCX 파서
 * mammoth 라이브러리를 사용하여 Word 문서에서 텍스트 추출
 */

import mammoth from 'mammoth';

export interface DocxParseResult {
  text: string;
  html: string;
  metadata: {
    messages: string[];
  };
}

/**
 * DOCX 버퍼에서 텍스트와 HTML 추출
 */
export async function parseDocx(buffer: Buffer): Promise<DocxParseResult> {
  try {
    // 텍스트 추출
    const textResult = await mammoth.extractRawText({ buffer });

    // HTML 추출 (구조 정보 유지)
    const htmlResult = await mammoth.convertToHtml({ buffer });

    return {
      text: cleanText(textResult.value),
      html: htmlResult.value,
      metadata: {
        messages: [
          ...textResult.messages.map((m) => m.message),
          ...htmlResult.messages.map((m) => m.message),
        ],
      },
    };
  } catch (error) {
    throw new Error(
      `DOCX 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}

/**
 * 텍스트 정리
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
