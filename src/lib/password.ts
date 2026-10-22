/**
 * Password Hashing — Edge-compatible (Web Crypto API)
 *
 * Dùng PBKDF2-SHA256 với salt ngẫu nhiên.
 * Không cần bcrypt hay dependencies bên ngoài.
 *
 * Format lưu: salt_hex:hash_hex
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes
const SALT_LENGTH = 16; // bytes

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hash a password with a random salt.
 * Returns "salt_hex:hash_hex"
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  return `${bufToHex(salt.buffer)}:${bufToHex(derivedBits)}`;
}

/**
 * Verify a password against stored "salt_hex:hash_hex".
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const encoder = new TextEncoder();
  const salt = hexToBuf(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const saltBuffer = new Uint8Array(salt).buffer;

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );

  return bufToHex(derivedBits) === hashHex;
}

/**
 * Validate password strength.
 * Returns error message or null if valid.
 *
 * Rules:
 *   - Tối thiểu 8 ký tự
 *   - Phải chứa ít nhất 1 chữ cái
 *   - Phải chứa ít nhất 1 số
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ cái';
  }
  if (!/[0-9]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 số';
  }
  return null;
}
