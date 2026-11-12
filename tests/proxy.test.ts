import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';

function request(authorization?: string) {
  return new NextRequest('http://localhost/image', {
    headers: authorization ? { authorization } : {},
  });
}

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;
const passed = (response: Response) => response.headers.get('x-middleware-next') === '1';

describe('proxy', () => {
  it('lets every request through when no password is set', () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', '');
    expect(passed(proxy(request()))).toBe(true);
  });

  it('asks for the password when it is set', () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'open sesame');
    const response = proxy(request());
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toMatch(/^Basic realm=/);
  });

  it('refuses a wrong password', () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'open sesame');
    expect(proxy(request(basic('me', 'open sesam'))).status).toBe(401);
    expect(proxy(request('Basic not-base64!'))).toHaveProperty('status', 401);
    expect(proxy(request('Bearer open sesame')).status).toBe(401);
  });

  it('accepts the password with any user name', () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'open sesame');
    expect(passed(proxy(request(basic('me', 'open sesame'))))).toBe(true);
    expect(passed(proxy(request(basic('', 'open sesame'))))).toBe(true);
  });
});
