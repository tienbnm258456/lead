/**
 * ============================================================
 * SEED DATA - Tạo dữ liệu giả lập trực tiếp vào PostgreSQL
 * ============================================================
 * Mục đích: Nhồi 100k-150k records vào DB để test hiệu năng
 * Chạy: node scripts/seed-data.mjs [số_lượng]
 * Ví dụ: node scripts/seed-data.mjs 100000
 * ============================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 5000; // Insert 5000 records per batch
const DEFAULT_COUNT = 100000;

// Random data generators
const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const middleNames = ['Văn', 'Thị', 'Đức', 'Minh', 'Hoàng', 'Thanh', 'Quốc', 'Hữu', 'Thành', 'Ngọc', 'Xuân', 'Kim'];
const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Phúc', 'Gia', 'Hải', 'Khánh', 'Long', 'Mai', 'Nam', 'Phương', 'Quang', 'Sơn', 'Tùng', 'Uyên', 'Vinh', 'Yến', 'Thảo', 'Linh', 'Hà', 'Trang', 'Hương', 'Lan'];
const sources = ['Landing Page', 'Facebook Ads', 'Google Ads', 'TikTok', 'Zalo', 'Website', 'Referral', 'Event'];
const utmSources = ['facebook', 'google', 'tiktok', 'zalo', 'instagram', 'youtube', null];
const utmMediums = ['cpc', 'cpm', 'banner', 'video', 'bio', 'social', null];
const statuses = ['NEW', 'PROCESSING', 'COMPLETED', 'FAILED'];
const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.vn'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const prefixes = ['09', '03', '07', '08', '05'];
  return randomItem(prefixes) + Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generateLead(index) {
  const firstName = randomItem(firstNames);
  const middleName = randomItem(middleNames);
  const lastName = randomItem(lastNames);
  const fullname = `${firstName} ${middleName} ${lastName}`;
  const hasEmail = Math.random() > 0.3; // 70% have email
  const hasNote = Math.random() > 0.5;

  // Spread created_at across the last 14 days
  const daysAgo = Math.floor(Math.random() * 14);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);
  createdAt.setHours(createdAt.getHours() - hoursAgo);
  createdAt.setMinutes(createdAt.getMinutes() - minutesAgo);

  return {
    fullname,
    phone: randomPhone(),
    email: hasEmail ? `lead${index}@${randomItem(emailDomains)}` : null,
    note: hasNote ? `Khách hàng quan tâm sản phẩm ${String.fromCharCode(65 + (index % 26))}` : null,
    source: randomItem(sources),
    utm_source: randomItem(utmSources),
    utm_medium: randomItem(utmMediums),
    status: randomItem(statuses),
    created_at: createdAt,
    updated_at: createdAt,
  };
}

async function seed(totalCount) {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║      🌱 SEED DATA - Tạo dữ liệu test       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Check current count
  const existing = await prisma.lead.count();
  console.log(`📊 Hiện có: ${existing.toLocaleString()} bản ghi trong DB`);
  console.log(`🎯 Sẽ thêm: ${totalCount.toLocaleString()} bản ghi mới`);
  console.log(`📦 Batch size: ${BATCH_SIZE.toLocaleString()} records/batch`);
  console.log(`📝 Tổng batches: ${Math.ceil(totalCount / BATCH_SIZE)}`);
  console.log('');

  const startTime = Date.now();
  let inserted = 0;

  for (let i = 0; i < totalCount; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, totalCount - i);
    const leads = [];

    for (let j = 0; j < batchCount; j++) {
      leads.push(generateLead(existing + i + j));
    }

    await prisma.lead.createMany({ data: leads });
    inserted += batchCount;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(inserted / (elapsed || 1));
    const percent = Math.round((inserted / totalCount) * 100);
    const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));

    process.stdout.write(`\r  [${bar}] ${percent}% | ${inserted.toLocaleString()}/${totalCount.toLocaleString()} | ${rate}/s | ${elapsed}s`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const finalCount = await prisma.lead.count();

  console.log('\n');
  console.log('✅ Hoàn thành!');
  console.log(`   ⏱  Thời gian: ${totalTime}s`);
  console.log(`   📊 Tổng DB: ${finalCount.toLocaleString()} bản ghi`);
  console.log(`   ⚡ Tốc độ: ${Math.round(inserted / totalTime)}/s`);
  console.log('');
}

// Entry
const count = parseInt(process.argv[2]) || DEFAULT_COUNT;
seed(count)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
