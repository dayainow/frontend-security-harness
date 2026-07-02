import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
// ==========================================
// 1. [네트워크 계층] API 보안 & CSP 가드 (MSW)
// ==========================================
const ALLOWED_DOMAINS = ['api.myservice.com', 'localhost'];
// msw ^2.0.0 uses http, HttpResponse instead of rest, res, ctx
export const securityMswServer = setupServer(
// 모든 아웃바운드 요청을 가로채서 검사
http.all('*', ({ request }) => {
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    // [보안 3] API 인증 헤더 검증
    if (url.host === 'api.myservice.com' && !authHeader) {
        return HttpResponse.json({
            status: 'FAIL',
            reason: '[SECURITY VIOLATION] 내부 API 요청에 Authorization 헤더가 누락되었습니다.',
        }, { status: 400 });
    }
    // [보안 4] 외부 유출 (CSP Policy) 검증
    if (!ALLOWED_DOMAINS.includes(url.host) && url.host !== '127.0.0.1') {
        return HttpResponse.json({
            status: 'FAIL',
            reason: `[CSP VIOLATION] 허용되지 않은 외부 도메인(${url.host})으로 데이터 전송이 감지되었습니다.`,
        }, { status: 403 });
    }
    return;
}));
// ==========================================
// 2. [런타임 계층] 스토리지 보호 가드 (Proxy)
// ==========================================
export function initStorageGuard() {
    const originalSetItem = Storage.prototype.setItem;
    // [보안 2] LocalStorage 민감 정보 저장 차단
    Storage.prototype.setItem = function (key, value) {
        const blacklistedKeys = ['token', 'jwt', 'password', 'secret', 'apikey'];
        if (blacklistedKeys.some((k) => key.toLowerCase().includes(k))) {
            throw new Error(`[SECURITY VIOLATION] '${key}'와 같은 민감 정보는 LocalStorage에 저장할 수 없습니다. Cookies나 메모리 상태 관리를 사용하세요.`);
        }
        originalSetItem.apply(this, [key, value]);
    };
}
// ==========================================
// 3. [DOM 계층] XSS 공격 취약점 테스터 (Fuzzing)
// ==========================================
export function testXssVulnerability(renderComponent) {
    // 악성 스크립트 인젝션 페이로드
    const xssPayload = `"><script>window.__xss_compromised__=true;</script><img src=x onerror="window.__xss_compromised__=true;">`;
    // 가상 DOM에 컴포넌트 렌더링
    renderComponent(xssPayload);
    // [보안 1] 가상 브라우저 환경에서 악성 스크립트가 실행되었는지 확인
    if (global.window.__xss_compromised__) {
        throw new Error(`[SECURITY VIOLATION] XSS 방어가 뚫렸습니다! 입력값이 적절히 이스케이프(Sanitize)되지 않았습니다.`);
    }
    // JSDOM 환경에서는 script나 img onerror가 동기적으로 실행되지 않을 수 있으므로 DOM 내부를 직접 검사합니다.
    if (document.body.innerHTML.includes('<script>window.__xss_compromised__=true;</script>')) {
        throw new Error(`[SECURITY VIOLATION] XSS 방어가 뚫렸습니다! 입력값이 적절히 이스케이프(Sanitize)되지 않았습니다.`);
    }
}
