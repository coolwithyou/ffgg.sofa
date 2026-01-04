# OAuth 로그인 설정 가이드

SOFA 프로젝트에서 구글 및 카카오 소셜 로그인을 사용하기 위한 설정 가이드입니다.

## 목차

1. [Google OAuth 설정](#1-google-oauth-설정)
2. [Kakao OAuth 설정](#2-kakao-oauth-설정)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [테스트 및 검증](#4-테스트-및-검증)

---

## 1. Google OAuth 설정

### Step 1: Google Cloud Console 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 상단의 프로젝트 선택 드롭다운을 클릭합니다.
3. **새 프로젝트**를 클릭합니다.
4. 프로젝트 이름을 입력하고 (예: `SOFA-Production`) **만들기**를 클릭합니다.
5. 생성된 프로젝트를 선택합니다.

### Step 2: OAuth 동의 화면 구성

1. 좌측 메뉴에서 **API 및 서비스** > **OAuth 동의 화면**을 선택합니다.
2. **User Type**을 선택합니다:
   - **외부**: 모든 Google 계정 사용자가 사용 가능 (일반적으로 선택)
   - **내부**: Google Workspace 조직 내 사용자만 사용 가능
3. **만들기**를 클릭합니다.

#### 앱 정보 입력

| 항목 | 입력 값 |
|------|---------|
| 앱 이름 | SOFA (또는 서비스명) |
| 사용자 지원 이메일 | 관리자 이메일 |
| 앱 로고 | (선택) 서비스 로고 업로드 |
| 애플리케이션 홈페이지 | `https://your-domain.com` |
| 애플리케이션 개인정보처리방침 링크 | `https://your-domain.com/privacy` |
| 애플리케이션 서비스 약관 링크 | `https://your-domain.com/terms` |
| 개발자 연락처 정보 | 관리자 이메일 |

4. **저장 후 계속**을 클릭합니다.

#### 범위(Scopes) 설정

1. **범위 추가 또는 삭제**를 클릭합니다.
2. 다음 범위를 선택합니다:
   - `openid` - OpenID Connect 인증
   - `email` - 사용자 이메일 주소
   - `profile` - 사용자 기본 프로필 정보

3. **업데이트**를 클릭합니다.
4. **저장 후 계속**을 클릭합니다.

#### 테스트 사용자 (개발 중인 경우)

- 앱이 **테스트** 상태일 때는 등록된 테스트 사용자만 로그인 가능합니다.
- 테스트 사용자 이메일을 추가하거나, 프로덕션으로 **앱 게시**를 진행합니다.

### Step 3: OAuth 클라이언트 ID 생성

1. 좌측 메뉴에서 **API 및 서비스** > **사용자 인증 정보**를 선택합니다.
2. 상단의 **+ 사용자 인증 정보 만들기**를 클릭합니다.
3. **OAuth 클라이언트 ID**를 선택합니다.
4. 다음과 같이 설정합니다:

| 항목 | 값 |
|------|-----|
| 애플리케이션 유형 | 웹 애플리케이션 |
| 이름 | SOFA Web Client |
| 승인된 JavaScript 원본 | `https://your-domain.com` |
| 승인된 리디렉션 URI | `https://your-domain.com/api/auth/google/callback` |

> **개발 환경 추가 (선택)**
> - JavaScript 원본: `http://localhost:3060`
> - 리디렉션 URI: `http://localhost:3060/api/auth/google/callback`

5. **만들기**를 클릭합니다.
6. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 안전하게 저장합니다.

### Step 4: 필요한 API 활성화

1. 좌측 메뉴에서 **API 및 서비스** > **라이브러리**를 선택합니다.
2. 다음 API를 검색하여 **사용**을 클릭합니다:
   - Google+ API (또는 People API)

---

## 2. Kakao OAuth 설정

### Step 1: Kakao Developers 애플리케이션 생성

1. [Kakao Developers](https://developers.kakao.com/)에 접속합니다.
2. 카카오 계정으로 로그인합니다.
3. 상단의 **내 애플리케이션**을 클릭합니다.
4. **애플리케이션 추가하기**를 클릭합니다.
5. 다음 정보를 입력합니다:

| 항목 | 값 |
|------|-----|
| 앱 이름 | SOFA |
| 사업자명 | 회사명 또는 개인 이름 |

6. **저장**을 클릭합니다.

### Step 2: 플랫폼 등록

1. 생성된 애플리케이션을 클릭하여 상세 페이지로 이동합니다.
2. 좌측 메뉴에서 **앱 설정** > **플랫폼**을 선택합니다.
3. **Web** 플랫폼을 등록합니다:
   - **사이트 도메인**: `https://your-domain.com`
   - 개발 환경 추가: `http://localhost:3060`

4. **저장**을 클릭합니다.

### Step 3: 카카오 로그인 활성화

1. 좌측 메뉴에서 **제품 설정** > **카카오 로그인**을 선택합니다.
2. **활성화 설정**에서 **ON**으로 변경합니다.
3. **Redirect URI**를 등록합니다:
   - `https://your-domain.com/api/auth/kakao/callback`
   - 개발 환경: `http://localhost:3060/api/auth/kakao/callback`

4. **저장**을 클릭합니다.

### Step 4: 동의항목 설정

1. 좌측 메뉴에서 **제품 설정** > **카카오 로그인** > **동의항목**을 선택합니다.
2. 다음 항목을 설정합니다:

| 항목 | 설정 | 동의 수준 |
|------|------|-----------|
| 닉네임 | 필수 동의 | 필수 |
| 카카오계정(이메일) | 선택 동의 | 선택 |

> **중요: 이메일 수집을 위한 비즈 앱 전환**
>
> 이메일을 수집하려면 **비즈 앱**으로 전환해야 합니다:
> 1. 좌측 메뉴에서 **앱 설정** > **비즈니스**를 선택합니다.
> 2. **비즈 앱으로 전환**을 클릭합니다.
> 3. 사업자 정보를 입력하고 심사를 요청합니다.
>
> 비즈 앱 전환 전에는 이메일 동의항목을 "필수"로 설정할 수 없습니다.
>
> 현재 구현에서는 이메일이 없는 경우 `kakao_{kakaoId}@placeholder.local` 형식의
> 플레이스홀더 이메일을 생성합니다.

### Step 5: 앱 키 확인

1. 좌측 메뉴에서 **앱 설정** > **앱 키**를 선택합니다.
2. 다음 키를 확인하고 저장합니다:
   - **REST API 키**: `KAKAO_CLIENT_ID`로 사용
   - **Client Secret** (선택): 보안 강화를 위해 사용 가능

> **Client Secret 설정 (선택)**
> 1. **제품 설정** > **카카오 로그인** > **보안**을 선택합니다.
> 2. **Client Secret**에서 **코드 생성**을 클릭합니다.
> 3. 생성된 코드를 `KAKAO_CLIENT_SECRET`으로 사용합니다.
> 4. **활성화 상태**를 **사용함**으로 변경합니다.

---

## 3. 환경 변수 설정

프로젝트 루트의 `.env.local` 파일에 다음 환경 변수를 추가합니다:

```bash
# App URL (리디렉션 URI 구성에 사용)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Kakao OAuth
KAKAO_CLIENT_ID=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret  # 선택 (보안 설정에서 활성화한 경우)
```

### 환경별 설정 예시

#### 개발 환경 (`.env.local`)
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3060
```

#### 프로덕션 환경
```bash
NEXT_PUBLIC_APP_URL=https://sofa.example.com
```

---

## 4. 테스트 및 검증

### 로그인 플로우 테스트

1. 개발 서버를 시작합니다:
   ```bash
   pnpm dev
   ```

2. 브라우저에서 다음 URL로 접속하여 테스트합니다:
   - Google 로그인: `http://localhost:3060/api/auth/google`
   - Kakao 로그인: `http://localhost:3060/api/auth/kakao`

3. 각 서비스의 로그인 화면이 표시되는지 확인합니다.
4. 로그인 후 콜백 URL로 리디렉션되는지 확인합니다.
5. 세션이 정상적으로 생성되는지 확인합니다.

### 일반적인 오류 해결

#### Google OAuth

| 오류 | 원인 | 해결 방법 |
|------|------|-----------|
| `redirect_uri_mismatch` | 리디렉션 URI 불일치 | Google Console에서 정확한 URI 등록 |
| `access_denied` | 사용자가 동의 거부 | 정상 동작, 사용자에게 안내 필요 |
| `invalid_client` | 클라이언트 ID/Secret 오류 | 환경 변수 확인 |

#### Kakao OAuth

| 오류 | 원인 | 해결 방법 |
|------|------|-----------|
| `KOE101` | 잘못된 앱 키 | KAKAO_CLIENT_ID 확인 |
| `KOE303` | 리디렉션 URI 불일치 | 카카오 개발자 센터에서 URI 등록 |
| `KOE010` | 등록되지 않은 도메인 | 플랫폼 설정에서 도메인 등록 |

---

## 체크리스트

### Google OAuth 설정 완료 확인
- [ ] Google Cloud 프로젝트 생성
- [ ] OAuth 동의 화면 구성 완료
- [ ] OAuth 클라이언트 ID 생성
- [ ] 리디렉션 URI 등록 (`/api/auth/google/callback`)
- [ ] 환경 변수 설정 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] 테스트 로그인 성공

### Kakao OAuth 설정 완료 확인
- [ ] Kakao Developers 애플리케이션 생성
- [ ] 웹 플랫폼 등록
- [ ] 카카오 로그인 활성화
- [ ] Redirect URI 등록 (`/api/auth/kakao/callback`)
- [ ] 동의항목 설정 (닉네임, 이메일)
- [ ] 환경 변수 설정 (`KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`)
- [ ] 테스트 로그인 성공
- [ ] (선택) 비즈 앱 전환 및 이메일 필수 동의 설정

---

## 참고 자료

- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Kakao 로그인 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [Kakao 비즈 앱 가이드](https://developers.kakao.com/docs/latest/ko/getting-started/app#biz-app)
