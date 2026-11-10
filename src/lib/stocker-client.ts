import type { StockerCredentials } from '@/lib/stocker-credentials';

export class StockerError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export function getStockerOrigin() {
  const baseUrl = process.env.STOCKER_BASE_URL;
  if (!baseUrl) throw new StockerError('Thiếu cấu hình STOCKER_BASE_URL', 500);
  const url = URL.canParse(baseUrl) ? new URL(baseUrl) : null;
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new StockerError('STOCKER_BASE_URL phải là địa chỉ gốc HTTPS của Stocker', 500);
  }
  return url.origin;
}

export const stockerHeaders = { Accept: 'application/json', 'X-Stocker-Partner': '1' };
export const stockerRequest = { cache: 'no-store', redirect: 'error' } as const;

export async function loginStocker(origin: string, { login, password }: Pick<StockerCredentials, 'login' | 'password'>, signal: AbortSignal) {
  const response = await fetch(new URL('/papi/login', origin), {
    ...stockerRequest,
    method: 'POST',
    signal,
    headers: { ...stockerHeaders, 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ login, password }),
  });
  const cookie = response.headers.getSetCookie().map(value => value.split(';', 1)[0].trim())
    .find(value => /^__Host-stkp=.+$/.test(value));
  await response.body?.cancel();
  if (!response.ok) {
    throw new StockerError('Đăng nhập Stocker thất bại (HTTP ' + response.status + ')');
  }
  if (!cookie) throw new StockerError('Stocker không trả cookie phiên __Host-stkp khi đăng nhập');
  return cookie;
}

type Session = { cookie: string; expiresAt: number };
let current: { key: string; login: Promise<Session> } | undefined;

export async function getStockerSession(origin: string, credentials: StockerCredentials, rejectedCookie?: string) {
  const key = origin + credentials.revision;
  if (current?.key === key) {
    const previous = current;
    const session = await previous.login;
    if (session.expiresAt > Date.now() && session.cookie !== rejectedCookie) return session.cookie;
    if (current !== previous) return getStockerSession(origin, credentials, rejectedCookie);
  }

  const login = loginStocker(origin, credentials, AbortSignal.timeout(15_000))
    .then(cookie => ({ cookie, expiresAt: Date.now() + 15 * 60 * 1000 }));
  current = { key, login };
  try {
    return (await login).cookie;
  } catch (error) {
    if (current?.login === login) current = undefined;
    throw error;
  }
}
