# RAG 평가 데이터셋 작성 가이드

이 문서는 RAG 평가 시스템에서 사용할 평가 데이터셋을 작성하는 방법을 안내합니다.

## 데이터셋 파일 구조

```json
{
  "version": "1.0.0",
  "name": "데이터셋 이름",
  "description": "데이터셋 설명 (선택)",
  "tenantId": "your-tenant-id",
  "datasetIds": ["dataset-id-1", "dataset-id-2"],
  "items": [
    // 평가 항목들
  ],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### 필수 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `version` | string | 데이터셋 버전 (예: "1.0.0") |
| `name` | string | 데이터셋 이름 |
| `tenantId` | string | 평가 대상 테넌트 ID |
| `items` | array | 평가 항목 배열 |
| `createdAt` | string | 생성 일시 (ISO 8601) |
| `updatedAt` | string | 수정 일시 (ISO 8601) |

### 선택 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `description` | string | 데이터셋 설명 |
| `datasetIds` | array | 검색 대상 문서셋 ID (비어있으면 전체 검색) |

---

## 평가 항목 (EvaluationItem)

### 기본 형식

```json
{
  "id": "unique-item-id",
  "question": "사용자 질문",
  "questionType": "factual",
  "groundTruth": "기대하는 정답"
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | O | 고유 식별자 |
| `question` | string | O | 사용자 질문 |
| `questionType` | string | O | 질문 유형 |
| `groundTruth` | string | O | 기대하는 정답 |
| `groundTruthChunks` | string[] | X | 정답 근거 청크 ID (Context Recall용) |
| `conversationHistory` | array | X | 대화 히스토리 (followup 질문용) |
| `metadata` | object | X | 추가 메타데이터 |

---

## 질문 유형별 작성 가이드

### 1. factual (사실 확인)

단순한 사실 확인 질문입니다.

```json
{
  "id": "factual-001",
  "question": "환불 정책은 무엇인가요?",
  "questionType": "factual",
  "groundTruth": "구매 후 7일 이내 미개봉 상품에 한해 전액 환불 가능합니다."
}
```

**작성 팁**:
- 명확한 답이 있는 질문 선택
- Ground Truth는 문서 내용과 일치하게 작성
- 다양한 표현 방식의 질문 포함 (예: "환불 기한은?", "몇 일 내에 환불 가능한가요?")

### 2. followup (후속 질문)

이전 대화를 참조하는 질문으로, Query Rewriting 효과를 측정합니다.

```json
{
  "id": "followup-001",
  "question": "그러면 개봉한 경우는요?",
  "questionType": "followup",
  "groundTruth": "개봉한 상품은 제품 결함이 있는 경우에만 교환 또는 환불이 가능합니다.",
  "conversationHistory": [
    {
      "role": "user",
      "content": "환불 정책은 무엇인가요?"
    },
    {
      "role": "assistant",
      "content": "구매 후 7일 이내에 미개봉 상품에 한해 전액 환불이 가능합니다."
    }
  ]
}
```

**작성 팁**:
- "그러면", "그럼", "그 경우", "거기서" 등 지시어 활용
- conversationHistory는 실제 대화처럼 자연스럽게 구성
- 이전 답변을 알아야만 이해되는 질문 작성

### 3. comparison (비교)

두 가지 이상을 비교하는 질문입니다.

```json
{
  "id": "comparison-001",
  "question": "일반 회원과 프리미엄 회원의 차이점은 무엇인가요?",
  "questionType": "comparison",
  "groundTruth": "프리미엄 회원은 무료 배송, 5% 추가 할인, 우선 고객 상담 혜택을 받을 수 있습니다."
}
```

**작성 팁**:
- "차이점", "비교", "vs", "어떻게 다른가요" 표현 사용
- Ground Truth에 비교 대상 모두의 특징 포함

### 4. procedural (절차/방법)

특정 작업의 수행 방법을 묻는 질문입니다.

```json
{
  "id": "procedural-001",
  "question": "회원 가입은 어떻게 하나요?",
  "questionType": "procedural",
  "groundTruth": "1. 홈페이지 우측 상단 '회원가입' 클릭\n2. 이메일/비밀번호 입력\n3. 이메일 인증 완료"
}
```

**작성 팁**:
- "어떻게", "방법", "절차", "단계" 키워드 사용
- Ground Truth는 순서대로 단계별 기술

### 5. reasoning (추론)

단순 검색이 아닌 추론이 필요한 질문입니다.

```json
{
  "id": "reasoning-001",
  "question": "왜 환불이 거부되었을까요?",
  "questionType": "reasoning",
  "groundTruth": "환불이 거부되는 경우는 1) 구매 후 7일 초과, 2) 상품 개봉, 3) 사용 흔적이 있는 경우입니다.",
  "metadata": {
    "note": "사용자가 구체적 상황을 제공하지 않은 경우의 응답"
  }
}
```

**작성 팁**:
- "왜", "이유", "원인" 키워드 사용
- 여러 문서 정보를 종합해야 답할 수 있는 질문 작성

### 6. unanswerable (답변 불가)

문서에 없는 정보를 묻는 질문으로, 할루시네이션 방지 능력을 테스트합니다.

```json
{
  "id": "unanswerable-001",
  "question": "내일 날씨가 어떨까요?",
  "questionType": "unanswerable",
  "groundTruth": "제공된 문서에서 관련 정보를 찾을 수 없습니다.",
  "metadata": {
    "expectedBehavior": "hallucination-test",
    "description": "문서에 없는 정보 요청 시 적절히 거절하는지 테스트"
  }
}
```

**작성 팁**:
- 문서에 절대 없을 법한 질문 작성
- Ground Truth는 "정보를 찾을 수 없다"는 형태로 작성
- 경쟁사 정보, 미래 예측, 개인 의견 등 활용

---

## 권장 데이터셋 구성

### 최소 권장 구성 (50개)

| 유형 | 개수 | 비율 |
|------|------|------|
| factual | 20 | 40% |
| followup | 10 | 20% |
| procedural | 8 | 16% |
| comparison | 5 | 10% |
| reasoning | 4 | 8% |
| unanswerable | 3 | 6% |

### 체크리스트

- [ ] 모든 항목에 고유한 ID 부여
- [ ] questionType이 올바르게 설정됨
- [ ] Ground Truth가 실제 문서 내용과 일치
- [ ] followup 질문에 conversationHistory 포함
- [ ] unanswerable 질문이 정말로 문서에 없는 내용인지 확인
- [ ] 다양한 표현 방식의 질문 포함

---

## Ground Truth 작성 가이드

### 좋은 예

```
✓ "구매 후 7일 이내 미개봉 상품에 한해 전액 환불 가능합니다."
  - 구체적이고 명확함
  - 문서 내용과 일치

✓ "제공된 문서에서 관련 정보를 찾을 수 없습니다."
  - unanswerable 질문에 적합한 형태
```

### 나쁜 예

```
✗ "환불됩니다"
  - 너무 짧고 불명확함

✗ "네, 가능해요!"
  - 구어체, 정보 부족

✗ "아마도 7일 정도?"
  - 추측성, 불확실한 표현
```

---

## 데이터셋 검증

데이터셋 로드 시 자동으로 다음 항목이 검증됩니다:

1. 필수 필드 존재 여부
2. 각 항목의 ID 고유성
3. questionType 유효성
4. conversationHistory 형식 (followup인 경우)

오류 발생 시 상세한 에러 메시지가 출력됩니다.

---

## 샘플 파일

이 디렉토리의 `sample-dataset.json`을 참고하세요. 10개의 예시 항목이 포함되어 있습니다.

```bash
# 샘플 데이터셋으로 평가 실행
pnpm rag:evaluate --dataset data/evaluation/sample-dataset.json
```

---

## 참고

- 상세한 평가 시스템 문서: [docs/RAG_EVALUATION.md](../../docs/RAG_EVALUATION.md)
- 평가 메트릭 설명: RAGAS (https://docs.ragas.io/)
