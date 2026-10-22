// Authentication configuration & session helpers
// Now backed by database (AdminUser table) with hashed passwords

export const AUTH_COOKIE_NAME = 'lead_admin_token';
export const AUTH_SECRET = (() => {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('⛔ AUTH_SECRET environment variable is required in production!');
  }
  console.warn('⚠️ AUTH_SECRET not set — using default key. KHÔNG dùng trên production!');
  return 'dev_only_default_key_change_me_in_production';
})();

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  email?: string | null;
}

// Simple Edge-compatible token generator using Web Crypto API
// Cache CryptoKey + TextEncoder (tạo 1 lần, dùng lại cho mọi request)
const encoder = new TextEncoder();
let _cachedKey: CryptoKey | null = null;

async function getCryptoKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return _cachedKey;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
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


    const key = await getCryptoKey();

    // Constant-time comparison via crypto.subtle.verify (chống timing attack)
    const signatureBytes = hexToBuffer(signatureHex);
    const sigBuffer = new ArrayBuffer(signatureBytes.length);
    new Uint8Array(sigBuffer).set(signatureBytes);
    const isValid = await crypto.subtle.verify(
      'HMAC', key, sigBuffer, encoder.encode(payloadBase64)
    );

    if (!isValid) return null;

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
