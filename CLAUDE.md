# SOFA 프로젝트 개발 지침

## 프로젝트 개요
SOFA(Smart Operator's FAQ Assistant)는 RAG 기반 챗봇 플랫폼입니다.

## 기술 스택
- **프레임워크**: Next.js 15 (App Router)
- **스타일링**: Tailwind CSS v4 + OKLCH 컬러 시스템
- **UI 컴포넌트**: shadcn/ui (Radix UI 기반)
- **테마**: next-themes (다크/라이트 모드)
- **데이터베이스**: PostgreSQL + Prisma

---

## 다크모드 개발 가이드라인

### 테마 시스템 개요
SOFA는 다크모드를 기본으로 하며, 라이트모드도 지원합니다. 모든 컴포넌트는 반드시 두 테마 모두에서 정상 작동해야 합니다.

### 시맨틱 컬러 토큰 (필수 사용)

#### 배경 및 카드
| 토큰 | 용도 |
|------|------|
| `bg-background` | 페이지 기본 배경 |
| `bg-card` | 카드, 모달, 드롭다운 배경 |
| `bg-muted` | 비활성/뮤트 배경, 테이블 헤더 |
| `bg-muted/50` | 반투명 뮤트 배경 |

#### 텍스트
| 토큰 | 용도 |
|------|------|
| `text-foreground` | 기본 텍스트 (제목, 본문) |
| `text-muted-foreground` | 보조 텍스트 (설명, 라벨) |

#### 테두리
| 토큰 | 용도 |
|------|------|
| `border-border` | 기본 테두리 |

#### 프라이머리 (브랜드 컬러)
| 토큰 | 용도 |
|------|------|
| `bg-primary` | 주요 버튼 배경 |
| `text-primary` | 강조 텍스트, 링크 |
| `text-primary-foreground` | 주요 버튼 텍스트 |
| `bg-primary/10` | 반투명 프라이머리 배경 (배지, 선택 상태) |

#### 상태 컬러
| 토큰 | 용도 |
|------|------|
| `bg-destructive` / `text-destructive` | 오류, 거부, 삭제 |
| `bg-destructive/10` | 반투명 오류 배경 |
| `bg-green-500` / `text-green-500` | 성공, 승인 |
| `bg-green-500/10` | 반투명 성공 배경 |
| `bg-yellow-500/10 text-yellow-500` | 경고, 대기 |
| `bg-purple-500/10 text-purple-500` | AI 관련, 특수 기능 |

### 사용 금지 패턴

다음 하드코딩된 색상은 **절대 사용하지 마세요**:

```tsx
// 금지
className="bg-white"           // -> bg-card 또는 bg-background
className="bg-gray-50"         // -> bg-muted
className="text-gray-900"      // -> text-foreground
className="text-gray-600"      // -> text-muted-foreground
className="border-gray-200"    // -> border-border
className="bg-blue-600"        // -> bg-primary
className="text-blue-600"      // -> text-primary
className="bg-red-600"         // -> bg-destructive
className="text-red-600"       // -> text-destructive
```

### 권장 컴포넌트 패턴

#### 카드
```tsx
<div className="rounded-lg border border-border bg-card p-6">
  <h2 className="text-lg font-semibold text-foreground">제목</h2>
  <p className="text-muted-foreground">설명</p>
</div>
```

#### 버튼
```tsx
// 프라이머리 버튼
<button className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
  확인
</button>

// 세컨더리 버튼
<button className="rounded-md border border-border px-4 py-2 text-foreground hover:bg-muted">
  취소
</button>

// 위험 버튼
<button className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90">
  삭제
</button>
```

#### 상태 배지
```tsx
const statusConfig = {
  pending: 'bg-muted text-muted-foreground',
  approved: 'bg-green-500/10 text-green-500',
  rejected: 'bg-destructive/10 text-destructive',
  processing: 'bg-primary/10 text-primary',
};
```

#### 입력 필드
```tsx
<input
  className="rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
/>
```

#### 테이블
```tsx
<table className="min-w-full divide-y divide-border">
  <thead className="bg-muted">
    <tr>
      <th className="text-muted-foreground">컬럼</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-border bg-card">
    <tr className="hover:bg-muted">
      <td className="text-foreground">값</td>
    </tr>
  </tbody>
</table>
```

#### 로딩 스피너
```tsx
<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
```

### 체크리스트

새 컴포넌트 개발 시 확인 사항:
- [ ] `bg-white`, `bg-gray-*` 대신 `bg-card`, `bg-muted` 사용
- [ ] `text-gray-*` 대신 `text-foreground`, `text-muted-foreground` 사용
- [ ] `border-gray-*` 대신 `border-border` 사용
- [ ] 상태 색상에 opacity 사용 (예: `bg-green-500/10`)
- [ ] 다크모드에서 시각적 확인 완료

---

## shadcn/ui 컴포넌트 가이드라인

### 기본 원칙
- **모든 UI 컴포넌트는 shadcn/ui 패턴을 따름**
- Radix UI 프리미티브 위에 Tailwind CSS 스타일 적용
- 접근성(a11y), 키보드 네비게이션, 포커스 관리 내장
- 다크/라이트 모드 자동 지원

### 컴포넌트 구현 방식
```
Radix UI Primitive → shadcn/ui 스타일 래퍼 → 프로젝트 컴포넌트
```

### 현재 구현된 shadcn/ui 컴포넌트
| 컴포넌트 | 위치 | 설명 |
|---------|------|------|
| AlertDialog | `components/ui/alert-dialog.tsx` | 확인 다이얼로그 (confirm 대체) |
| Dialog | `components/ui/dialog.tsx` | 범용 모달 |
| Toast | `components/ui/toast.tsx` | 알림 토스트 |

### 새 컴포넌트 추가 시
1. Radix UI 패키지 설치: `pnpm add @radix-ui/react-{component}`
2. `components/ui/{component}.tsx` 생성
3. `cn()` 유틸리티로 클래스 병합
4. 시맨틱 컬러 토큰 사용

### 금지 패턴
```tsx
// 금지: 브라우저 네이티브 API
confirm('삭제하시겠습니까?')  // -> useAlertDialog 훅 사용
alert('오류가 발생했습니다')   // -> Toast 사용
prompt('이름을 입력하세요')    // -> Dialog + Input 사용
```

### useAlertDialog 훅 사용 예시
```tsx
import { useAlertDialog } from '@/components/ui/alert-dialog';

function MyComponent() {
  const { confirm } = useAlertDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: '문서 삭제',
      message: '이 문서를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (confirmed) {
      // 삭제 로직
    }
  };
}
```

---

## Console UI/UX 디자인 시스템

### 폰트
- **Pretendard Variable**: 한글 최적화 가변 폰트
- 제목: `font-semibold`, `leading-snug` (1.375), `tracking-tight`
- 본문: `font-normal`, `leading-relaxed` (1.625)
- 한글: `word-break: keep-all`

### 카드 컴포넌트 시스템

**Card 컴포넌트** (`components/ui/card.tsx`)는 `cva`를 사용한 variants 시스템 적용:

| Size | Border Radius | Padding | 용도 |
|------|---------------|---------|------|
| `sm` | `rounded-lg` (8px) | `p-4` (16px) | 리스트 아이템, 작은 카드 |
| `md` | `rounded-xl` (12px) | `p-6` (24px) | 기본 카드 (default) |
| `lg` | `rounded-2xl` (16px) | `p-8` (32px) | 대형 카드, 빈 상태 |

```tsx
// 사용 예시
<Card size="md" variant="default">
  <CardHeader>
    <CardTitle>제목</CardTitle>
    <CardDescription>설명</CardDescription>
  </CardHeader>
  <CardContent>내용</CardContent>
</Card>
```

### 간격 시스템

| 용도 | 값 | Tailwind |
|------|-----|----------|
| 카드 간격 | 24px | `gap-6` |
| 섹션 간격 | 32px | `gap-8` |
| 리스트 아이템 간격 | 16px | `gap-4` |
| 폼 필드 간격 | 16px | `space-y-4` |

### 2-레벨 네비게이션 구조

Console은 다음과 같은 레이아웃 구조를 사용:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [🛋️ SOFA] | [🤖 챗봇명 ▾]       저장됨          [⌘K] [👁] [🚀 발행] │ ← TopBar (56px)
├─────────┬───────────┬───────────────────────────────────────────────┤
│ 🏠 홈   │ 서브메뉴  │                                               │
│─────────│           │                                               │
│ 📚 지식 │           │             메인 콘텐츠 영역                   │
│─────────│           │                                               │
│ 🎨 디자인│           │                                               │
│─────────│           │                                               │
│ ⚙️ 설정 │           │                                               │
└─────────┴───────────┴───────────────────────────────────────────────┘
   80px      240px                      나머지
```

- **TopBar**: 로고 + 프로젝트 선택기 + 저장 상태 + 액션 버튼 (Vercel 스타일)
- **Primary Nav**: 80px 고정폭, 아이콘 + 짧은 라벨 수직 배치
- **Secondary Panel**: 240px, 1차 메뉴에 따른 서브메뉴 표시

### 프로젝트 스위처 패턴 (Vercel/GitHub 스타일)

프로젝트(챗봇)가 모든 메뉴의 컨텍스트일 때, 선택기는 항상 보이는 TopBar에 배치:

```tsx
<header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
  {/* 좌측: 로고 + 프로젝트 선택기 */}
  <div className="flex items-center gap-4">
    <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
      <Sofa className="h-5 w-5" />
      <span>SOFA</span>
    </Link>
    <div className="h-6 w-px bg-border" />  {/* 구분선 */}
    <ProjectSwitcher />
  </div>

  {/* 중앙: 상태 */}
  <div className="absolute left-1/2 -translate-x-1/2">
    <SaveStatus />
  </div>

  {/* 우측: 액션 */}
  <div className="flex items-center gap-2">
    <Button>발행</Button>
  </div>
</header>
```

### 설정 페이지 카드 블록 패턴

기능 단위로 카드를 그룹핑하여 Progressive Disclosure 구현:

```tsx
<div className="space-y-6">
  {/* 기본 정보 */}
  <Card size="md">
    <CardHeader>
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-muted-foreground" />
        <CardTitle>기본 정보</CardTitle>
      </div>
      <CardDescription>챗봇의 이름과 설명을 설정합니다</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* 폼 필드들 */}
    </CardContent>
  </Card>

  {/* 위험 영역 */}
  <Card size="md" variant="ghost" className="border-destructive/30">
    <CardHeader>
      <CardTitle className="text-destructive">위험 영역</CardTitle>
    </CardHeader>
    <CardContent>...</CardContent>
  </Card>
</div>
```

---

## 기타 개발 지침

### 커밋 컨벤션
- `feat:` 새로운 기능
- `fix:` 버그 수정
- `refactor:` 리팩토링
- `style:` UI/스타일 변경
- `docs:` 문서 수정
- `chore:` 빌드/설정 변경

### 코드 스타일
- TypeScript 엄격 모드 사용
- ESLint + Prettier 규칙 준수
- 컴포넌트는 함수형으로 작성
- 서버 컴포넌트 우선, 필요시에만 'use client' 사용
