import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const settingKey = 'stocker_partner_credentials';
type Login = { login: string; password: string };
export type StockerCredentials = Login & { revision: string };

let cached: { encrypted: string; key: string; credentials: StockerCredentials } | undefined;

function encryptionKey() {
  const key = process.env.STOCKER_CREDENTIALS_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('STOCKER_CREDENTIALS_KEY must be a 32-byte hex key');
  }
  return key;
}

export async function getStockerCredentials(): Promise<StockerCredentials | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: settingKey }, select: { value: true } });
  if (!row) return null;

  const key = encryptionKey();
  if (cached?.encrypted === row.value && cached.key === key) return cached.credentials;

  const [version, iv, tag, ciphertext] = row.value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid stored Stocker credentials');

  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(settingKey));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const decoded: Login = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8'));
  const credentials = { ...decoded, revision: createHash('sha256').update(row.value).digest('hex') };
  cached = { encrypted: row.value, key, credentials };
  return credentials;
}

export function prepareStockerCredentials(login: Login) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAAD(Buffer.from(settingKey));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(login), 'utf8'), cipher.final()]);
  const encrypted = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  return encrypted.length <= 500 ? encrypted : null;
}

export async function saveStockerCredentials(encrypted: string) {
  await prisma.systemSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: encrypted },
    update: { value: encrypted },
  });
  cached = undefined;
}
