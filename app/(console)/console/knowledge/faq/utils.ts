/**
 * FAQ 빌더 유틸리티 함수
 * 클라이언트에서 사용하는 순수 함수들
 */

// 타입 정의
export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface QAPair {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  order: number;
  // 문서 업로드 관련 필드
  documentId?: string;          // 업로드된 문서 ID
  uploadedAt?: string;          // 업로드 시간 (ISO string)
  uploadedDatasetId?: string;   // 업로드된 데이터셋 ID
  uploadedDatasetName?: string; // 업로드된 데이터셋 이름
  isLocked?: boolean;           // 잠금 상태
  isModified?: boolean;         // 수정됨 상태 (잠금 해제 후 수정 시)
  originalQuestion?: string;    // 원본 질문 (수정 감지용)
  originalAnswer?: string;      // 원본 답변 (수정 감지용)
}

// 단일 Q&A를 Markdown 형식으로 변환
export function generateSingleQAMarkdown(
  qa: QAPair,
  categoryName?: string
): string {
  const lines: string[] = ['# FAQ'];
  if (categoryName) {
    lines.push('', `## ${categoryName}`);
  }
  lines.push('', `Q: ${qa.question}`, `A: ${qa.answer}`);
  return lines.join('\n');
}

// Markdown 생성
export function generateMarkdown(
  categories: Category[],
  qaPairs: QAPair[]
): string {
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
  const lines: string[] = ['# FAQ 문서', ''];

  for (const category of sortedCategories) {
    const categoryQAs = qaPairs
      .filter((qa) => qa.categoryId === category.id)
      .sort((a, b) => a.order - b.order);

    if (categoryQAs.length === 0) continue;

    lines.push(`## ${category.name}`, '');

    for (const qa of categoryQAs) {
      lines.push(`Q: ${qa.question}`);
      lines.push(`A: ${qa.answer}`, '');
    }
  }

  // 카테고리 없는 Q&A
  const uncategorizedQAs = qaPairs
    .filter((qa) => !qa.categoryId || !categories.find((c) => c.id === qa.categoryId))
    .sort((a, b) => a.order - b.order);

  if (uncategorizedQAs.length > 0) {
    lines.push('## 기타', '');
    for (const qa of uncategorizedQAs) {
      lines.push(`Q: ${qa.question}`);
      lines.push(`A: ${qa.answer}`, '');
    }
  }

  return lines.join('\n');
}

// CSV 생성
export function generateCSV(
  categories: Category[],
  qaPairs: QAPair[]
): string {
  const lines: string[] = ['카테고리,질문,답변'];

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  for (const category of sortedCategories) {
    const categoryQAs = qaPairs
      .filter((qa) => qa.categoryId === category.id)
      .sort((a, b) => a.order - b.order);

    for (const qa of categoryQAs) {
      const escapedQuestion = qa.question.replace(/"/g, '""');
      const escapedAnswer = qa.answer.replace(/"/g, '""');
      lines.push(`"${category.name}","${escapedQuestion}","${escapedAnswer}"`);
    }
  }

  // 카테고리 없는 Q&A
  const uncategorizedQAs = qaPairs
    .filter((qa) => !qa.categoryId || !categories.find((c) => c.id === qa.categoryId))
    .sort((a, b) => a.order - b.order);

  for (const qa of uncategorizedQAs) {
    const escapedQuestion = qa.question.replace(/"/g, '""');
    const escapedAnswer = qa.answer.replace(/"/g, '""');
    lines.push(`"기타","${escapedQuestion}","${escapedAnswer}"`);
  }

  return lines.join('\n');
}
