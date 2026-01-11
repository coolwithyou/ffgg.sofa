# Phase 5: 통합 테스트 (2일)

## 개요

| 항목 | 내용 |
|------|------|
| **목표** | 전체 워크플로우 검증 및 엣지 케이스 처리 |
| **산출물** | 테스트 시나리오 + E2E 테스트 + 성능 테스트 |
| **의존성** | Phase 1-4 완료 |
| **예상 기간** | 2일 |

---

## 5.1 테스트 시나리오

### 5.1.1 기능별 시나리오

| # | 시나리오 | 검증 포인트 | 우선순위 |
|---|---------|------------|----------|
| 1 | 기본 플로우 | 문서 업로드 → 검증 세션 생성 → Claim 추출 → 검토 → 승인 → 페이지 생성 | P0 |
| 2 | 고위험 항목 검토 | CONTRADICTED Claim이 High Risk로 표시, 필수 검토 강제 | P0 |
| 3 | 수정 후 승인 | 재구성 마크다운 수정 → 저장 → 승인 시 수정본 반영 확인 | P0 |
| 4 | 거부 플로우 | 거부 사유 입력 → 세션 상태 rejected → 목록에서 제외 | P1 |
| 5 | PDF 렌더링 | PDF 업로드 → 렌더링 → Claim 선택 시 하이라이트 표시 | P1 |
| 6 | 스크롤 동기화 | 원본 스크롤 → 재구성 동기화 (역방향 동일) | P2 |
| 7 | 민감정보 마스킹 | 전화번호/이메일/주민번호 자동 마스킹 확인 | P1 |
| 8 | 세션 만료 | 7일 경과 → 상태 expired → 자동 정리 | P2 |

### 5.1.2 시나리오 상세

#### 시나리오 1: 기본 검증 플로우

```
Given: 로그인된 사용자, 선택된 챗봇
When:
  1. 블로그 페이지에서 "문서 가져오기" 클릭
  2. PDF 파일 업로드
  3. 업로드 완료 후 "검증" 메뉴 이동
  4. 검증 세션 카드 클릭
  5. Dual Viewer에서 Claim 검토
  6. "승인 및 저장" 클릭
Then:
  - 검증 세션 상태: approved
  - Knowledge Pages 생성됨
  - 블로그 트리에 새 페이지 표시
```

#### 시나리오 2: 고위험 항목 필수 검토

```
Given: CONTRADICTED verdict가 있는 검증 세션
When:
  1. Dual Viewer 접근
  2. 고위험 항목 미검토 상태에서 "승인 및 저장" 클릭
Then:
  - 승인 차단
  - "N개의 고위험 항목을 먼저 검토하세요" 메시지 표시
  - 고위험 항목에 포커스
```

#### 시나리오 3: 마크다운 수정 후 승인

```
Given: ready_for_review 상태의 검증 세션
When:
  1. 재구성 마크다운에서 오류 발견
  2. 내용 수정
  3. "저장" 클릭
  4. 수정 관련 Claim 검토 및 "확인" 처리
  5. "승인 및 저장" 클릭
Then:
  - 수정된 마크다운으로 페이지 생성
  - 감사 로그에 markdown_edited 기록
```

---

## 5.2 E2E 테스트

### 5.2.1 Playwright 설정

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 5.2.2 테스트 헬퍼

```typescript
// __tests__/e2e/helpers/auth.ts

import { Page } from '@playwright/test';

export async function loginAsTestUser(page: Page) {
  await page.goto('/login');
  await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/console/chatbot');
}

export async function selectChatbot(page: Page, chatbotName: string) {
  await page.click('[data-testid="chatbot-selector"]');
  await page.click(`text=${chatbotName}`);
}
```

```typescript
// __tests__/e2e/helpers/validation.ts

import { Page, expect } from '@playwright/test';

export async function uploadDocument(page: Page, filePath: string) {
  await page.click('text=문서 가져오기');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await page.click('text=업로드');
  await expect(page.locator('text=검증 대기 중')).toBeVisible({ timeout: 30000 });
}

export async function navigateToValidation(page: Page) {
  await page.click('[data-testid="nav-validation"]');
  await page.waitForURL(/\/validation$/);
}

export async function openValidationSession(page: Page) {
  await page.click('[data-testid="validation-session-card"]');
  await page.waitForURL(/\/validation\/[\w-]+/);
}

export async function reviewHighRiskClaims(page: Page) {
  const highRiskClaims = page.locator('[data-risk="high"]:not([data-reviewed="true"])');
  const count = await highRiskClaims.count();

  for (let i = 0; i < count; i++) {
    await highRiskClaims.nth(i).click();
    await page.click('[data-testid="claim-approve-btn"]');
    await page.waitForTimeout(500); // 애니메이션 대기
  }

  return count;
}
```

### 5.2.3 메인 테스트 파일

```typescript
// __tests__/e2e/validation-flow.spec.ts

import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  selectChatbot,
} from './helpers/auth';
import {
  uploadDocument,
  navigateToValidation,
  openValidationSession,
  reviewHighRiskClaims,
} from './helpers/validation';

test.describe('Human-in-the-loop 검증 시스템', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await selectChatbot(page, 'Test Chatbot');
  });

  test('시나리오 1: 기본 검증 플로우', async ({ page }) => {
    // 1. 문서 업로드
    await page.goto('/console/chatbot/blog');
    await uploadDocument(page, '__tests__/fixtures/sample.pdf');

    // 2. 검증 페이지로 이동
    await navigateToValidation(page);
    await expect(page.locator('[data-testid="validation-session-card"]')).toBeVisible();

    // 3. 세션 열기
    await openValidationSession(page);

    // 4. Dual Viewer 확인
    await expect(page.locator('text=원본 문서')).toBeVisible();
    await expect(page.locator('text=재구성 결과')).toBeVisible();
    await expect(page.locator('text=검증 항목')).toBeVisible();

    // 5. 고위험 항목 검토
    const reviewedCount = await reviewHighRiskClaims(page);
    console.log(`Reviewed ${reviewedCount} high-risk claims`);

    // 6. 승인
    await page.click('[data-testid="approve-btn"]');
    await expect(page.locator('text=페이지가 생성되었습니다')).toBeVisible();

    // 7. 결과 확인
    await page.goto('/console/chatbot/blog');
    await expect(page.locator('[data-testid="page-tree"]')).toContainText('sample');
  });

  test('시나리오 2: 고위험 항목 미검토 시 승인 차단', async ({ page }) => {
    // 사전 조건: 고위험 항목이 있는 세션
    await navigateToValidation(page);
    await openValidationSession(page);

    // 고위험 항목 미검토 상태 확인
    const highRiskUnreviewed = await page.locator('[data-risk="high"]:not([data-reviewed="true"])').count();
    expect(highRiskUnreviewed).toBeGreaterThan(0);

    // 승인 시도
    await page.click('[data-testid="approve-btn"]');

    // 차단 확인
    await expect(page.locator('text=고위험 항목을 먼저 검토하세요')).toBeVisible();

    // 다이얼로그가 열리지 않음 확인
    await expect(page.locator('[data-testid="approval-dialog"]')).not.toBeVisible();
  });

  test('시나리오 3: 마크다운 수정 후 승인', async ({ page }) => {
    await navigateToValidation(page);
    await openValidationSession(page);

    // 재구성 마크다운 수정
    const editor = page.locator('[data-testid="reconstructed-editor"]');
    const originalContent = await editor.inputValue();
    const modifiedContent = originalContent + '\n\n## 추가된 섹션\n\n테스트 내용입니다.';

    await editor.fill(modifiedContent);

    // 저장
    await page.click('[data-testid="save-markdown-btn"]');
    await expect(page.locator('text=저장되었습니다')).toBeVisible();

    // 고위험 항목 검토
    await reviewHighRiskClaims(page);

    // 승인
    await page.click('[data-testid="approve-btn"]');
    await expect(page.locator('text=페이지가 생성되었습니다')).toBeVisible();

    // 수정 내용 반영 확인
    await page.goto('/console/chatbot/blog');
    await page.click('text=sample');
    await expect(page.locator('text=추가된 섹션')).toBeVisible();
  });

  test('시나리오 4: 검증 거부 플로우', async ({ page }) => {
    await navigateToValidation(page);
    await openValidationSession(page);

    // 거부 버튼 클릭
    await page.click('[data-testid="reject-btn"]');

    // 사유 입력
    await page.fill('[data-testid="reject-reason-input"]', '내용이 부정확합니다');
    await page.click('[data-testid="confirm-reject-btn"]');

    // 결과 확인
    await expect(page.locator('text=검증이 거부되었습니다')).toBeVisible();

    // 목록에서 제외 확인
    await page.waitForURL(/\/validation$/);
    await expect(page.locator('[data-testid="validation-session-card"]')).not.toBeVisible();
  });

  test('시나리오 5: PDF 렌더링 및 하이라이트', async ({ page }) => {
    // PDF가 있는 세션
    await navigateToValidation(page);
    await openValidationSession(page);

    // PDF 뷰어 확인
    const pdfViewer = page.locator('[data-testid="pdf-viewer"]');
    await expect(pdfViewer).toBeVisible();

    // 페이지 네비게이션
    await page.click('[data-testid="pdf-next-page"]');
    await expect(page.locator('text=2 /')).toBeVisible();

    // Claim 선택 시 하이라이트
    await page.click('[data-testid="claim-item"]:first-child');
    await expect(page.locator('[data-testid="source-highlight"]')).toBeVisible();
  });

  test('시나리오 6: 스크롤 동기화', async ({ page }) => {
    await navigateToValidation(page);
    await openValidationSession(page);

    // 동기화 활성화
    await page.click('[data-testid="scroll-sync-toggle"]');

    // 원본 스크롤
    const originalViewer = page.locator('[data-testid="original-viewer"]');
    await originalViewer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });

    // 재구성 뷰어 스크롤 위치 확인
    await page.waitForTimeout(200); // 동기화 딜레이
    const reconstructedViewer = page.locator('[data-testid="reconstructed-viewer"]');
    const scrollTop = await reconstructedViewer.evaluate((el) => el.scrollTop);

    expect(scrollTop).toBeGreaterThan(0);
  });

  test('시나리오 7: 민감정보 마스킹', async ({ page }) => {
    await navigateToValidation(page);
    await openValidationSession(page);

    // 마스킹된 전화번호 확인
    await expect(page.locator('text=/010-\\*{4}-\\d{4}/')).toBeVisible();

    // 마스킹 해제 버튼 클릭 (권한 있는 경우)
    const unmaskBtn = page.locator('[data-testid="unmask-btn"]');
    if (await unmaskBtn.isVisible()) {
      await unmaskBtn.click();
      await expect(page.locator('text=/010-\\d{4}-\\d{4}/')).toBeVisible();
    }
  });
});
```

### 5.2.4 필터 및 검색 테스트

```typescript
// __tests__/e2e/validation-filters.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsTestUser, selectChatbot } from './helpers/auth';
import { navigateToValidation, openValidationSession } from './helpers/validation';

test.describe('Claim 필터링 및 검색', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await selectChatbot(page, 'Test Chatbot');
    await navigateToValidation(page);
    await openValidationSession(page);
  });

  test('필터: 고위험 항목만 보기', async ({ page }) => {
    await page.click('[data-testid="filter-high_risk"]');

    const claims = page.locator('[data-testid="claim-item"]');
    const count = await claims.count();

    for (let i = 0; i < count; i++) {
      const riskLevel = await claims.nth(i).getAttribute('data-risk');
      expect(riskLevel).toBe('high');
    }
  });

  test('필터: CONTRADICTED만 보기', async ({ page }) => {
    await page.click('[data-testid="filter-contradicted"]');

    const claims = page.locator('[data-testid="claim-item"]');
    const count = await claims.count();

    for (let i = 0; i < count; i++) {
      const verdict = await claims.nth(i).getAttribute('data-verdict');
      expect(verdict).toBe('contradicted');
    }
  });

  test('필터: 미검토 항목만 보기', async ({ page }) => {
    await page.click('[data-testid="filter-pending"]');

    const claims = page.locator('[data-testid="claim-item"]');
    const count = await claims.count();

    for (let i = 0; i < count; i++) {
      const reviewed = await claims.nth(i).getAttribute('data-reviewed');
      expect(reviewed).not.toBe('true');
    }
  });

  test('필터 초기화', async ({ page }) => {
    await page.click('[data-testid="filter-high_risk"]');
    const filteredCount = await page.locator('[data-testid="claim-item"]').count();

    await page.click('[data-testid="filter-all"]');
    const allCount = await page.locator('[data-testid="claim-item"]').count();

    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });
});
```

---

## 5.3 성능 테스트

### 5.3.1 대용량 문서 처리

```typescript
// __tests__/e2e/performance.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsTestUser, selectChatbot } from './helpers/auth';
import { uploadDocument, navigateToValidation } from './helpers/validation';

test.describe('성능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await selectChatbot(page, 'Performance Test Chatbot');
  });

  test('100페이지 PDF 처리 시간 < 2분', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/console/chatbot/blog');
    await uploadDocument(page, '__tests__/fixtures/large-100-pages.pdf');

    // 검증 준비 완료 대기 (최대 2분)
    await navigateToValidation(page);
    await expect(
      page.locator('[data-testid="validation-session-card"][data-status="ready_for_review"]')
    ).toBeVisible({ timeout: 120000 });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(120000); // 2분 이내

    console.log(`100페이지 PDF 처리 시간: ${Math.round(duration / 1000)}초`);
  });

  test('500개 Claim 검증 시간 < 5분', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/console/chatbot/blog');
    await uploadDocument(page, '__tests__/fixtures/claims-heavy-document.pdf');

    await navigateToValidation(page);
    await expect(
      page.locator('[data-testid="validation-session-card"][data-status="ready_for_review"]')
    ).toBeVisible({ timeout: 300000 });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(300000); // 5분 이내

    // Claim 개수 확인
    await page.click('[data-testid="validation-session-card"]');
    const claimCount = await page.locator('[data-testid="claim-item"]').count();
    console.log(`${claimCount}개 Claim 검증 시간: ${Math.round(duration / 1000)}초`);
  });

  test('Dual Viewer 스크롤 성능 (60fps)', async ({ page }) => {
    await navigateToValidation(page);
    await page.click('[data-testid="validation-session-card"]');
    await page.waitForURL(/\/validation\/[\w-]+/);

    // FPS 측정
    const fps = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        const originalViewer = document.querySelector('[data-testid="original-viewer"]');
        if (!originalViewer) {
          resolve(0);
          return;
        }

        // 스크롤 애니메이션 시작
        let scrollPos = 0;
        const animate = () => {
          scrollPos += 10;
          originalViewer.scrollTop = scrollPos;
          frameCount++;

          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(animate);
          } else {
            resolve(frameCount);
          }
        };

        requestAnimationFrame(animate);
      });
    });

    console.log(`Dual Viewer FPS: ${fps}`);
    expect(fps).toBeGreaterThan(55); // 55fps 이상
  });

  test('메모리 사용량 모니터링', async ({ page }) => {
    await navigateToValidation(page);
    await page.click('[data-testid="validation-session-card"]');

    // 초기 메모리
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // 여러 Claim 선택/해제 반복
    for (let i = 0; i < 50; i++) {
      await page.click(`[data-testid="claim-item"]:nth-child(${(i % 10) + 1})`);
      await page.waitForTimeout(100);
    }

    // 최종 메모리
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    console.log(`메모리 증가: ${memoryIncrease.toFixed(2)}MB`);

    // 메모리 누수 체크 (100MB 이내)
    expect(memoryIncrease).toBeLessThan(100);
  });
});
```

### 5.3.2 API 응답 시간 테스트

```typescript
// __tests__/api/validation-api.spec.ts

import { describe, test, expect } from 'vitest';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Validation API 성능', () => {
  test('GET /api/validation/sessions - 목록 조회 < 500ms', async () => {
    const start = Date.now();

    const response = await fetch(`${API_BASE}/api/validation/sessions?chatbotId=test`);
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(500);
  });

  test('GET /api/validation/sessions/:id - 상세 조회 < 1000ms', async () => {
    const start = Date.now();

    const response = await fetch(`${API_BASE}/api/validation/sessions/test-session-id`);
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(1000);
  });

  test('POST /api/validation/claims/:id/verdict - Claim 검토 < 300ms', async () => {
    const start = Date.now();

    const response = await fetch(`${API_BASE}/api/validation/claims/test-claim-id/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict: 'approved' }),
    });
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(300);
  });
});
```

---

## 5.4 엣지 케이스 처리

### 5.4.1 엣지 케이스 목록

| 케이스 | 상황 | 예상 동작 | 처리 방법 |
|--------|------|----------|----------|
| 빈 문서 | 내용이 없는 PDF/텍스트 업로드 | 에러 표시 | 업로드 단계에서 검증 + 세션 생성 안 함 |
| 이미지만 있는 PDF | 텍스트 레이어 없는 PDF | OCR 미지원 안내 | 텍스트 추출 실패 시 안내 메시지 |
| 대용량 문서 | 1000페이지+ PDF | 청킹 후 배치 처리 | 진행률 표시 + 부분 실패 허용 |
| 네트워크 오류 | 저장/승인 중 연결 끊김 | 재시도 옵션 제공 | 오프라인 큐 + 재연결 시 동기화 |
| 동시 검토 | 두 사용자가 같은 세션 검토 | 충돌 알림 | 낙관적 잠금 + 마지막 업데이트 우선 |
| 세션 만료 중 검토 | 7일 직전에 검토 시작 | 검토 완료까지 연장 | 활성 세션 만료 연장 |
| Claim 0개 | 추출된 Claim이 없음 | 즉시 승인 가능 | 경고 메시지 + 수동 확인 유도 |
| 특수문자 포함 | 이모지, 특수기호 등 | 정상 처리 | 유니코드 정규화 |

### 5.4.2 엣지 케이스 테스트

```typescript
// __tests__/e2e/edge-cases.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsTestUser, selectChatbot } from './helpers/auth';

test.describe('엣지 케이스 처리', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await selectChatbot(page, 'Test Chatbot');
  });

  test('빈 문서 업로드 시 에러 표시', async ({ page }) => {
    await page.goto('/console/chatbot/blog');
    await page.click('text=문서 가져오기');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('__tests__/fixtures/empty.pdf');

    await page.click('text=업로드');

    // 에러 메시지 확인
    await expect(page.locator('text=문서에 추출 가능한 텍스트가 없습니다')).toBeVisible();
  });

  test('이미지만 있는 PDF 처리', async ({ page }) => {
    await page.goto('/console/chatbot/blog');
    await page.click('text=문서 가져오기');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('__tests__/fixtures/image-only.pdf');

    await page.click('text=업로드');

    // OCR 미지원 안내
    await expect(page.locator('text=텍스트 추출 실패')).toBeVisible();
    await expect(page.locator('text=이미지로만 구성된 PDF')).toBeVisible();
  });

  test('네트워크 오류 시 재시도', async ({ page, context }) => {
    await page.goto('/console/chatbot/blog/validation');
    await page.click('[data-testid="validation-session-card"]');
    await page.waitForURL(/\/validation\/[\w-]+/);

    // 네트워크 오프라인
    await context.setOffline(true);

    // 저장 시도
    await page.click('[data-testid="save-markdown-btn"]');

    // 오류 메시지 및 재시도 버튼
    await expect(page.locator('text=네트워크 연결을 확인하세요')).toBeVisible();
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();

    // 네트워크 복구
    await context.setOffline(false);

    // 재시도
    await page.click('[data-testid="retry-btn"]');
    await expect(page.locator('text=저장되었습니다')).toBeVisible();
  });

  test('Claim 0개인 경우 경고 표시', async ({ page }) => {
    // Claim이 없는 세션으로 이동 (fixture 필요)
    await page.goto('/console/chatbot/blog/validation/no-claims-session-id');

    // 경고 메시지
    await expect(page.locator('text=추출된 검증 항목이 없습니다')).toBeVisible();
    await expect(page.locator('text=문서 내용을 직접 확인하세요')).toBeVisible();

    // 승인 버튼은 활성화되어 있어야 함
    const approveBtn = page.locator('[data-testid="approve-btn"]');
    await expect(approveBtn).toBeEnabled();
  });

  test('특수문자 및 이모지 처리', async ({ page }) => {
    await page.goto('/console/chatbot/blog/validation');
    await page.click('[data-testid="validation-session-card"]');

    // 특수문자가 포함된 Claim 확인
    const claimWithEmoji = page.locator('text=/.*🎉.*/');
    await expect(claimWithEmoji).toBeVisible();

    // 클릭 및 하이라이트 정상 동작
    await claimWithEmoji.click();
    await expect(page.locator('[data-testid="source-highlight"]')).toBeVisible();
  });

  test('세션 만료 경고', async ({ page }) => {
    // 만료 임박 세션 (fixture로 expires_at이 1일 이내인 세션)
    await page.goto('/console/chatbot/blog/validation/expiring-soon-session-id');

    // 만료 경고 배너
    await expect(page.locator('text=이 세션은 1일 후 만료됩니다')).toBeVisible();
  });
});
```

---

## 5.5 접근성 테스트

```typescript
// __tests__/e2e/accessibility.spec.ts

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsTestUser, selectChatbot } from './helpers/auth';

test.describe('접근성 (a11y) 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await selectChatbot(page, 'Test Chatbot');
  });

  test('검증 목록 페이지 접근성', async ({ page }) => {
    await page.goto('/console/chatbot/blog/validation');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Dual Viewer 페이지 접근성', async ({ page }) => {
    await page.goto('/console/chatbot/blog/validation');
    await page.click('[data-testid="validation-session-card"]');
    await page.waitForURL(/\/validation\/[\w-]+/);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('키보드 네비게이션', async ({ page }) => {
    await page.goto('/console/chatbot/blog/validation');
    await page.click('[data-testid="validation-session-card"]');
    await page.waitForURL(/\/validation\/[\w-]+/);

    // Tab으로 Claim 이동
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Enter로 Claim 선택
    await page.keyboard.press('Enter');

    // 선택된 Claim 확인
    const selectedClaim = page.locator('[data-testid="claim-item"][data-selected="true"]');
    await expect(selectedClaim).toBeVisible();

    // 방향키로 이동
    await page.keyboard.press('ArrowDown');
    const newSelectedClaim = page.locator('[data-testid="claim-item"][data-selected="true"]');
    await expect(newSelectedClaim).not.toEqual(selectedClaim);
  });

  test('스크린 리더 지원', async ({ page }) => {
    await page.goto('/console/chatbot/blog/validation');
    await page.click('[data-testid="validation-session-card"]');

    // ARIA 레이블 확인
    const originalViewer = page.locator('[data-testid="original-viewer"]');
    await expect(originalViewer).toHaveAttribute('aria-label', '원본 문서');

    const reconstructedViewer = page.locator('[data-testid="reconstructed-viewer"]');
    await expect(reconstructedViewer).toHaveAttribute('aria-label', '재구성된 문서');

    const claimPanel = page.locator('[data-testid="claim-panel"]');
    await expect(claimPanel).toHaveAttribute('aria-label', '검증 항목 목록');

    // 상태 변경 알림
    await page.click('[data-testid="claim-approve-btn"]');
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText('확인 처리되었습니다');
  });
});
```

---

## 5.6 테스트 데이터 관리

### 5.6.1 Fixture 파일

```
__tests__/fixtures/
├── sample.pdf                    # 기본 테스트 문서 (10페이지)
├── large-100-pages.pdf           # 성능 테스트용 대용량
├── claims-heavy-document.pdf     # Claim 많은 문서 (500+)
├── empty.pdf                     # 빈 문서
├── image-only.pdf                # 이미지만 있는 PDF
├── special-characters.pdf        # 특수문자/이모지 포함
└── sensitive-info.pdf            # 민감정보 포함 (전화번호, 이메일 등)
```

### 5.6.2 시드 데이터

```typescript
// __tests__/seed/validation-sessions.ts

import { db } from '@/lib/db';
import { validationSessions, claims, sourceSpans } from '@/drizzle/schema';

export async function seedValidationTestData() {
  // 테스트용 검증 세션 생성
  const [session] = await db
    .insert(validationSessions)
    .values({
      tenantId: 'test-tenant',
      chatbotId: 'test-chatbot',
      documentId: 'test-document',
      originalText: 'Original document content...',
      reconstructedMarkdown: '# Reconstructed\n\nContent...',
      status: 'ready_for_review',
      totalClaims: 10,
      highRiskCount: 2,
      riskScore: 0.3,
    })
    .returning();

  // 테스트용 Claim 생성
  const claimData = [
    { text: '연락처: 010-1234-5678', type: 'contact', verdict: 'supported', riskLevel: 'high' },
    { text: '금액: 1,000,000원', type: 'numeric', verdict: 'contradicted', riskLevel: 'high' },
    { text: '날짜: 2024-01-15', type: 'date', verdict: 'supported', riskLevel: 'medium' },
    // ... 더 많은 Claim
  ];

  for (const claim of claimData) {
    await db.insert(claims).values({
      sessionId: session.id,
      claimText: claim.text,
      claimType: claim.type,
      verdict: claim.verdict,
      riskLevel: claim.riskLevel,
    });
  }

  return session;
}

export async function cleanupValidationTestData() {
  await db.delete(validationSessions).where(eq(validationSessions.tenantId, 'test-tenant'));
}
```

---

## 5.7 CI/CD 통합

### 5.7.1 GitHub Actions 워크플로우

```yaml
# .github/workflows/e2e-tests.yml

name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: sofa_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Setup database
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/sofa_test

      - name: Seed test data
        run: pnpm test:seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/sofa_test

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/sofa_test
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          TEST_USER_EMAIL: test@example.com
          TEST_USER_PASSWORD: testpassword

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-screenshots
          path: test-results/
          retention-days: 7
```

### 5.7.2 테스트 스크립트

```json
// package.json

{
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:seed": "tsx __tests__/seed/run.ts",
    "test:perf": "playwright test --grep @performance",
    "test:a11y": "playwright test --grep @accessibility"
  }
}
```

---

## 5.8 체크리스트

### 기능 테스트

- [ ] 시나리오 1: 기본 검증 플로우 통과
- [ ] 시나리오 2: 고위험 항목 필수 검토 통과
- [ ] 시나리오 3: 마크다운 수정 후 승인 통과
- [ ] 시나리오 4: 검증 거부 플로우 통과
- [ ] 시나리오 5: PDF 렌더링 및 하이라이트 통과
- [ ] 시나리오 6: 스크롤 동기화 통과
- [ ] 시나리오 7: 민감정보 마스킹 통과
- [ ] 시나리오 8: 세션 만료 처리 통과

### 성능 테스트

- [ ] 100페이지 PDF 처리 < 2분
- [ ] 500개 Claim 검증 < 5분
- [ ] Dual Viewer 스크롤 60fps 이상
- [ ] API 응답 시간 기준 충족
- [ ] 메모리 누수 없음

### 엣지 케이스

- [ ] 빈 문서 처리
- [ ] 이미지 전용 PDF 처리
- [ ] 네트워크 오류 복구
- [ ] 동시 접근 충돌 처리
- [ ] 세션 만료 처리
- [ ] Claim 0개 처리
- [ ] 특수문자/이모지 처리

### 접근성

- [ ] axe-core 위반 사항 0개
- [ ] 키보드 네비게이션 동작
- [ ] ARIA 레이블 적용
- [ ] 스크린 리더 지원

### CI/CD

- [ ] GitHub Actions 워크플로우 설정
- [ ] 테스트 데이터 시드 스크립트
- [ ] 테스트 리포트 아티팩트 저장

---

## 5.9 릴리스 준비

### 5.9.1 최종 검증 체크리스트

- [ ] 모든 E2E 테스트 통과
- [ ] 성능 벤치마크 충족
- [ ] 보안 취약점 스캔 완료
- [ ] 문서 최신화 확인
- [ ] 환경 변수 설정 가이드 작성
- [ ] 롤백 계획 수립

### 5.9.2 모니터링 설정

배포 후 모니터링해야 할 지표:

| 지표 | 임계값 | 알림 |
|------|--------|------|
| 검증 세션 생성 실패율 | > 5% | Slack |
| Claim 추출 시간 | > 1분 | PagerDuty |
| 승인 후 페이지 생성 실패 | > 1% | PagerDuty |
| API 응답 시간 (p99) | > 2초 | Slack |
| 에러 로그 빈도 | > 10/분 | PagerDuty |

### 5.9.3 점진적 롤아웃

1. **내부 테스트**: 개발팀 + QA 팀 (1일)
2. **베타 사용자**: 선별된 고객사 (3일)
3. **전체 배포**: 모든 사용자

---

*문서 작성일: 2026-01-11*
*상태: 구현 대기*
