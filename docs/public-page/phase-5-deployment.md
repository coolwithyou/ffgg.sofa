# Phase 5: 통합 테스트 및 배포

> 예상 기간: 2-3일

## 목표

전체 기능 검증 및 안전한 프로덕션 배포

## 선행 조건

- [Phase 1: DB 스키마 및 기반 인프라](./phase-1-db-schema.md) 완료
- [Phase 2: 라우팅 및 공개 페이지 렌더링](./phase-2-routing.md) 완료
- [Phase 3: 포탈 관리 UI](./phase-3-portal-ui.md) 완료
- [Phase 4: 보안 및 Rate Limiting](./phase-4-security.md) 완료

## 작업 내용

### 5.1 Feature Flag 설정

**파일**: `lib/config/feature-flags.ts` (신규 또는 수정)

```typescript
/**
 * Feature Flags 설정
 * 환경 변수로 기능 활성화/비활성화 제어
 */

export const featureFlags = {
  /**
   * 공개 페이지 기능 활성화 여부
   * 환경변수: FEATURE_PUBLIC_PAGE
   */
  publicPage: process.env.FEATURE_PUBLIC_PAGE === 'true',

  /**
   * 공개 페이지 Rate Limiting 활성화
   * 환경변수: FEATURE_PUBLIC_PAGE_RATE_LIMIT
   */
  publicPageRateLimit: process.env.FEATURE_PUBLIC_PAGE_RATE_LIMIT !== 'false',
};

/**
 * Feature flag 체크 헬퍼
 */
export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature];
}
```

**파일**: `app/[slug]/page.tsx` (수정)

```typescript
import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
// ...

export default async function PublicPage({ params }: PageProps) {
  // Feature flag 체크
  if (!isFeatureEnabled('publicPage')) {
    notFound();
  }

  // 기존 로직...
}
```

### 5.2 E2E 테스트

**파일**: `e2e/public-page.spec.ts` (신규)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Public Page', () => {
  test.describe('페이지 접근', () => {
    test('유효한 슬러그로 공개 페이지 접근 시 챗봇이 표시된다', async ({ page }) => {
      // 테스트용 챗봇 슬러그 (테스트 데이터 필요)
      await page.goto('/test-chatbot');

      // 헤더 블록 확인
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // 챗봇 블록 확인
      await expect(page.getByPlaceholder('메시지를 입력하세요')).toBeVisible();
      await expect(page.getByRole('button', { name: '전송' })).toBeVisible();
    });

    test('존재하지 않는 슬러그 접근 시 404 페이지가 표시된다', async ({ page }) => {
      await page.goto('/non-existent-slug-12345');

      await expect(page.getByText('404')).toBeVisible();
      await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
    });

    test('예약어 슬러그 접근 시 404 페이지가 표시된다', async ({ page }) => {
      await page.goto('/admin');

      // 공개 페이지 404가 아닌 admin 페이지나 로그인으로 리다이렉트
      // 또는 404 표시 (라우팅 설정에 따라)
      const url = page.url();
      expect(url).not.toContain('/admin'); // 공개 페이지로 처리되지 않음
    });

    test('비활성화된 공개 페이지 접근 시 404가 표시된다', async ({ page }) => {
      // publicPageEnabled = false인 챗봇 슬러그
      await page.goto('/disabled-chatbot');

      await expect(page.getByText('404')).toBeVisible();
    });
  });

  test.describe('채팅 기능', () => {
    test('메시지 전송 시 응답을 받는다', async ({ page }) => {
      await page.goto('/test-chatbot');

      // 메시지 입력
      const input = page.getByPlaceholder('메시지를 입력하세요');
      await input.fill('안녕하세요');

      // 전송 버튼 클릭
      await page.getByRole('button', { name: '전송' }).click();

      // 사용자 메시지 표시 확인
      await expect(page.getByText('안녕하세요')).toBeVisible();

      // 로딩 인디케이터 표시
      await expect(page.locator('.animate-bounce')).toBeVisible();

      // 응답 대기 (최대 10초)
      await expect(page.locator('[data-role="assistant"]')).toBeVisible({ timeout: 10000 });
    });

    test('빈 메시지는 전송되지 않는다', async ({ page }) => {
      await page.goto('/test-chatbot');

      const sendButton = page.getByRole('button', { name: '전송' });

      // 초기 상태에서 버튼 비활성화
      await expect(sendButton).toBeDisabled();

      // 공백만 입력
      await page.getByPlaceholder('메시지를 입력하세요').fill('   ');
      await expect(sendButton).toBeDisabled();
    });
  });

  test.describe('Rate Limiting', () => {
    test('과도한 요청 시 제한 메시지가 표시된다', async ({ page }) => {
      await page.goto('/test-chatbot');

      const input = page.getByPlaceholder('메시지를 입력하세요');
      const sendButton = page.getByRole('button', { name: '전송' });

      // 빠르게 여러 메시지 전송
      for (let i = 0; i < 15; i++) {
        await input.fill(`테스트 메시지 ${i}`);
        await sendButton.click();
        await page.waitForTimeout(100);
      }

      // Rate limit 메시지 확인
      await expect(page.getByText(/요청이 너무 빠릅니다|한도에 도달/)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('테마 적용', () => {
    test('커스텀 테마 색상이 적용된다', async ({ page }) => {
      await page.goto('/themed-chatbot');

      // CSS 변수 확인
      const bgColor = await page.evaluate(() => {
        const el = document.querySelector('main');
        return el ? getComputedStyle(el).backgroundColor : null;
      });

      expect(bgColor).toBeTruthy();
    });
  });

  test.describe('SEO', () => {
    test('메타 태그가 올바르게 설정된다', async ({ page }) => {
      await page.goto('/test-chatbot');

      // 페이지 타이틀
      const title = await page.title();
      expect(title).not.toBe('');
      expect(title).not.toBe('Not Found');

      // OG 태그
      const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
      expect(ogTitle).toBeTruthy();
    });
  });
});
```

### 5.3 기존 기능 회귀 테스트

**파일**: `e2e/regression.spec.ts` (신규 또는 수정)

```typescript
import { test, expect } from '@playwright/test';

test.describe('기존 기능 회귀 테스트', () => {
  test.describe('Widget 시스템', () => {
    test('/widget/[tenantId] iframe 임베드가 정상 동작한다', async ({ page }) => {
      // HTML 페이지에 iframe으로 위젯 임베드
      await page.setContent(`
        <html>
          <body>
            <iframe
              id="sofa-widget"
              src="${process.env.BASE_URL || 'http://localhost:3000'}/widget/test-tenant"
              width="400"
              height="600"
            ></iframe>
          </body>
        </html>
      `);

      // iframe 내 챗봇 UI 확인
      const frame = page.frameLocator('#sofa-widget');
      await expect(frame.getByPlaceholder(/메시지/)).toBeVisible({ timeout: 10000 });
    });

    test('widgetApiKey 검증이 정상 동작한다', async ({ page }) => {
      // 유효하지 않은 API 키로 요청 시 에러
      const response = await page.request.post('/api/widget/chat', {
        headers: {
          'x-widget-api-key': 'invalid_key',
        },
        data: {
          message: 'test',
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('포탈 기능', () => {
    test('챗봇 목록 페이지가 정상 동작한다', async ({ page }) => {
      // 로그인 필요
      await page.goto('/login');
      // 로그인 프로세스...

      await page.goto('/chatbots');
      await expect(page.getByRole('heading', { name: /챗봇/ })).toBeVisible();
    });

    test('챗봇 설정 페이지가 정상 동작한다', async ({ page }) => {
      // 로그인 후 챗봇 설정 페이지 접근
      await page.goto('/chatbots/test-chatbot-id');

      // 탭 확인
      await expect(page.getByRole('tab', { name: '개요' })).toBeVisible();
      await expect(page.getByRole('tab', { name: '설정' })).toBeVisible();
      await expect(page.getByRole('tab', { name: '공개 페이지' })).toBeVisible();
    });
  });

  test.describe('관리자 페이지', () => {
    test('/admin 경로가 정상 동작한다', async ({ page }) => {
      await page.goto('/admin');

      // 로그인 페이지로 리다이렉트 또는 관리자 페이지 표시
      const url = page.url();
      expect(url).toMatch(/\/admin|\/login/);
    });
  });
});
```

### 5.4 배포 체크리스트

```markdown
## 배포 전 체크리스트

### 코드 품질
- [ ] TypeScript 타입 에러 없음 (`pnpm tsc --noEmit`)
- [ ] ESLint 경고/에러 없음 (`pnpm lint`)
- [ ] 단위 테스트 통과 (`pnpm test`)
- [ ] E2E 테스트 통과 (`pnpm test:e2e`)

### 데이터베이스
- [ ] 마이그레이션 파일 생성 완료
- [ ] 스테이징 환경 마이그레이션 성공
- [ ] 롤백 SQL 준비

### 환경 변수
- [ ] `FEATURE_PUBLIC_PAGE=false` (초기 배포)
- [ ] `FEATURE_PUBLIC_PAGE_RATE_LIMIT=true`
- [ ] Upstash Redis 연결 확인

### 보안
- [ ] 보안 헤더 적용 확인
- [ ] Rate limit 설정 확인
- [ ] 입력 검증 로직 확인

### 모니터링
- [ ] 에러 로깅 설정
- [ ] Rate limit 알림 설정 (선택)
- [ ] 페이지 성능 모니터링 (선택)
```

### 5.5 점진적 롤아웃 계획

```markdown
## 롤아웃 단계

### Stage 1: 스테이징 환경 (1일)
1. 스테이징 환경에 배포
2. 내부 QA 테스트
3. 성능 및 보안 점검

### Stage 2: 내부 테넌트 (2-3일)
1. `FEATURE_PUBLIC_PAGE=true` 설정
2. 내부 테스트 테넌트만 공개 페이지 활성화
3. 실사용 피드백 수집

### Stage 3: 전체 배포 (이후)
1. 모든 테넌트에 기능 공개
2. 문서 및 가이드 배포
3. 고객 공지
```

### 5.6 롤백 절차

```markdown
## 긴급 롤백 절차

### Level 1: Feature Flag 비활성화 (즉시)
1. 환경 변수 변경: `FEATURE_PUBLIC_PAGE=false`
2. 배포 트리거 또는 서버 재시작
3. 공개 페이지 접근 시 404 반환

### Level 2: 코드 롤백 (5-10분)
1. 이전 버전으로 git revert 또는 rollback
2. 재배포

### Level 3: DB 롤백 (15-30분)
1. 백업에서 복원 또는 롤백 SQL 실행
```sql
-- 인덱스 삭제
DROP INDEX IF EXISTS idx_chatbots_slug;
DROP INDEX IF EXISTS idx_chatbots_public_page;

-- 컬럼 삭제
ALTER TABLE chatbots
DROP COLUMN IF EXISTS slug,
DROP COLUMN IF EXISTS public_page_enabled,
DROP COLUMN IF EXISTS public_page_config;
```

### 롤백 후 확인 사항
- [ ] 기존 widget 기능 정상 동작
- [ ] 포탈 기능 정상 동작
- [ ] 에러 로그 확인
```

## 테스트 체크리스트 종합

### 기존 기능 회귀 테스트
- [ ] `/widget/[tenantId]` iframe 임베드 정상 동작
- [ ] widgetApiKey 검증 정상 동작
- [ ] 포탈 모든 기능 정상 동작
- [ ] 관리자 페이지 정상 동작

### 신규 기능 테스트
- [ ] 공개 페이지 접근 및 렌더링
- [ ] 챗봇 채팅 기능
- [ ] 테마 적용
- [ ] SEO 메타태그 생성
- [ ] Rate limiting 동작
- [ ] 404 처리

### 성능 테스트
- [ ] 페이지 로드 시간 3초 이내
- [ ] ISR 캐싱 동작 확인
- [ ] 동시 접속 테스트

### 보안 테스트
- [ ] XSS 공격 차단
- [ ] CSRF 방어
- [ ] Rate limit 우회 불가

## 완료 조건

- [ ] 모든 테스트 통과
- [ ] 스테이징 환경 검증 완료
- [ ] 롤백 절차 문서화
- [ ] Feature flag로 안전한 롤아웃 준비
- [ ] 모니터링 설정 완료

## 배포 후 모니터링

### 초기 1주일
- 에러 로그 모니터링
- Rate limit 적중률 확인
- 사용자 피드백 수집
- 성능 메트릭 확인

### 지속적 모니터링
- 페이지 조회수 추적
- 채팅 세션 통계
- 에러율 추적
- 사용자 경험 지표

---

## 프로젝트 완료

모든 Phase가 완료되면 SOFA Public Page 기능이 완성됩니다.

### 최종 결과물
- Linktree 스타일 독립 공개 페이지
- 챗봇별 커스터마이징 가능한 URL
- 헤더 + 챗봇 인터페이스
- 테마 및 SEO 설정
- Rate limiting 및 보안 강화

### 향후 확장
- [README.md](./README.md)의 "향후 확장 계획" 참조
