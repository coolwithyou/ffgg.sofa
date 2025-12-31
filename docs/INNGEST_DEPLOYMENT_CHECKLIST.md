# Inngest 프로덕션 배포 점검 목록

## 개요

로컬 개발 환경에서는 `pnpm dev:inngest` 명령어로 Inngest Dev Server를 실행하지만, **프로덕션 환경(Vercel)에서는 별도의 Inngest 서버 실행이 필요 없습니다.**

Inngest는 클라우드 기반 서비스로, Vercel에 배포된 앱의 `/api/inngest` 엔드포인트를 통해 함수를 호출합니다.

```
┌─────────────────┐      이벤트 발생      ┌─────────────────┐
│   Your App      │ ─────────────────────> │  Inngest Cloud  │
│   (Vercel)      │                        │    Platform     │
│                 │ <───────────────────── │                 │
│ /api/inngest    │   함수 실행 요청       │                 │
└─────────────────┘                        └─────────────────┘
```

---

## 1단계: Inngest 계정 및 앱 설정

### 1.1 Inngest 계정 생성
- [ ] [Inngest 대시보드](https://app.inngest.com)에 가입/로그인
- [ ] 새 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 API 키 발급
Inngest 대시보드 > Settings > Keys에서 발급:

| 키 이름 | 용도 | 환경변수명 |
|---------|------|-----------|
| Event Key | 이벤트 전송용 (클라이언트→Inngest) | `INNGEST_EVENT_KEY` |
| Signing Key | 요청 서명 검증용 (Inngest→앱) | `INNGEST_SIGNING_KEY` |

> **주의**: Production 환경용 키와 Development 환경용 키가 별도로 있습니다. 프로덕션 배포 시 Production 키를 사용하세요.

---

## 2단계: Vercel 환경변수 설정

### 2.1 Vercel 대시보드에서 환경변수 추가

Vercel Dashboard > Project > Settings > Environment Variables:

```bash
# 필수 설정
INNGEST_EVENT_KEY=<Inngest 대시보드에서 발급받은 Event Key>
INNGEST_SIGNING_KEY=<Inngest 대시보드에서 발급받은 Signing Key>
```

### 2.2 환경별 설정
| 환경변수 | Production | Preview | Development |
|----------|------------|---------|-------------|
| `INNGEST_EVENT_KEY` | ✅ Production Key | ✅ Dev Key (선택) | ✅ Dev Key |
| `INNGEST_SIGNING_KEY` | ✅ Production Key | ✅ Dev Key (선택) | ✅ Dev Key |

> **팁**: Preview 배포에서 Inngest를 테스트하려면 별도의 Dev 키를 사용하거나, Preview 환경에서는 Inngest를 비활성화할 수 있습니다.

---

## 3단계: Vercel Integration 설치 (권장)

### 3.1 통합 설치
Inngest의 공식 Vercel Integration을 설치하면 **자동 동기화**가 활성화됩니다:

1. [Inngest Vercel Integration](https://vercel.com/integrations/inngest) 페이지로 이동
2. "Add Integration" 클릭
3. Vercel 프로젝트 선택 및 권한 부여
4. Inngest 계정과 연결

### 3.2 통합 설치 시 자동으로 수행되는 작업
- ✅ 환경변수 자동 설정 (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`)
- ✅ 배포 시마다 자동으로 앱 동기화
- ✅ 새 함수 등록 자동화

### 3.3 수동 동기화 (통합 미사용 시)
통합을 사용하지 않는 경우, 배포 후 수동으로 동기화해야 합니다:

```bash
# 배포 후 실행
curl -X PUT https://your-app.vercel.app/api/inngest
```

또는 Inngest 대시보드에서 "Sync App" 버튼 클릭.

---

## 4단계: 코드 확인

### 4.1 API 라우트 확인
현재 프로젝트의 Inngest API 라우트가 올바르게 설정되어 있는지 확인:

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngestClient } from '@/inngest/client';
import { processDocument, sendNotification } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngestClient,
  functions: [processDocument, sendNotification],
});
```

### 4.2 클라이언트 설정 확인
```typescript
// inngest/client.ts
const realInngest = new Inngest({
  id: 'sofa-rag-chatbot',  // Inngest 대시보드에서 사용할 앱 ID
  name: 'SOFA RAG Chatbot',
});
```

### 4.3 함수 목록 확인
현재 등록된 Inngest 함수:

| 함수 ID | 트리거 이벤트 | 설명 |
|---------|--------------|------|
| `process-document` | `document/uploaded` | 문서 파싱→청킹→임베딩→저장 |
| `send-notification` | `notification/send` | 알림 발송 |

---

## 5단계: 배포 전 체크리스트

### 환경변수 점검
- [ ] `INNGEST_EVENT_KEY` 설정됨 (프로덕션 키)
- [ ] `INNGEST_SIGNING_KEY` 설정됨 (프로덕션 키)
- [ ] 키가 플레이스홀더 값이 아닌 실제 값으로 설정됨

### 코드 점검
- [ ] `/api/inngest` 라우트가 존재함
- [ ] 모든 Inngest 함수가 `serve()` 함수에 등록됨
- [ ] 함수 내에서 사용하는 환경변수가 모두 설정됨
  - [ ] `DATABASE_URL` (문서 처리용)
  - [ ] `GOOGLE_GENERATIVE_AI_API_KEY` 또는 `OPENAI_API_KEY` (임베딩용)
  - [ ] `ANTHROPIC_API_KEY` (Contextual Retrieval용, 선택)
  - [ ] `S3_*` 관련 변수 (파일 스토리지용)

### Inngest 대시보드 점검
- [ ] 프로젝트/앱이 생성됨
- [ ] Production 환경 키가 발급됨
- [ ] (선택) Vercel Integration이 연결됨

---

## 6단계: 배포 및 검증

### 6.1 배포
```bash
# Vercel CLI 또는 Git push
vercel --prod
# 또는
git push origin main
```

### 6.2 동기화 확인
배포 후 Inngest 대시보드에서:
1. Apps 탭으로 이동
2. `sofa-rag-chatbot` 앱이 표시되는지 확인
3. 앱 클릭 후 Functions 목록 확인
   - `process-document`
   - `send-notification`

### 6.3 테스트 이벤트 전송
Inngest 대시보드에서 테스트 이벤트를 전송하여 함수가 정상 동작하는지 확인:

1. Events 탭 > Send Event
2. 이벤트 페이로드 입력:
```json
{
  "name": "document/uploaded",
  "data": {
    "documentId": "test-doc-id",
    "tenantId": "test-tenant-id",
    "datasetId": "test-dataset-id",
    "userId": "test-user-id",
    "filename": "test.pdf",
    "fileType": "pdf",
    "filePath": "test/path/test.pdf"
  }
}
```

> **주의**: 테스트 이벤트는 실제 DB와 스토리지에 접근하므로, 테스트용 데이터를 사용하거나 별도의 테스트 환경에서 수행하세요.

---

## 7단계: 모니터링

### 7.1 Inngest 대시보드 모니터링
- **Runs 탭**: 함수 실행 기록 확인
- **Events 탭**: 수신된 이벤트 목록
- **Logs 탭**: 상세 실행 로그

### 7.2 실패 알림 설정 (권장)
Inngest 대시보드 > Settings > Notifications에서:
- [ ] Slack 연동 설정
- [ ] 이메일 알림 설정
- [ ] 실패 시 알림 조건 설정

---

## 문제 해결

### 함수가 동기화되지 않을 때
```bash
# 수동 동기화
curl -X PUT https://your-app.vercel.app/api/inngest
```

### "No signing key" 오류
- Vercel 환경변수에서 `INNGEST_SIGNING_KEY` 확인
- 키 값이 올바른지 확인 (복사/붙여넣기 시 공백 주의)

### "Event key not configured" 오류
- Vercel 환경변수에서 `INNGEST_EVENT_KEY` 확인

### 함수 실행 타임아웃
Vercel Serverless Functions의 기본 타임아웃:
- Hobby: 10초
- Pro: 60초 (설정 가능)
- Enterprise: 900초

긴 문서 처리가 필요한 경우:
1. Vercel Pro 플랜 사용
2. `vercel.json`에서 `maxDuration` 설정:
```json
{
  "functions": {
    "app/api/inngest/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### 재시도 설정
현재 `process-document` 함수는 3회 재시도로 설정됨:
```typescript
{
  id: 'process-document',
  retries: 3,
  // ...
}
```

---

## 로컬 개발 vs 프로덕션 비교

| 항목 | 로컬 개발 | 프로덕션 (Vercel) |
|------|----------|------------------|
| Inngest 서버 | `pnpm dev:inngest` 실행 필요 | Inngest Cloud 사용 (별도 실행 불필요) |
| 이벤트 전송 | localhost:8288로 전송 | Inngest Cloud로 전송 |
| 함수 호출 | localhost:3060/api/inngest | your-app.vercel.app/api/inngest |
| 환경변수 | .env.local | Vercel Dashboard |
| 동기화 | 자동 (Dev Server 감지) | Vercel Integration 또는 수동 |

---

## 참고 자료

- [Inngest 공식 문서](https://www.inngest.com/docs)
- [Inngest + Vercel 가이드](https://www.inngest.com/docs/deploy/vercel)
- [Inngest Vercel Integration](https://vercel.com/integrations/inngest)
- [Inngest 대시보드](https://app.inngest.com)
