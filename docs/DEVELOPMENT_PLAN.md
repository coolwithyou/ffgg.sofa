# 기업용 RAG 챗봇 SaaS - 기술 개발 계획

## 1. 프로젝트 개요

### 1.1 목표
한국 중소기업을 위한 화이트 글러브 RAG 챗봇 서비스 구축

### 1.2 핵심 기술 스택
| 영역 | 기술 | 버전/사양 |
|------|------|-----------|
| 프레임워크 | Next.js | 16.x (App Router) |
| 언어 | TypeScript | 5.x |
| 스타일링 | Tailwind CSS | 4.x |
| 데이터베이스 | Neon PostgreSQL | pgvector 확장 |
| ORM | Drizzle ORM | - |
| 인증 | Iron Session | - |
| Rate Limiting | Upstash Redis | - |
| 파일 저장소 | S3 호환 스토리지 | - |
| 작업 큐 | Inngest | - |
| 배포 | Vercel | Pro |

### 1.3 AI 모델 스택 (2025년 12월 기준)
| 용도 | 모델 | 가격 (1M 토큰) | 비고 |
|------|------|----------------|------|
| **LLM (메인)** | Gemini 2.5 Flash-Lite | $0.10 / $0.40 | 가성비 최고, 카카오 4초 OK |
| **LLM (폴백)** | GPT-4o-mini | $0.15 / $0.60 | 안정성 폴백 |
| **임베딩** | BGE-m3-ko | 무료 (셀프호스팅) | 한국어 +13.4% 성능 향상, 1024차원 |
| **FTS** | Nori + BM25 | - | Hybrid Retrieval용 |

#### 모델 선정 근거
- **Gemini 2.5 Flash-Lite**: 2025년 12월 기준 가장 저렴하면서 빠른 모델. TTFT ~180ms로 카카오톡 4초 제한 충족
- **BGE-m3-ko**: BGE-M3의 한국어 파인튜닝 버전. MIRACL 벤치마크에서 원본 대비 13.4% 성능 향상
- **Hybrid Retrieval**: Dense (BGE-m3-ko) + Sparse (Nori BM25) 조합으로 한국어 검색 품질 극대화

#### 고려된 대안
| 모델 | 장점 | 단점 | 결정 |
|------|------|------|------|
| Kakao Kanana-2 | 한국어 MMLU 89%, 토크나이저 30%↑ | 상업적 사용 시 별도 계약 필요 | 향후 검토 |
| Gemini 3 Flash | 최신, 2.5 Pro보다 빠름 | 비용 5배 ($0.50/$3.00) | MVP 이후 검토 |
| Upstage Solar Embedding | 상용 SLA, Ko-MIRACL +7.84점 | 유료 | 엔터프라이즈 플랜용 |

---

## 2. 디렉토리 구조

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 관련 라우트
│   │   ├── login/
│   │   └── signup/
│   ├── (portal)/                 # 고객 포털
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── chatbot/
│   │   └── settings/
│   ├── (admin)/                  # 내부 관리 도구
│   │   ├── tenants/
│   │   ├── chunks/
│   │   └── monitoring/
│   ├── api/                      # API Routes
│   │   ├── chat/
│   │   ├── documents/
│   │   ├── kakao/
│   │   └── inngest/
│   └── widget/                   # 임베드 위젯
├── components/
│   ├── ui/                       # 공통 UI 컴포넌트
│   ├── portal/                   # 포털 전용 컴포넌트
│   ├── admin/                    # 관리 도구 컴포넌트
│   └── chat/                     # 챗봇 컴포넌트
├── lib/
│   ├── supabase/                 # Supabase 클라이언트
│   ├── openai/                   # OpenAI 유틸리티
│   ├── rag/                      # RAG 핵심 로직
│   │   ├── chunking.ts
│   │   ├── embedding.ts
│   │   └── retrieval.ts
│   ├── parsers/                  # 문서 파서
│   │   ├── pdf.ts
│   │   ├── docx.ts
│   │   └── csv.ts
│   └── kakao/                    # 카카오 연동
├── inngest/
│   ├── client.ts
│   └── functions/
│       ├── process-document.ts
│       └── generate-embeddings.ts
├── types/
└── config/
```

---

## 3. 데이터베이스 스키마

### 3.1 핵심 테이블

```sql
-- 테넌트 (고객사)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  kakao_bot_id TEXT,
  kakao_skill_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 문서
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'chunked', 'reviewing', 'approved', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 청크
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1024),  -- BGE-m3-ko: 1024 차원
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('korean', content)) STORED,  -- Hybrid Retrieval용
  chunk_index INTEGER,
  quality_score REAL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 대화
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  channel TEXT DEFAULT 'web' CHECK (channel IN ('web', 'kakao')),
  messages JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용량 로그 (과금용)
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  conversation_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  token_usage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- 인덱스
CREATE INDEX idx_chunks_tenant ON chunks(tenant_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_fts ON chunks USING gin(content_tsv);  -- Hybrid Retrieval용 FTS 인덱스
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
```

### 3.2 Row Level Security (RLS)

```sql
-- 테넌트 RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tenant" ON tenants
  FOR SELECT USING (auth.uid()::text = id::text OR auth.jwt()->>'role' = 'admin');

-- 문서 RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents" ON documents
  FOR ALL USING (tenant_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

-- 청크 RLS (관리자만 직접 접근)
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage chunks" ON chunks
  FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Tenants can read own chunks" ON chunks
  FOR SELECT USING (tenant_id = auth.uid());
```

---

## 4. 핵심 기능 구현

### 4.1 문서 처리 파이프라인

```typescript
// inngest/functions/process-document.ts
import { inngest } from '../client';
import { parseDocument } from '@/lib/parsers';
import { smartChunk } from '@/lib/rag/chunking';
import { generateEmbeddings } from '@/lib/rag/embedding';

export const processDocument = inngest.createFunction(
  { id: 'process-document', retries: 3 },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { documentId, tenantId } = event.data;

    // Step 1: 문서 파싱
    const content = await step.run('parse-document', async () => {
      await updateDocumentStatus(documentId, 'processing');
      return await parseDocument(documentId);
    });

    // Step 2: 스마트 청킹
    const chunks = await step.run('chunk-document', async () => {
      return await smartChunk(content, {
        maxChunkSize: 500,
        overlap: 50,
        preserveStructure: true
      });
    });

    // Step 3: 임베딩 생성
    await step.run('generate-embeddings', async () => {
      await generateEmbeddings(chunks, tenantId, documentId);
      await updateDocumentStatus(documentId, 'reviewing');
    });

    // Step 4: 관리자 알림
    await step.run('notify-admin', async () => {
      await sendAdminNotification({
        type: 'review_needed',
        tenantId,
        documentId,
        chunkCount: chunks.length
      });
    });

    return { success: true, chunkCount: chunks.length };
  }
);
```

### 4.2 스마트 청킹 알고리즘

```typescript
// lib/rag/chunking.ts
interface ChunkOptions {
  maxChunkSize: number;
  overlap: number;
  preserveStructure: boolean;
}

export async function smartChunk(
  content: string,
  options: ChunkOptions
): Promise<Chunk[]> {
  // 1. 문서 구조 분석
  const structure = analyzeStructure(content);

  // 2. 의미 단위로 분리
  const segments = splitBySemanticUnits(content, structure);

  // 3. 크기 조절 및 오버랩 적용
  const chunks = segments.flatMap(segment =>
    splitWithOverlap(segment, options.maxChunkSize, options.overlap)
  );

  // 4. 품질 점수 계산
  return chunks.map(chunk => ({
    ...chunk,
    qualityScore: calculateQualityScore(chunk)
  }));
}

function analyzeStructure(content: string): DocumentStructure {
  return {
    hasHeaders: /^#+\s/m.test(content) || /^[A-Z가-힣].+\n={3,}/m.test(content),
    hasQAPairs: /Q[:：].*\nA[:：]/i.test(content) || /질문[:：].*\n답변[:：]/i.test(content),
    hasTables: /\|.*\|.*\|/m.test(content),
    hasLists: /^[-*•]\s/m.test(content) || /^\d+[.)]\s/m.test(content)
  };
}

function calculateQualityScore(chunk: Chunk): number {
  let score = 100;

  // 너무 짧으면 감점
  if (chunk.content.length < 100) score -= 20;

  // 문장이 중간에 잘렸으면 감점
  if (!chunk.content.endsWith('.') && !chunk.content.endsWith('다')) score -= 15;

  // Q&A 쌍이 분리됐으면 감점
  if (chunk.content.includes('Q:') && !chunk.content.includes('A:')) score -= 30;

  return Math.max(0, score);
}
```

### 4.3 RAG 검색 및 응답 생성 (Hybrid Retrieval)

```typescript
// lib/rag/retrieval.ts
export async function ragChat(
  tenantId: string,
  query: string,
  options: { maxChunks?: number; channel?: 'web' | 'kakao' } = {}
): Promise<string> {
  const { maxChunks = 3, channel = 'web' } = options;

  // 1. Hybrid Search (Dense + Sparse)
  const relevantChunks = await hybridSearch(tenantId, query, maxChunks);

  // 2. 컨텍스트 구성
  const context = relevantChunks
    .map(c => c.content)
    .join('\n\n---\n\n');

  // 3. LLM 응답 생성 (Gemini 2.5 Flash-Lite)
  const systemPrompt = channel === 'kakao'
    ? KAKAO_SYSTEM_PROMPT  // 짧은 응답 유도
    : WEB_SYSTEM_PROMPT;

  const response = await generateResponse(systemPrompt, context, query);

  return response;
}

// Hybrid Search: Dense (BGE-m3-ko) + Sparse (BM25)
async function hybridSearch(
  tenantId: string,
  query: string,
  limit: number
): Promise<Chunk[]> {
  // 1. Dense 검색 (BGE-m3-ko 임베딩)
  const queryEmbedding = await embedText(query);  // BGE-m3-ko
  const denseResults = await db.execute(sql`
    SELECT id, content, 1 - (embedding <=> ${queryEmbedding}::vector) as score
    FROM chunks
    WHERE tenant_id = ${tenantId} AND status = 'approved'
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit * 2}
  `);

  // 2. Sparse 검색 (Nori + BM25)
  const sparseResults = await db.execute(sql`
    SELECT id, content, ts_rank(content_tsv, plainto_tsquery('korean', ${query})) as score
    FROM chunks
    WHERE tenant_id = ${tenantId} AND status = 'approved'
      AND content_tsv @@ plainto_tsquery('korean', ${query})
    ORDER BY score DESC
    LIMIT ${limit * 2}
  `);

  // 3. Reciprocal Rank Fusion (RRF)
  return rerank(denseResults, sparseResults, limit);
}

// RRF 알고리즘으로 결과 병합
function rerank(
  denseResults: Chunk[],
  sparseResults: Chunk[],
  limit: number,
  k: number = 60
): Chunk[] {
  const scores = new Map<string, { chunk: Chunk; score: number }>();

  denseResults.forEach((chunk, rank) => {
    const rrf = 1 / (k + rank + 1);
    scores.set(chunk.id, { chunk, score: rrf });
  });

  sparseResults.forEach((chunk, rank) => {
    const rrf = 1 / (k + rank + 1);
    const existing = scores.get(chunk.id);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(chunk.id, { chunk, score: rrf });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.chunk);
}
```

### 4.4 카카오 오픈빌더 스킬 서버

```typescript
// app/api/kakao/skill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ragChat } from '@/lib/rag/retrieval';

const TIMEOUT_MS = 4000; // 카카오 5초 제한 대비 4초

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const userQuery = body.userRequest?.utterance;
    const botId = body.bot?.id;

    // 테넌트 확인
    const tenant = await getTenantByKakaoBot(botId);
    if (!tenant) {
      return kakaoResponse('설정된 챗봇을 찾을 수 없습니다.');
    }

    // 타임아웃 처리
    const responsePromise = ragChat(tenant.id, userQuery, {
      channel: 'kakao',
      maxChunks: 2  // 속도를 위해 청크 수 제한
    });

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
    );

    const response = await Promise.race([responsePromise, timeoutPromise]);

    // 응답 시간 로깅
    const duration = Date.now() - startTime;
    console.log(`Kakao response time: ${duration}ms`);

    return kakaoResponse(response);

  } catch (error) {
    if (error.message === 'timeout') {
      return kakaoResponse('잠시 후 다시 시도해 주세요. 답변을 준비 중입니다.');
    }
    return kakaoResponse('죄송합니다. 오류가 발생했습니다.');
  }
}

function kakaoResponse(text: string) {
  return NextResponse.json({
    version: '2.0',
    template: {
      outputs: [{ simpleText: { text } }]
    }
  });
}
```

---

## 5. Phase별 상세 개발 계획

### Phase 1: 기반 구축 (Week 1-4)

#### Week 1: 프로젝트 셋업
- [ ] Next.js 14 + TypeScript + Tailwind 초기화
- [ ] Supabase 프로젝트 생성 및 연결
- [ ] 환경 변수 설정 (.env.local)
- [ ] DB 스키마 생성 (SQL 마이그레이션)
- [ ] Vercel 프로젝트 연결 및 배포 테스트
- [ ] 기본 레이아웃 및 라우팅 구조

#### Week 2: 인증 + 멀티테넌시
- [ ] Supabase Auth 설정 (이메일/비밀번호)
- [ ] 로그인/회원가입 UI (shadcn/ui 기반)
- [ ] 테넌트 자동 생성 로직 (회원가입 시)
- [ ] RLS 정책 적용 및 테스트
- [ ] 인증 미들웨어 구현
- [ ] 기본 대시보드 레이아웃

#### Week 3: 파일 업로드
- [ ] 드래그앤드롭 업로드 UI 컴포넌트
- [ ] 파일 유효성 검사 (타입, 크기 제한)
- [ ] Supabase Storage 버킷 설정
- [ ] 업로드 진행률 표시
- [ ] Inngest 클라이언트 설정
- [ ] 업로드 완료 시 처리 작업 트리거

#### Week 4: 문서 처리 파이프라인
- [ ] PDF 파서 구현 (pdf-parse)
- [ ] DOCX 파서 구현 (mammoth)
- [ ] TXT/CSV 파서 구현
- [ ] 스마트 청킹 알고리즘 구현
- [ ] OpenAI 임베딩 생성 로직
- [ ] pgvector 저장 및 인덱싱
- [ ] 처리 상태 업데이트 로직

### Phase 2: 핵심 기능 (Week 5-8)

#### Week 5: RAG 챗봇
- [ ] 벡터 유사도 검색 함수 (RPC)
- [ ] 시스템 프롬프트 템플릿 설계
- [ ] OpenAI 스트리밍 응답 구현
- [ ] 대화 저장 로직
- [ ] 기본 채팅 UI 컴포넌트
- [ ] 에러 핸들링 및 폴백

#### Week 6: 내부 검토 도구
- [ ] 청크 목록 뷰 (테넌트별 필터)
- [ ] 청크 상세 보기/수정 모달
- [ ] 품질 점수 시각화
- [ ] 키보드 단축키 (A/S/M/E/D)
- [ ] 일괄 승인/거부 기능
- [ ] 배포 버튼 및 상태 관리

#### Week 7: 챗봇 위젯
- [ ] iframe 임베드 가능한 위젯 페이지
- [ ] 플로팅 버튼 + 채팅창 UI
- [ ] 테넌트별 스타일 커스터마이징
- [ ] 임베드 코드 생성기
- [ ] CORS 설정
- [ ] 모바일 반응형 처리

#### Week 8: 카카오 연동
- [ ] 오픈빌더 스킬 서버 엔드포인트
- [ ] 4초 타임아웃 처리
- [ ] 응답 포맷팅 (300자 제한)
- [ ] 테넌트별 카카오 봇 ID 매핑
- [ ] 연동 가이드 문서 작성
- [ ] 테스트 및 디버깅

### Phase 3: 완성도 (Week 9-12)

#### Week 9: 고객 포털 완성
- [ ] 문서 처리 상태 실시간 표시
- [ ] 상담 로그 조회 (날짜/채널 필터)
- [ ] 챗봇 테스트 페이지
- [ ] 설정 페이지 (기본 정보, 카카오 연동)
- [ ] 임베드 코드 복사 기능

#### Week 10: 운영 도구
- [ ] 이메일 알림 (Resend 연동)
- [ ] 관리자 대시보드 (전체 현황)
- [ ] 에러/지연 알림 설정
- [ ] 사용량 리포트 (과금용)
- [ ] 테넌트별 상세 모니터링

#### Week 11: 안정화
- [ ] 전체 에러 핸들링 검토
- [ ] 로딩/스켈레톤 UI 개선
- [ ] 엣지 케이스 테스트
- [ ] 성능 최적화 (쿼리, 캐싱)
- [ ] 보안 점검 (인증, RLS)

#### Week 12: 런칭 준비
- [ ] 랜딩 페이지 제작
- [ ] 온보딩 플로우 구현
- [ ] 사용 가이드 작성
- [ ] 베타 테스터 모집 및 피드백
- [ ] 최종 버그 수정

---

## 6. API 엔드포인트 설계

### 6.1 문서 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/documents` | 문서 목록 조회 |
| POST | `/api/documents` | 문서 업로드 |
| GET | `/api/documents/[id]` | 문서 상세 조회 |
| DELETE | `/api/documents/[id]` | 문서 삭제 |
| POST | `/api/documents/[id]/reprocess` | 재처리 요청 |

### 6.2 챗봇

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/chat` | 채팅 메시지 전송 (스트리밍) |
| GET | `/api/conversations` | 대화 목록 조회 |
| GET | `/api/conversations/[id]` | 대화 상세 조회 |

### 6.3 카카오

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kakao/skill` | 오픈빌더 스킬 서버 |

### 6.4 관리자 (내부)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/tenants` | 테넌트 목록 |
| GET | `/api/admin/chunks` | 청크 목록 (검토용) |
| PATCH | `/api/admin/chunks/[id]` | 청크 수정/승인 |
| POST | `/api/admin/deploy/[tenantId]` | 배포 실행 |

---

## 7. 환경 변수

```env
# 데이터베이스 (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# 세션 암호화 키 (32자 이상 권장)
SESSION_SECRET=your-secret-key-at-least-32-characters

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# S3 호환 스토리지
S3_BUCKET=your-bucket-name
S3_REGION=ap-northeast-2
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://...  # MinIO/Cloudflare R2 등 사용 시

# Google Gemini (LLM)
GOOGLE_GENERATIVE_AI_API_KEY=...

# OpenAI (폴백용)
OPENAI_API_KEY=...

# BGE-m3-ko 임베딩 서버 (셀프호스팅)
EMBEDDING_API_URL=http://localhost:8000
# 또는 Hugging Face Inference API 사용 시
# HF_API_KEY=...

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=
ADMIN_EMAIL=

# (선택) 이메일 알림
RESEND_API_KEY=
```

---

## 8. 의존성 패키지

```json
{
  "dependencies": {
    "next": "16.x",
    "react": "19.x",
    "react-dom": "19.x",
    "@neondatabase/serverless": "^1.x",
    "drizzle-orm": "^0.45.x",
    "iron-session": "^8.x",
    "@upstash/ratelimit": "^2.x",
    "@upstash/redis": "^1.x",
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x",
    "@google/generative-ai": "^0.x",
    "openai": "^6.x",
    "ai": "^6.x",
    "inngest": "^3.x",
    "pdf-parse": "^2.x",
    "mammoth": "^1.x",
    "papaparse": "^5.x",
    "zod": "^4.x",
    "tailwindcss": "^4.x",
    "class-variance-authority": "^0.x",
    "clsx": "^2.x",
    "lucide-react": "^0.x",
    "bcrypt": "^6.x",
    "otplib": "^12.x",
    "qrcode": "^1.x",
    "resend": "^6.x",
    "uuid": "^13.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "@types/react": "^19.x",
    "drizzle-kit": "^0.31.x",
    "vitest": "^4.x",
    "@testing-library/react": "^16.x",
    "@playwright/test": "^1.x",
    "eslint": "^9.x",
    "eslint-config-next": "16.x"
  }
}
```

---

## 9. 성공 지표 및 모니터링

### 9.1 기술 지표
- 카카오 응답 시간: p95 < 4초
- 웹 챗봇 응답 시간: p95 < 3초
- RAG 검색 정확도: 관련 청크 top-3 적중률 > 80%
- 시스템 가용성: > 99.5%

### 9.2 비즈니스 지표
- 청킹 검토 시간: 고객당 < 30분
- 자동 승인 청크 비율: > 70% (Phase 2 이후)
- 고객 이탈률: < 10%/월

### 9.3 모니터링 도구
- Vercel Analytics: 성능 모니터링
- Supabase Dashboard: DB 쿼리 성능
- Sentry: 에러 추적 (선택)
- Custom Dashboard: 사용량, 과금 지표

---

## 10. 보안 고려사항

1. **인증**: Supabase Auth + JWT 기반
2. **권한 분리**: RLS로 테넌트 간 데이터 격리
3. **API 보안**: Rate limiting, 입력 검증
4. **파일 업로드**: 타입/크기 제한, 악성 파일 검사
5. **환경 변수**: 민감 정보 서버 사이드만 접근
6. **CORS**: 허용된 도메인만 위젯 임베드

---

## 11. 확장 계획 (MVP 이후)

### 단기 (3-6개월)
- 자동 응답 품질 평가 시스템
- 상담 로그 분석 대시보드
- Gemini 3 Flash 업그레이드 (비용 대비 성능 검토)
- Kakao Kanana-2 검토 (상업적 라이선스 확보 시)

### 중기 (6-12개월)
- 팀 멤버 초대 기능
- API 제공 (외부 연동)
- 자동 결제 시스템 (Stripe/Toss)
- Upstage Solar Embedding (엔터프라이즈 플랜)

### 장기 (12개월+)
- 음성 상담 연동
- 자체 임베딩 모델 파인튜닝
- HNSW 인덱스 전환 (대용량 데이터 대응)

---

## 12. AI 모델 폴백 전략

```typescript
// lib/llm/provider.ts
const LLM_PROVIDERS = [
  {
    name: 'gemini',
    model: 'gemini-2.5-flash-lite',
    priority: 1,
    healthCheck: async () => { /* ... */ }
  },
  {
    name: 'openai',
    model: 'gpt-4o-mini',
    priority: 2,
    healthCheck: async () => { /* ... */ }
  }
];

export async function generateWithFallback(
  prompt: string,
  options: GenerateOptions
): Promise<string> {
  for (const provider of LLM_PROVIDERS) {
    try {
      const isHealthy = await provider.healthCheck();
      if (!isHealthy) continue;

      return await generate(provider, prompt, options);
    } catch (error) {
      logger.warn(`Provider ${provider.name} failed, trying next...`, error);
      continue;
    }
  }

  throw new AppError(ErrorCode.LLM_UNAVAILABLE, '모든 LLM 서비스가 응답하지 않습니다.');
}
```

### 폴백 시나리오

| 상황 | 메인 | 폴백 | 비고 |
|------|------|------|------|
| 정상 | Gemini 2.5 Flash-Lite | - | - |
| Gemini 장애 | - | GPT-4o-mini | 자동 전환 |
| 모두 장애 | - | - | 에러 메시지 + 재시도 안내 |
