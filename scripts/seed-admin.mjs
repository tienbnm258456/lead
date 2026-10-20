/**
 * ============================================================
 * SEED ADMIN — Tạo tài khoản admin mặc định
 * ============================================================
 * Chạy: node scripts/seed-admin.mjs
 * Tạo 2 tài khoản: admin/123456 và postgres/123456
 * Nếu đã tồn tại thì bỏ qua.
 * ============================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── PBKDF2 password hashing (same as src/lib/password.ts) ──
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial, KEY_LENGTH * 8,
  );

  return `${bufToHex(salt.buffer)}:${bufToHex(derivedBits)}`;
}

// ── Seed ──
const DEFAULT_ADMINS = [
  { username: 'admin', password: '123456', name: 'Quản trị viên', email: null },
  { username: 'postgres', password: '123456', name: 'Postgres Admin', email: null },
];

async function seed() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    🔑 SEED ADMIN — Tạo tài khoản admin      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  for (const admin of DEFAULT_ADMINS) {
    const existing = await prisma.adminUser.findUnique({
      where: { username: admin.username },
    });

    if (existing) {
      console.log(`  ⏭️  "${admin.username}" — đã tồn tại (bỏ qua)`);
      continue;
    }

    const hash = await hashPassword(admin.password);
    await prisma.adminUser.create({
      data: {
        username: admin.username,
        password_hash: hash,
        name: admin.name,
        email: admin.email,
        role: 'ADMIN',
        active: true,
      },
    });

    console.log(`  ✅ "${admin.username}" — tạo thành công (pass: ${admin.password})`);
  }

  const total = await prisma.adminUser.count();
  console.log('');
  console.log(`  📊 Tổng admin users: ${total}`);
  console.log('');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
