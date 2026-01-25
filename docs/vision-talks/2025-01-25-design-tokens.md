# faq.guide 디자인 토큰

**날짜**: 2025년 1월 25일
**상태**: 확정

---

## 1. 컬러 시스템

### 브랜드 컬러

faq.guide의 브랜드 철학: **"복잡한 기계가 아닌 장난감"**

| 역할 | 이름 | HEX | OKLCH | 용도 |
|------|------|-----|-------|------|
| **Brand** | Coral | `#FF6B4A` | `oklch(0.68 0.19 28)` | 로고 강조점(.), CTA |
| **Brand Light** | Coral Light | `#FFF0ED` | `oklch(0.97 0.02 25)` | 브랜드 배경 |

### 시맨틱 컬러

| 역할 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| **Primary** | Black `#1A1A1A` | White `#ECECEC` | 주요 액션, 텍스트 |
| **Background** | Off-white `#FCFCFC` | Deep `#090909` | 기본 배경 |
| **Surface** | White `#FFFFFF` | Card `#171717` | 카드, 패널 |
| **Border** | `#E5E5E5` | `#282828` | 테두리, 구분선 |
| **Muted** | `#6B6B6B` | `#808080` | 보조 텍스트 |

### 상태 컬러

| 상태 | HEX | OKLCH | 용도 |
|------|-----|-------|------|
| **Success** | `#22C55E` | `oklch(0.72 0.19 145)` | 완료, 성공 |
| **Warning** | `#F59E0B` | `oklch(0.77 0.16 75)` | 주의, 안내 |
| **Error** | `#EF4444` | `oklch(0.63 0.21 25)` | 오류, 삭제 |
| **Info** | `#3B82F6` | `oklch(0.62 0.19 260)` | 정보, 링크 |

### 차트 컬러 (모노크롬 + 브랜드)

```
차트 1 (강조): #FF6B4A (브랜드 코랄)
차트 2: #1A1A1A / #ECECEC (기본)
차트 3: #4B4B4B / #B0B0B0
차트 4: #808080 / #808080
차트 5: #B0B0B0 / #4B4B4B
```

---

## 2. 타이포그래피

### 폰트 패밀리

```css
--font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

**선택 이유**:
- 문서를 다루는 서비스로 장시간 가독성 필수
- 한글/영문 균형이 좋음
- Variable 폰트로 다양한 웨이트 지원

### 크기 스케일

| 토큰 | 크기 | 줄높이 | 용도 |
|------|------|--------|------|
| `--text-display` | 48px | 1.2 | 랜딩 히어로 |
| `--text-h1` | 32px | 1.3 | 페이지 제목 |
| `--text-h2` | 24px | 1.4 | 섹션 제목 |
| `--text-h3` | 20px | 1.4 | 카드 제목 |
| `--text-body` | 16px | 1.75 | 본문 (한글 최적화) |
| `--text-sm` | 14px | 1.6 | 캡션, 라벨 |
| `--text-xs` | 12px | 1.5 | 메타 정보 |

### 폰트 웨이트

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--font-bold` | 700 | 제목, 강조 |
| `--font-semibold` | 600 | 중제목 |
| `--font-medium` | 500 | 버튼, 라벨 |
| `--font-regular` | 400 | 본문 |

### 한글 최적화

```css
/* 한글 타이포그래피 */
--line-height-korean: 1.75;          /* 본문 */
--line-height-korean-heading: 1.4;   /* 제목 */
--letter-spacing-korean: -0.01em;    /* 본문 자간 */
--letter-spacing-korean-tight: -0.02em; /* 제목 자간 */
```

---

## 3. 간격 시스템

### 기본 스케일 (8px 그리드)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--space-0` | 0px | - |
| `--space-1` | 4px | 아이콘-텍스트 간격 |
| `--space-2` | 8px | 관련 요소 간격 |
| `--space-3` | 12px | 인풋 내부 패딩 |
| `--space-4` | 16px | 그룹 내 간격 |
| `--space-5` | 20px | - |
| `--space-6` | 24px | 카드 패딩, 섹션 내 간격 |
| `--space-8` | 32px | 섹션 간 간격 |
| `--space-10` | 40px | - |
| `--space-12` | 48px | 대영역 간격 |
| `--space-16` | 64px | 페이지 패딩 |

### 컴포넌트별 패딩

| 컴포넌트 | 패딩 |
|----------|------|
| 버튼 (sm) | 8px 16px |
| 버튼 (md) | 12px 24px |
| 버튼 (lg) | 16px 32px |
| 카드 | 24px |
| 입력 필드 | 12px 16px |
| 모달 | 32px |

---

## 4. 보더 라디우스

### 스케일

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--radius-sm` | 8px | 입력 필드, 작은 요소 |
| `--radius-md` | 10px | - |
| `--radius-lg` | 12px | **기본값**, 버튼, 카드 |
| `--radius-xl` | 16px | 대형 카드, 모달 |
| `--radius-2xl` | 20px | 특수 컨테이너 |
| `--radius-full` | 9999px | 아바타, 태그, 풀 라운드 버튼 |

### 설계 원칙

- **12px가 기본**: 부드럽지만 과하지 않음
- 중첩 시 내부 요소는 외부보다 4px 작게
- 날카로운 모서리(0px)는 사용하지 않음

---

## 5. 그림자

### 스케일

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

### 사용 원칙

- **그림자는 최소화**: 대부분 flat 디자인
- 호버/포커스 시 미세한 그림자 추가
- 모달, 드롭다운에만 강한 그림자

---

## 6. 애니메이션

### Duration

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--duration-instant` | 75ms | 즉각 피드백 |
| `--duration-fast` | 150ms | **기본값**, 호버, 토글 |
| `--duration-normal` | 200ms | 화면 전환 |
| `--duration-slow` | 300ms | 모달, 사이드바 |
| `--duration-slower` | 500ms | 복잡한 애니메이션 |

### Easing

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);     /* 기본 */
--ease-in: cubic-bezier(0.4, 0, 1, 1);            /* 사라질 때 */
--ease-out: cubic-bezier(0, 0, 0.2, 1);           /* 나타날 때 */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);      /* 양방향 */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* 특수 효과 */
```

### 사용 원칙

- 의미 없는 애니메이션 지양
- 상태 변화를 알려주는 목적으로만 사용
- `prefers-reduced-motion` 존중

---

## 7. 브레이크포인트

| 이름 | 값 | 용도 |
|------|-----|------|
| `--breakpoint-sm` | 640px | 모바일 → 태블릿 |
| `--breakpoint-md` | 768px | - |
| `--breakpoint-lg` | 1024px | 태블릿 → 데스크톱 |
| `--breakpoint-xl` | 1280px | 대형 모니터 |
| `--breakpoint-2xl` | 1536px | 초대형 |

### 레이아웃 전략

```
Mobile (< 640px): 1열, 풀스크린, 하단 네비게이션
Tablet (640-1024px): 적응형, 탭 기반
Desktop (> 1024px): 사이드바 + 콘텐츠
```

---

## 8. Z-Index

| 레이어 | 값 | 용도 |
|--------|-----|------|
| `--z-base` | 0 | 기본 |
| `--z-raised` | 10 | 카드, 호버 요소 |
| `--z-dropdown` | 50 | 드롭다운 메뉴 |
| `--z-sticky` | 100 | 스티키 헤더 |
| `--z-overlay` | 200 | 오버레이 배경 |
| `--z-modal` | 300 | 모달 |
| `--z-popover` | 400 | 팝오버, 툴팁 |
| `--z-toast` | 500 | 토스트 알림 |
| `--z-max` | 9999 | 특수 케이스 |

---

## 9. 접근성

### 명암비

| 용도 | 최소 명암비 | 현재 값 |
|------|-------------|---------|
| 본문 텍스트 | 4.5:1 | ✅ 12.6:1 |
| 대형 텍스트 (18px+) | 3:1 | ✅ 12.6:1 |
| UI 컴포넌트 | 3:1 | ✅ 점검 필요 |

### 포커스 링

```css
--focus-ring: 2px solid var(--ring);
--focus-ring-offset: 2px;
```

### 터치 타겟

- 최소 크기: 44x44px
- 버튼 간 최소 간격: 8px

---

## 10. CSS 변수 정의 (globals.css용)

```css
:root {
  /* Brand */
  --brand: oklch(0.68 0.19 28);          /* #FF6B4A */
  --brand-light: oklch(0.97 0.02 25);    /* #FFF0ED */
  --brand-foreground: oklch(1 0 0);      /* White */

  /* Semantic */
  --success: oklch(0.72 0.19 145);       /* #22C55E */
  --warning: oklch(0.77 0.16 75);        /* #F59E0B */
  --error: oklch(0.63 0.21 25);          /* #EF4444 */
  --info: oklch(0.62 0.19 260);          /* #3B82F6 */

  /* Animation */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 11. 적용 예시

### 버튼 (Primary)

```css
.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  padding: var(--space-3) var(--space-6);  /* 12px 24px */
  border-radius: var(--radius-lg);          /* 12px */
  font-weight: var(--font-medium);          /* 500 */
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-primary:hover {
  opacity: 0.9;
}
```

### 버튼 (Brand CTA)

```css
.btn-brand {
  background: var(--brand);
  color: var(--brand-foreground);
  padding: var(--space-4) var(--space-8);  /* 16px 32px */
  border-radius: var(--radius-lg);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-brand:hover {
  filter: brightness(1.05);
}
```

### 카드

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);          /* 16px */
  padding: var(--space-6);                  /* 24px */
}

.card:hover {
  box-shadow: var(--shadow-md);
}
```

### 입력 필드

```css
.input {
  background: var(--background);
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);          /* 8px */
  padding: var(--space-3) var(--space-4);   /* 12px 16px */
  font-size: var(--text-body);              /* 16px */
  line-height: var(--line-height-korean);
}

.input:focus {
  border-color: var(--ring);
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

---

## 12. 다음 단계

1. [x] 디자인 토큰 정의 (이 문서)
2. [ ] globals.css에 브랜드 컬러 추가
3. [ ] 주요 컴포넌트 업데이트 (Button, Card, Input)
4. [ ] 랜딩 페이지 디자인 적용
5. [ ] Studio 화면 리디자인
