// Authentication configuration & session helpers
// Now backed by database (AdminUser table) with hashed passwords

export const AUTH_COOKIE_NAME = 'lead_admin_token';
export const AUTH_SECRET = process.env.AUTH_SECRET || 'lead_admin_secret_key_2026_super_secure';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  email?: string | null;
}

// Simple Edge-compatible token generator using Web Crypto API
async function getCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createAuthToken(user: AuthUser): Promise<string> {
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const payloadStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const payloadBase64 = btoa(unescape(encodeURIComponent(payloadStr)));

  const key = await getCryptoKey();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  const signatureHex = bufferToHex(signatureBuffer);

  return `${payloadBase64}.${signatureHex}`;
}

export async function verifyAuthToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;

  try {
    const [payloadBase64, signatureHex] = token.split('.');
    if (!payloadBase64 || !signatureHex) return null;

    const encoder = new TextEncoder();
    const key = await getCryptoKey();
    const expectedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
    const expectedHex = bufferToHex(expectedBuffer);

    if (signatureHex !== expectedHex) return null;

    const payloadJson = decodeURIComponent(escape(atob(payloadBase64)));
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }

    return {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
