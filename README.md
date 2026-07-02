# 🛡️ Frontend Security Suite Harness

프론트엔드 애플리케이션에서 발생할 수 있는 4대 핵심 보안 취약점을 **통합 샌드박스 환경(JSDOM + MSW)에서 1~2초 만에 검증**하는 보안 하네스입니다.

AI 에이전트가 작성한 코드나 사람이 작성한 코드가 프로덕션에 배포되기 전, 보안 정책을 준수하는지 자동으로 검사(Audit)하는 목적으로 설계되었습니다.

---

## 🔍 검증하는 4대 보안 취약점

| 보안 취약점 | 어떤 문제인가요? | 해결하는 하네스 레이어 |
| :--- | :--- | :--- |
| **XSS (크로스 사이트 스크립팅)** | 공격자가 악성 스크립트를 삽입해 유저의 쿠키/토큰을 탈취 | **XSS & Sanitizer Harness** (DOM 렌더링 검사) |
| **스토리지 및 세션 탈취** | `localStorage`에 민감한 정보(토큰, 비밀번호 등) 노출 | **Storage Guard Harness** (Proxy 가로채기) |
| **API 헤더 검증 누락** | 내부 API 요청 시 권한(Authorization) 정보 누락 | **API Security Harness** (MSW 네트워크 검사) |
| **오염된 패키지 공급망 (CSP)** | 오픈소스 등에 숨겨진 악성코드가 외부 해커 서버로 데이터 유출 | **CSP & Supply Chain Harness** (아웃바운드 검사) |

---

## 🚀 설치 방법

이 패키지는 다른 프로젝트에서도 쉽게 가져다 쓸 수 있도록 구성되어 있습니다.

### NPM 패키지로 설치 (추천)
현재 깃허브 레포지토리 주소를 통해 바로 설치할 수 있습니다.
```bash
npm install -D dayainow/frontend-security-harness
```

---

## 💻 사용 방법

프로젝트의 `Vitest` 테스트 환경 내에서 이 하네스를 불러와 보안 검증을 수행할 수 있습니다.

### 1. 테스트 환경 세팅 (Setup)
테스트 파일(`.test.tsx` 또는 `setupTests.ts`) 상단에서 하네스를 초기화합니다.

```tsx
import { securityMswServer, initStorageGuard, testXssVulnerability } from 'frontend-security-harness';
import { beforeAll, afterAll } from 'vitest';

// 1. 테스트 시작 전 MSW 네트워크 인터셉터와 스토리지 가드를 켭니다.
beforeAll(() => {
  securityMswServer.listen();
  initStorageGuard();
});

// 2. 테스트 종료 시 서버를 닫아줍니다.
afterAll(() => {
  securityMswServer.close();
});
```

### 2. XSS 취약점 검증하기
작성한 UI 컴포넌트가 악성 스크립트 주입 공격에 안전한지 테스트합니다.

```tsx
import { render } from '@testing-library/react';
import { MyCommentComponent } from '@/components/Comment';

it('작성한 댓글 컴포넌트가 XSS 공격에 안전한지 검증', () => {
  expect(() => {
    // 악성 문자열(maliciousInput)을 주입했을 때 안전하게 필터링되는지 확인합니다.
    testXssVulnerability((maliciousInput) => {
      render(<MyCommentComponent content={maliciousInput} />);
    });
  }).not.toThrow();
});
```
*(만약 컴포넌트 내부에 `dangerouslySetInnerHTML` 등이 안전장치 없이 사용되었다면 즉시 에러를 발생시킵니다.)*

### 3. 스토리지 및 네트워크 검증
별도의 코드 작성 없이, 하네스가 켜져 있는 동안 컴포넌트나 로직 내에서 다음과 같은 행위가 감지되면 **자동으로 테스트를 실패(Fail)** 시킵니다.

- `localStorage.setItem('token', '...')` 호출 시도
- `Authorization` 헤더 없이 `api.myservice.com` 으로 `fetch` 시도
- 허용되지 않은 외부 도메인(예: 해커의 서버)으로 데이터를 빼돌리려는 `fetch` 시도

---

## 🛠️ GitHub Actions (CI/CD 자동화)

이 하네스를 GitHub Actions와 연결하여 코드가 Push 될 때마다 자동으로 보안 검사를 수행하도록 구성할 수 있습니다.

`.github/workflows/security-audit.yml` 파일 예시:
```yaml
name: Frontend Security Audit

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch: # 수동 실행 버튼 활성화

jobs:
  security-harness:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20.x'
    - run: npm ci
    - run: npm run test:security-harness
```

---

## 🏗️ 개발 및 기여 (Development)

하네스 자체를 수정하고 빌드하려면 다음 명령어를 사용하세요.

```bash
# 의존성 설치
npm install

# TypeScript 빌드 (dist 폴더 생성)
npm run build

# 보안 하네스 자체 검증 테스트 실행
npm run test:security-harness
```
