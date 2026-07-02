# 🛡️ Frontend Security Suite Harness

프론트엔드 애플리케이션에서 발생할 수 있는 4대 핵심 보안 취약점을 **통합 샌드박스 환경(JSDOM + MSW)에서 1~2초 만에 검증**하는 보안 하네스입니다.

AI 에이전트가 작성한 코드나 사람이 작성한 코드가 프로덕션에 배포되기 전, 보안 정책을 준수하는지 자동으로 검사(Audit)하는 목적으로 설계되었습니다.

---

## 🔍 4대 보안 취약점과 검증 원리

| 보안 취약점 | 어떤 문제인가요? | 해결하는 하네스 레이어 |
| :--- | :--- | :--- |
| **1. XSS (악성 스크립트 주입)** | 사용자가 입력한 데이터에 악성 스크립트가 섞여 다른 브라우저에서 실행되는 해킹입니다. | **XSS & Sanitizer Harness** |
| **2. 스토리지 및 세션 탈취** | `localStorage` 등 탈취하기 쉬운 공간에 토큰/비밀번호가 노출되는 문제입니다. | **Storage Guard Harness** |
| **3. API 인증 헤더 누락** | 서버로 데이터를 요청할 때 '인증 정보(Authorization Header)' 없이 비인가 요청을 보내는 취약점입니다. | **API Security Harness** |
| **4. 콘텐츠 보안 정책(CSP) 위반** | 해킹된 오픈소스(공급망 공격) 등이 유저 데이터를 외부 해커 서버로 빼돌리는 문제입니다. | **CSP & Supply Chain Harness** |

### 💡 하네스는 이 문제들을 어떻게 잡아내나요?

**1. 악성코드 주입 테스트 (Fuzzing)**
> 하네스가 가상의 JSDOM 브라우저 환경을 띄우고, 해커들이 사용하는 **실제 악성 페이로드(`"><script>...`)를 컴포넌트에 강제로 주입**합니다. 만약 텍스트가 안전하게 이스케이프 처리(Sanitize)되지 않고 스크립트가 실행되어 버리면 즉시 에러를 발생시켜 안전한 코딩을 유도합니다.

**2. LocalStorage 문지기 (Proxy Interceptor)**
> 브라우저의 `localStorage.setItem` 함수를 프록시로 가로채어 감시합니다. 개발자가 무심코 `'token'`, `'password'`, `'jwt'` 등의 키 이름으로 데이터를 저장하려고 시도하는 순간, **"민감한 정보는 쿠키나 메모리에 저장하라"** 며 앱 실행을 강제로 멈추고 테스트를 실패시킵니다.

**3. API 출입증 짐 검사 (MSW Network Mocking)**
> MSW(가상 서비스 워커)를 활용해 프론트엔드에서 나가는 모든 네트워크 요청을 중간에서 뜯어봅니다. 내부 서버(`api.myservice.com`)를 향하는 요청임에도 **`Authorization` 헤더(출입증)가 없다면 통신을 차단(400 Bad Request)** 하고 테스트를 실패시킵니다.

**4. 허가받지 않은 도메인 통신 차단 (Whitelist 검증)**
> MSW 네트워크 인터셉터를 통해, 사전에 허가된 도메인(`localhost`, `api.myservice.com`)이 아닌 **엉뚱한 외부 주소(`evil-hacker.com` 등)로 데이터를 전송하려는 시도를 원천 차단(403 Forbidden)** 하여 앱 내부 데이터의 외부 유출(Exfiltration)을 방지합니다.

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
