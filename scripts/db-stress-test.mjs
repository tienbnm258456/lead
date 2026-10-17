/**
 * ============================================================
 * DB STRESS TEST - Kiểm tra hiệu năng PostgreSQL trực tiếp
 * ============================================================
 * Mục đích: Đo hiệu năng DB thuần, tách biệt khỏi API
 *           để xác định bottleneck là server hay database
 *
 * Chạy: node scripts/db-stress-test.mjs
 * ============================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Test Helpers ──────────────────────────────────────────
async function measureQuery(name, queryFn, iterations = 10) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await queryFn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);

  return {
    name,
    iterations,
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    p50: Math.round(times[Math.floor(times.length * 0.5)]),
    p95: Math.round(times[Math.floor(times.length * 0.95)]),
    min: Math.round(times[0]),
    max: Math.round(times[times.length - 1]),
  };
}

async function measureConcurrent(name, queryFn, concurrency, totalOps) {
  let completed = 0;
  const times = [];
  const start = performance.now();

  async function worker() {
    while (completed < totalOps) {
      const idx = completed++;
      if (idx >= totalOps) break;
      const s = performance.now();
      await queryFn(idx);
      times.push(performance.now() - s);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalTime = performance.now() - start;
  times.sort((a, b) => a - b);

  return {
    name,
    total: totalOps,
    concurrency,
    totalTime: Math.round(totalTime),
    rps: Math.round((totalOps / totalTime) * 1000),
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    p50: Math.round(times[Math.floor(times.length * 0.5)]),
    p95: Math.round(times[Math.floor(times.length * 0.95)]),
    min: Math.round(times[0]),
    max: Math.round(times[times.length - 1]),
  };
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         🗄️  DB STRESS TEST - PostgreSQL Performance         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Current DB state
  const totalRecords = await prisma.lead.count();
  console.log(`📊 Bản ghi hiện có: ${totalRecords.toLocaleString()}`);

  if (totalRecords < 1000) {
    console.log('');
    console.log('⚠️  Cần ít nhất 1,000 bản ghi để test có ý nghĩa!');
    console.log('   Chạy trước: node scripts/seed-data.mjs 100000');
    console.log('');
    await prisma.$disconnect();
    return;
  }

  console.log('');
  const allResults = [];

  // ── Test 1: Simple COUNT ─────────────────────────────────
  console.log('▶ Test 1: COUNT (đếm tổng bản ghi)...');
  const t1 = await measureQuery('COUNT *', () => prisma.lead.count(), 20);
  allResults.push(t1);
  console.log(`  ✓ Avg: ${t1.avg}ms | P95: ${t1.p95}ms`);

  // ── Test 2: Paginated Read ───────────────────────────────
  console.log('▶ Test 2: Phân trang (OFFSET/LIMIT)...');
  const t2 = await measureQuery('SELECT page', () =>
    prisma.lead.findMany({
      orderBy: { created_at: 'desc' },
      skip: Math.floor(Math.random() * Math.max(1, totalRecords - 20)),
      take: 20,
    }), 20);
  allResults.push(t2);
  console.log(`  ✓ Avg: ${t2.avg}ms | P95: ${t2.p95}ms`);

  // ── Test 3: Search with LIKE ─────────────────────────────
  console.log('▶ Test 3: Tìm kiếm (LIKE query)...');
  const searchTerms = ['Nguyen', 'Tran', 'Le', '091', 'gmail'];
  const t3 = await measureQuery('SEARCH LIKE', () => {
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    return prisma.lead.findMany({
      where: {
        OR: [
          { fullname: { contains: term } },
          { phone: { contains: term } },
          { email: { contains: term } },
        ],
      },
      take: 20,
    });
  }, 20);
  allResults.push(t3);
  console.log(`  ✓ Avg: ${t3.avg}ms | P95: ${t3.p95}ms`);

  // ── Test 4: Aggregation ──────────────────────────────────
  console.log('▶ Test 4: Aggregation (GROUP BY status)...');
  const t4 = await measureQuery('GROUP BY status', () =>
    prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    }), 20);
  allResults.push(t4);
  console.log(`  ✓ Avg: ${t4.avg}ms | P95: ${t4.p95}ms`);

  // ── Test 5: Date range filter ────────────────────────────
  console.log('▶ Test 5: Lọc theo ngày (date range)...');
  const t5 = await measureQuery('DATE RANGE', () => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 7));
    return prisma.lead.count({
      where: { created_at: { gte: d } },
    });
  }, 20);
  allResults.push(t5);
  console.log(`  ✓ Avg: ${t5.avg}ms | P95: ${t5.p95}ms`);

  // ── Test 6: Bulk SELECT for Export ───────────────────────
  console.log('▶ Test 6: Bulk SELECT (giả lập export 10,000 rows)...');
  const exportSize = Math.min(10000, totalRecords);
  const t6 = await measureQuery(`SELECT ${exportSize.toLocaleString()} rows`, () =>
    prisma.lead.findMany({
      orderBy: { created_at: 'desc' },
      take: exportSize,
    }), 5);
  allResults.push(t6);
  console.log(`  ✓ Avg: ${t6.avg}ms | P95: ${t6.p95}ms`);

  // ── Test 7: Concurrent Writes ────────────────────────────
  console.log('▶ Test 7: Ghi đồng thời (50 concurrent INSERT)...');
  const t7 = await measureConcurrent(
    'Concurrent INSERT',
    (i) => prisma.lead.create({
      data: {
        fullname: `Stress Test ${i}`,
        phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
        source: 'Stress Test',
      },
    }),
    50, 500
  );
  allResults.push({ ...t7, name: 'Concurrent INSERT (50x)' });
  console.log(`  ✓ RPS: ${t7.rps} | Avg: ${t7.avg}ms | P95: ${t7.p95}ms`);

  // ── Test 8: Concurrent Reads ─────────────────────────────
  console.log('▶ Test 8: Đọc đồng thời (30 concurrent SELECT)...');
  const t8 = await measureConcurrent(
    'Concurrent SELECT',
    () => prisma.lead.findMany({
      orderBy: { created_at: 'desc' },
      skip: Math.floor(Math.random() * Math.max(1, totalRecords - 20)),
      take: 20,
    }),
    30, 300
  );
  allResults.push({ ...t8, name: 'Concurrent SELECT (30x)' });
  console.log(`  ✓ RPS: ${t8.rps} | Avg: ${t8.avg}ms | P95: ${t8.p95}ms`);

  // ── Test 9: Weekly aggregation (storage page query) ──────
  console.log('▶ Test 9: Weekly aggregation (raw SQL)...');
  const t9 = await measureQuery('Weekly GROUP BY', () => {
    const d = new Date();
    d.setDate(d.getDate() - 56);
    return prisma.$queryRaw`
      SELECT date_trunc('week', created_at) as week_start, COUNT(*) as count
      FROM leads
      WHERE created_at >= ${d}
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT 8
    `;
  }, 20);
  allResults.push(t9);
  console.log(`  ✓ Avg: ${t9.avg}ms | P95: ${t9.p95}ms`);

  // ── Test 10: Mixed read/write (realistic) ────────────────
  console.log('▶ Test 10: Mixed workload (read + write đồng thời)...');
  const t10 = await measureConcurrent(
    'Mixed R/W',
    async (i) => {
      if (i % 3 === 0) {
        // Write
        await prisma.lead.create({
          data: {
            fullname: `Mixed Test ${i}`,
            phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
            source: 'Mixed Test',
          },
        });
      } else {
        // Read
        await prisma.lead.findMany({
          orderBy: { created_at: 'desc' },
          take: 20,
        });
      }
    },
    40, 400
  );
  allResults.push({ ...t10, name: 'Mixed R/W (40 concurrent)' });
  console.log(`  ✓ RPS: ${t10.rps} | Avg: ${t10.avg}ms | P95: ${t10.p95}ms`);

  // ── Report ───────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                 📊 KẾT QUẢ DB STRESS TEST                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📊 Tổng bản ghi: ${totalRecords.toLocaleString()}`);
  console.log(`📅 Thời điểm: ${new Date().toLocaleString('vi-VN')}`);
  console.log('');
  console.log('┌───────────────────────────────────┬────────┬────────┬────────┬────────┐');
  console.log('│ Test                              │ Avg    │ P50    │ P95    │ Max    │');
  console.log('├───────────────────────────────────┼────────┼────────┼────────┼────────┤');

  for (const r of allResults) {
    const name = (r.name || '').padEnd(33);
    const avg = `${r.avg}ms`.padStart(6);
    const p50 = `${r.p50}ms`.padStart(6);
    const p95 = `${r.p95}ms`.padStart(6);
    const max = `${r.max}ms`.padStart(6);
    console.log(`│ ${name} │ ${avg} │ ${p50} │ ${p95} │ ${max} │`);
  }

  console.log('└───────────────────────────────────┴────────┴────────┴────────┴────────┘');

  // Bottleneck analysis
  console.log('');
  console.log('═══ 🔍 PHÂN TÍCH BOTTLENECK ═══');
  console.log('');

  const searchResult = allResults.find(r => r.name?.includes('SEARCH'));
  const bulkResult = allResults.find(r => r.name?.includes('SELECT') && r.name?.includes('rows'));
  const concWrite = allResults.find(r => r.name?.includes('Concurrent INSERT'));
  const concRead = allResults.find(r => r.name?.includes('Concurrent SELECT'));

  if (searchResult?.p95 > 500) {
    console.log('🔴 Tìm kiếm chậm (P95 > 500ms). Cần thêm index hoặc dùng Full-Text Search.');
  } else {
    console.log('🟢 Tìm kiếm nhanh.');
  }

  if (bulkResult?.p95 > 5000) {
    console.log('🔴 Export chậm (> 5s). Cần tăng RAM cho DB hoặc giới hạn batch export.');
  } else {
    console.log('🟢 Export hiệu năng tốt.');
  }

  if (concWrite?.rps < 100) {
    console.log('🔴 Write throughput thấp (< 100 RPS). Cần tăng connection pool / CPU.');
  } else if (concWrite?.rps < 500) {
    console.log('🟡 Write throughput trung bình. Đủ cho 100k/ngày nhưng sát giới hạn.');
  } else {
    console.log('🟢 Write throughput cao. Dư sức xử lý 150k leads/ngày.');
  }

  if (concRead?.rps < 50) {
    console.log('🔴 Read throughput thấp. Admin dashboard có thể chậm khi data lớn.');
  } else {
    console.log('🟢 Read throughput tốt.');
  }

  // DB size estimation
  console.log('');
  console.log('═══ 💾 ƯỚC TÍNH DUNG LƯỢNG ═══');
  console.log('');
  const sizePerRecord = 500; // bytes
  console.log(`│ Thời gian │ Bản ghi        │ Dung lượng   │ Gói phù hợp        │`);
  console.log(`├───────────┼────────────────┼──────────────┼────────────────────┤`);
  const estimates = [
    { label: '1 ngày ', count: 150000 },
    { label: '1 tuần ', count: 1050000 },
    { label: '2 tuần ', count: 2100000 },
    { label: '1 tháng', count: 4500000 },
    { label: '3 tháng', count: 13500000 },
  ];
  for (const e of estimates) {
    const sizeMB = Math.round((e.count * sizePerRecord) / (1024 * 1024));
    const sizeStr = sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB} MB`;
    let tier = sizeMB < 500 ? 'Free/Hobby' : sizeMB < 2048 ? 'Basic ($10-20)' : sizeMB < 8192 ? 'Pro ($25-50)' : 'Enterprise ($100+)';
    console.log(`│ ${e.label}   │ ${e.count.toLocaleString().padStart(14)} │ ${sizeStr.padStart(12)} │ ${tier.padEnd(18)} │`);
  }
  console.log('');
  console.log('💡 Với quy trình dọn dẹp mỗi 1-2 tuần, DB luôn giữ ≤ 1 GB → Gói Basic đủ dùng!');
  console.log('');

  // Cleanup test data
  const cleanedUp = await prisma.lead.deleteMany({
    where: { source: { in: ['Stress Test', 'Mixed Test'] } },
  });
  console.log(`🧹 Đã dọn dẹp ${cleanedUp.count} bản ghi test.`);
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
