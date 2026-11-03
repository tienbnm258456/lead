import { prisma } from './prisma';
export const AUTH_COOKIE_NAME = 'lead_admin_token';
export const AUTH_SECRET = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev_only_default_key_change_me_in_production');
if (!AUTH_SECRET) throw new Error('AUTH_SECRET is required in production');
export interface AuthUser {
  id: number; username: string; name: string; role: string; email?: string | null;
  group_id?: number | null; session_version?: number;
}
const encoder = new TextEncoder();
let cachedKey: CryptoKey | undefined;
async function key() {
  return cachedKey ||= await crypto.subtle.importKey('raw', encoder.encode(AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function createAuthToken(user: AuthUser): Promise<string> {
  const data = btoa(unescape(encodeURIComponent(JSON.stringify({ id: user.id, session_version: user.session_version, exp: Date.now() + 7 * 86400000 }))));
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), encoder.encode(data)));
  return data + '.' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyAuthToken(token: string | null | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !/^[0-9a-f]{64}$/.test(parts[1])) return null;
    const signature = Uint8Array.from(parts[1].match(/../g)!, pair => parseInt(pair, 16));
    if (!await crypto.subtle.verify('HMAC', await key(), signature, encoder.encode(parts[0]))) return null;
    const payload = JSON.parse(decodeURIComponent(escape(atob(parts[0]))));
    if (!Number.isFinite(payload.exp) || Date.now() >= payload.exp || !Number.isInteger(payload.id) || !Number.isInteger(payload.session_version)) return null;
    const user = await prisma.adminUser.findUnique({ where: { id: payload.id }, include: { group: true } });
    if (!user?.active || user.session_version !== payload.session_version || (user.group && !user.group.active)) return null;
    if (!['ADMIN', 'ADMIN2', 'USER'].includes(user.role)) return null;
    return { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email,
      group_id: user.group_id, session_version: user.session_version };
  } catch { return null; }
}
