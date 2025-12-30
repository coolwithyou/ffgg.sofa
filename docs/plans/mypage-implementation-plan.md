# SOFA 서비스 기본 기능 구현 계획서

> **문서 버전**: 1.0
> **작성일**: 2024-12-30
> **결정된 정책**: 계정 삭제 시 30일 유예, 2FA는 선택적 제공

---

## 📋 현황 요약

| 카테고리 | 구현 현황 | 비고 |
|----------|----------|------|
| 인증 시스템 | ✅ 완료 | 로그인/회원가입/세션/비밀번호 찾기 |
| 보안 시스템 | ⚠️ 90% | 2FA 로그인 통합 미완, CSRF 토큰 없음 |
| 마이페이지 | ❌ 미구현 | 프로필/비밀번호/구독/탈퇴 |
| 구독 시스템 | ⚠️ 백엔드만 | 사용자 확인 UI 없음 |
| 알림 시스템 | ⚠️ 발송만 | 설정 UI 없음 |

---

# Phase 1: 마이페이지 기본 (필수)

> **목표**: 사용자가 자신의 정보를 확인하고 수정할 수 있는 기본 인프라 구축

## 1.1 마이페이지 라우트 및 레이아웃

### 구현 내용
- [ ] 마이페이지 기본 라우트 생성 (`/mypage`)
- [ ] 탭 네비게이션 레이아웃 (프로필 | 보안 | 구독)
- [ ] 포털 네비게이션에 마이페이지 링크 추가

### 생성 파일
```
app/(portal)/mypage/
├── page.tsx           # 기본 페이지 (프로필로 리다이렉트)
├── layout.tsx         # 탭 네비게이션 레이아웃
└── profile/
    └── page.tsx       # 프로필 탭 (기본)
```

### 수정 파일
```
components/portal-nav.tsx  # 마이페이지 링크 추가
```

### 확인 체크리스트
- [ ] `/mypage` 접속 시 프로필 탭으로 이동
- [ ] 탭 네비게이션 UI 정상 렌더링
- [ ] 다크모드/라이트모드 정상 동작
- [ ] 반응형 레이아웃 확인

---

## 1.2 프로필 정보 조회 및 수정

### 구현 내용
- [ ] 현재 사용자 정보 표시 (이름, 이메일, 역할, 가입일)
- [ ] 이름 수정 폼 및 저장 기능
- [ ] 프로필 수정 API

### 생성 파일
```
app/(portal)/mypage/components/
└── profile-form.tsx           # 프로필 수정 폼

app/api/user/
└── profile/route.ts           # GET: 조회, PATCH: 수정
```

### API 명세
```typescript
// PATCH /api/user/profile
Request: { name: string }
Response: { success: true, user: { id, name, email } }
```

### 확인 체크리스트
- [ ] 현재 사용자 정보 정상 표시
- [ ] 이름 수정 후 저장 성공
- [ ] 빈 이름 입력 시 에러 메시지
- [ ] 수정 후 화면 즉시 반영

---

## 1.3 비밀번호 변경 (로그인 상태)

### 구현 내용
- [ ] 비밀번호 변경 폼 UI
- [ ] 현재 비밀번호 확인 로직
- [ ] 새 비밀번호 복잡성 검증
- [ ] 비밀번호 변경 API

### 생성 파일
```
app/(portal)/mypage/security/
└── page.tsx                       # 보안 탭

app/(portal)/mypage/components/
└── password-change-form.tsx       # 비밀번호 변경 폼

app/api/user/
└── change-password/route.ts       # POST: 비밀번호 변경
```

### API 명세
```typescript
// POST /api/user/change-password
Request: {
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
}
Response: { success: true, message: "비밀번호가 변경되었습니다" }
Errors:
  - 400: 현재 비밀번호 불일치
  - 400: 새 비밀번호 복잡성 미충족
  - 400: 확인 비밀번호 불일치
```

### 확인 체크리스트
- [ ] 현재 비밀번호 틀릴 시 에러
- [ ] 새 비밀번호 복잡성 검증 (대/소문자, 숫자, 특수문자)
- [ ] 확인 비밀번호 불일치 시 에러
- [ ] 성공 시 성공 메시지 표시
- [ ] 변경 후 새 비밀번호로 로그인 가능

---

## 1.4 구독/사용량 정보 확인

### 구현 내용
- [ ] 현재 티어 표시 (basic/standard/premium)
- [ ] 사용량 현황 표시 (진행 바 시각화)
- [ ] 사용량 조회 API

### 생성 파일
```
app/(portal)/mypage/subscription/
└── page.tsx                   # 구독 탭

app/(portal)/mypage/components/
└── usage-summary.tsx          # 사용량 요약 카드

app/api/user/
└── usage/route.ts             # GET: 사용량 조회
```

### API 명세
```typescript
// GET /api/user/usage
Response: {
  tier: "basic" | "standard" | "premium",
  usage: {
    chatbots: { used: 1, limit: 1 },
    datasets: { used: 1, limit: 1 },
    documents: { used: 5, limit: 10 },
    storage: { used: 52428800, limit: 104857600 }, // bytes
    conversations: { used: 150, limit: 1000 }
  }
}
```

### 확인 체크리스트
- [ ] 티어 정보 정상 표시
- [ ] 각 사용량 항목별 진행 바 표시
- [ ] 한도 초과 임박 시 경고 색상
- [ ] 숫자 포맷팅 (용량: MB/GB, 개수: 콤마)

---

## 1.5 계정 삭제/탈퇴

### 구현 내용
- [ ] 계정 삭제 확인 다이얼로그
- [ ] 비밀번호 재입력 확인
- [ ] "탈퇴합니다" 문구 입력 확인
- [ ] 30일 유예 기간 설정 및 데이터 보관
- [ ] 탈퇴 API

### 생성 파일
```
app/(portal)/mypage/components/
└── delete-account-dialog.tsx   # 계정 삭제 다이얼로그

app/api/user/
└── account/route.ts            # DELETE: 계정 삭제 요청
```

### 수정 파일
```
drizzle/schema.ts              # deletedAt, deleteScheduledAt 필드 추가
lib/auth/session.ts            # 세션 무효화 함수 추가
```

### DB 스키마 변경
```typescript
// users 테이블에 추가
deletedAt: timestamp           // 실제 삭제일
deleteScheduledAt: timestamp   // 삭제 예정일 (30일 후)
deleteReason: text             // 탈퇴 사유 (선택)
```

### API 명세
```typescript
// DELETE /api/user/account
Request: {
  password: string,
  confirmText: string  // "탈퇴합니다"
}
Response: { success: true, message: "30일 후 계정이 삭제됩니다" }
```

### 확인 체크리스트
- [ ] 비밀번호 틀릴 시 삭제 거부
- [ ] "탈퇴합니다" 정확히 입력해야 진행
- [ ] 삭제 요청 후 즉시 로그아웃
- [ ] deleteScheduledAt 필드에 30일 후 날짜 설정
- [ ] 탈퇴한 계정으로 로그인 시 "삭제 예정" 안내

---

# Phase 2: 보안 강화 (권장)

> **목표**: 2FA 및 보안 모니터링 기능 추가

## 2.1 2FA (TOTP) 설정 UI

### 구현 내용
- [ ] 2FA 활성화 플로우 UI (QR 코드 표시)
- [ ] 백업 코드 생성 및 다운로드
- [ ] 2FA 비활성화 기능
- [ ] TOTP 설정 API

### 생성 파일
```
app/(portal)/mypage/components/
└── totp-setup.tsx             # 2FA 설정 컴포넌트

app/api/user/totp/
├── setup/route.ts             # POST: 설정 시작 (QR 코드 반환)
├── verify/route.ts            # POST: 활성화 확인
└── disable/route.ts           # POST: 비활성화
```

### 확인 체크리스트
- [ ] QR 코드 정상 생성 및 표시
- [ ] Google Authenticator 앱으로 스캔 가능
- [ ] 코드 입력 시 활성화 성공
- [ ] 백업 코드 10개 생성 및 다운로드
- [ ] 비활성화 시 비밀번호 재확인

---

## 2.2 로그인 시 2FA 검증

### 구현 내용
- [ ] 로그인 플로우에 2FA 단계 추가
- [ ] 2FA 활성화된 사용자: 비밀번호 → TOTP 입력
- [ ] 백업 코드로 로그인 기능

### 수정 파일
```
app/api/auth/login/route.ts    # 2FA 검증 로직 추가
app/login/page.tsx             # 2FA 입력 UI 추가
```

### 확인 체크리스트
- [ ] 2FA 비활성화 사용자: 기존 로그인 유지
- [ ] 2FA 활성화 사용자: TOTP 입력 화면 표시
- [ ] 올바른 TOTP 입력 시 로그인 성공
- [ ] 백업 코드 입력 시 로그인 성공 + 코드 소진
- [ ] 틀린 TOTP 5회 시 계정 잠금

---

## 2.3 로그인 기록 조회

### 구현 내용
- [ ] 최근 로그인 기록 표시 (최대 50건)
- [ ] IP, 시간, 기기 정보 표시
- [ ] 의심스러운 접근 표시 (새 IP, 해외 등)

### 생성 파일
```
app/(portal)/mypage/components/
└── login-history.tsx          # 로그인 기록 컴포넌트

app/api/user/
└── login-history/route.ts     # GET: 로그인 기록 조회
```

### 확인 체크리스트
- [ ] 로그인 기록 시간순 정렬
- [ ] IP 주소, 기기 정보 표시
- [ ] 현재 세션 표시 (이 기기)
- [ ] 성공/실패 구분 표시

---

## 2.4 활성 세션 관리

### 구현 내용
- [ ] 현재 활성 세션 목록 표시
- [ ] 다른 기기 세션 강제 로그아웃
- [ ] 모든 기기 로그아웃 기능

### 생성 파일
```
app/(portal)/mypage/components/
└── active-sessions.tsx        # 활성 세션 컴포넌트

app/api/user/
└── sessions/route.ts          # GET: 세션 목록, DELETE: 세션 삭제
```

### 확인 체크리스트
- [ ] 현재 접속 기기 목록 표시
- [ ] 특정 세션 로그아웃 가능
- [ ] "모든 기기 로그아웃" 동작
- [ ] 로그아웃된 세션으로 접근 시 로그인 페이지

---

# Phase 3: 부가 기능 (선택)

> **목표**: 사용자 편의 기능 추가

## 3.1 이메일 변경

### 구현 내용
- [ ] 새 이메일 입력 및 인증 요청
- [ ] 인증 이메일 발송
- [ ] 인증 완료 후 이메일 변경

### 생성 파일
```
app/api/user/
├── change-email/route.ts          # POST: 이메일 변경 요청
└── verify-new-email/route.ts      # POST: 새 이메일 인증

lib/email/
└── templates/change-email.tsx     # 이메일 변경 인증 템플릿
```

### DB 스키마 변경
```typescript
// users 테이블에 추가
newEmail: text                     // 변경 예정 이메일
newEmailToken: text                // 변경 인증 토큰
newEmailExpires: timestamp         // 토큰 만료 시간
```

### 확인 체크리스트
- [ ] 새 이메일로 인증 링크 발송
- [ ] 24시간 내 인증 시 이메일 변경
- [ ] 기존 이메일로 변경 알림 발송
- [ ] 중복 이메일 검사

---

## 3.2 알림 설정

### 구현 내용
- [ ] 알림 설정 UI (토글 스위치)
- [ ] 알림 유형별 설정 (보안, 사용량)
- [ ] 알림 설정 저장 API

### 생성 파일
```
app/(portal)/mypage/notifications/
└── page.tsx                       # 알림 설정 탭

app/api/user/
└── notification-settings/route.ts # GET/PATCH: 알림 설정
```

### DB 스키마 변경
```typescript
// users 테이블 또는 별도 테이블
notificationSettings: jsonb  // {
                             //   security: true,    // 보안 알림
                             //   usage: true,       // 사용량 알림
                             //   marketing: false   // 마케팅 알림
                             // }
```

### 확인 체크리스트
- [ ] 알림 설정 토글 정상 동작
- [ ] 설정 저장 후 반영
- [ ] 기본값: 보안 ON, 사용량 ON, 마케팅 OFF

---

## 3.3 프로필 이미지

### 구현 내용
- [ ] 이미지 업로드 UI
- [ ] 이미지 리사이즈/최적화
- [ ] 기본 아바타 제공

### 생성 파일
```
app/(portal)/mypage/components/
└── avatar-upload.tsx              # 아바타 업로드 컴포넌트

app/api/user/
└── avatar/route.ts                # POST: 업로드, DELETE: 삭제
```

### 확인 체크리스트
- [ ] 이미지 업로드 성공 (JPG, PNG, max 2MB)
- [ ] 자동 리사이즈 (200x200)
- [ ] 프로필 이미지 표시
- [ ] 삭제 시 기본 아바타로 복귀

---

# Phase 4: 중기 계획 (결제 연동)

> **목표**: 유료 결제 시스템 구축

## 4.1 결제 시스템 연동

### 구현 내용
- [ ] Stripe 또는 토스페이먼츠 연동
- [ ] 정기 결제 설정
- [ ] 결제 수단 관리

---

## 4.2 플랜 업그레이드/다운그레이드

### 구현 내용
- [ ] 플랜 비교 페이지
- [ ] 업그레이드 결제 플로우
- [ ] 다운그레이드 시 다음 결제일부터 적용

---

## 4.3 결제 내역/인보이스

### 구현 내용
- [ ] 결제 내역 목록
- [ ] PDF 인보이스 다운로드
- [ ] 영수증 이메일 발송

---

# 전체 진행 체크리스트

## Phase 1 완료 조건
- [ ] 마이페이지 접근 가능
- [ ] 프로필 조회/수정 동작
- [ ] 비밀번호 변경 동작
- [ ] 구독/사용량 확인 가능
- [ ] 계정 삭제 요청 가능

## Phase 2 완료 조건
- [ ] 2FA 활성화/비활성화 동작
- [ ] 2FA 적용된 로그인 동작
- [ ] 로그인 기록 조회 가능
- [ ] 세션 관리 동작

## Phase 3 완료 조건
- [ ] 이메일 변경 동작
- [ ] 알림 설정 동작
- [ ] 프로필 이미지 업로드 동작

## Phase 4 완료 조건
- [ ] 결제 연동 완료
- [ ] 플랜 변경 동작
- [ ] 결제 내역 조회 가능

---

# 참고: 관련 코드 위치

## 인증/보안 관련
- 세션 관리: [lib/auth/session.ts](lib/auth/session.ts)
- 비밀번호 정책: [lib/auth/password.ts](lib/auth/password.ts)
- 계정 잠금: [lib/auth/account-lock.ts](lib/auth/account-lock.ts)
- TOTP: [lib/auth/totp.ts](lib/auth/totp.ts)

## 티어/사용량 관련
- 티어 상수: [lib/tier/constants.ts](lib/tier/constants.ts)
- 사용량 검증: [lib/tier/validator.ts](lib/tier/validator.ts)

## 이메일 관련
- 이메일 발송: [lib/email/index.ts](lib/email/index.ts)

## DB 스키마
- 사용자 테이블: [drizzle/schema.ts](drizzle/schema.ts) (users)
- 로그인 기록: [drizzle/schema.ts](drizzle/schema.ts) (loginAttempts)
- 세션 테이블: [drizzle/schema.ts](drizzle/schema.ts) (sessions)
