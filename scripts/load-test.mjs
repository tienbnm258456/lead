/**
 * ============================================================
 * LOAD TEST - Kiểm tra hiệu năng Server + Database
 * ============================================================
 * Mục đích: Giả lập traffic thực tế để xác định cần thuê
 *           server với cấu hình nào cho 100k-150k leads/ngày
 *
 * Chạy:   node scripts/load-test.mjs [base_url]
 * Ví dụ:  node scripts/load-test.mjs http://localhost:3000
 * ============================================================
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// ─── Config ────────────────────────────────────────────────
const SCENARIOS = {
  // Scenario 1: Tải từ Landing Page (ghi liên tục)
  write: {
    name: '📝 Ghi Lead mới (POST /api/leads)',
    concurrent: 50,       // 50 users đồng thời
    totalRequests: 500,    // Tổng requests
  },
  // Scenario 2: Admin đọc danh sách (đọc phân trang)
  read: {
    name: '📖 Đọc danh sách (GET /api/leads)',
    concurrent: 20,
    totalRequests: 200,
  },
  // Scenario 3: Admin tìm kiếm (truy vấn phức tạp)
  search: {
    name: '🔍 Tìm kiếm (GET /api/leads?search=...)',
    concurrent: 10,
    totalRequests: 100,
  },
  // Scenario 4: Xuất Excel (tải nặng CPU + Memory)
  export: {
    name: '📊 Xuất Excel (POST /api/leads/export)',
    concurrent: 3,        // Ít hơn vì rất nặng
    totalRequests: 5,
  },
  // Scenario 5: Mixed workload (thực tế nhất)
  mixed: {
    name: '🔀 Mixed Workload (70% write, 20% read, 10% search)',
    concurrent: 30,
    totalRequests: 300,
  },
};

// ─── Helpers ───────────────────────────────────────────────
const randomNames = ['Nguyen Van A', 'Tran Thi B', 'Le Van C', 'Pham Minh D', 'Hoang Duc E'];
const randomPhones = () => '09' + Math.floor(10000000 + Math.random() * 90000000);

function randomLeadPayload() {
  return {
    fullname: randomNames[Math.floor(Math.random() * randomNames.length)] + ' ' + Math.floor(Math.random() * 10000),
    phone: randomPhones(),
    email: `test${Math.floor(Math.random() * 999999)}@gmail.com`,
    source: 'Landing Page',
    utm_source: 'load_test',
    utm_medium: 'stress',
  };
}

// ─── Core Request Runner ───────────────────────────────────
async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });
    const elapsed = performance.now() - start;
    const ok = res.status >= 200 && res.status < 400;
    return { ok, status: res.status, elapsed, error: null };
  } catch (err) {
    const elapsed = performance.now() - start;
    return { ok: false, status: 0, elapsed, error: err.message };
  }
}

// ─── Scenario Runners ──────────────────────────────────────
async function runWriteTest(config) {
  const results = [];
  let completed = 0;

  async function worker() {
    while (completed < config.totalRequests) {
      const idx = completed++;
      if (idx >= config.totalRequests) break;

      const result = await timedFetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(randomLeadPayload()),
      });
      results.push(result);
    }
  }

  const workers = Array.from({ length: config.concurrent }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runReadTest(config) {
  const results = [];
  let completed = 0;

  async function worker() {
    while (completed < config.totalRequests) {
      const idx = completed++;
      if (idx >= config.totalRequests) break;

      const page = Math.floor(Math.random() * 50) + 1;
      const result = await timedFetch(
        `${BASE_URL}/api/leads?page=${page}&pageSize=20&sortBy=created_at&sortOrder=desc`
      );
      results.push(result);
    }
  }

  const workers = Array.from({ length: config.concurrent }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runSearchTest(config) {
  const results = [];
  let completed = 0;
  const searchTerms = ['Nguyen', 'Tran', 'Le', '091', '090', 'gmail', 'facebook'];

  async function worker() {
    while (completed < config.totalRequests) {
      const idx = completed++;
      if (idx >= config.totalRequests) break;

      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      const result = await timedFetch(
        `${BASE_URL}/api/leads?search=${term}&page=1&pageSize=20`
      );
      results.push(result);
    }
  }

  const workers = Array.from({ length: config.concurrent }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runExportTest(config) {
  const results = [];
  let completed = 0;

  async function worker() {
    while (completed < config.totalRequests) {
      const idx = completed++;
      if (idx >= config.totalRequests) break;

      const result = await timedFetch(`${BASE_URL}/api/leads/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: {} }),
      });
      results.push(result);
    }
  }

  const workers = Array.from({ length: config.concurrent }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runMixedTest(config) {
  const results = [];
  let completed = 0;

  async function worker() {
    while (completed < config.totalRequests) {
      const idx = completed++;
      if (idx >= config.totalRequests) break;

      const rand = Math.random();
      let result;

      if (rand < 0.7) {
        // 70% writes
        result = await timedFetch(`${BASE_URL}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(randomLeadPayload()),
        });
        result.type = 'WRITE';
      } else if (rand < 0.9) {
        // 20% reads
        const page = Math.floor(Math.random() * 50) + 1;
        result = await timedFetch(
          `${BASE_URL}/api/leads?page=${page}&pageSize=20&sortBy=created_at&sortOrder=desc`
        );
        result.type = 'READ';
      } else {
        // 10% searches
        const terms = ['Nguyen', 'Tran', '091', 'gmail'];
        result = await timedFetch(
          `${BASE_URL}/api/leads?search=${terms[Math.floor(Math.random() * terms.length)]}&page=1&pageSize=20`
        );
        result.type = 'SEARCH';
      }

      results.push(result);
    }
  }

  const workers = Array.from({ length: config.concurrent }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Statistics Calculator ─────────────────────────────────
function calcStats(results, scenarioName) {
  const successful = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const times = successful.map((r) => r.elapsed).sort((a, b) => a - b);

  if (times.length === 0) {
    return { scenarioName, total: results.length, success: 0, failed: results.length, note: 'ALL FAILED' };
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const min = times[0];
  const max = times[times.length - 1];

  return {
    scenarioName,
    total: results.length,
    success: successful.length,
    failed: failed.length,
    errorRate: ((failed.length / results.length) * 100).toFixed(1) + '%',
    avg: Math.round(avg),
    p50: Math.round(p50),
    p95: Math.round(p95),
    p99: Math.round(p99),
    min: Math.round(min),
    max: Math.round(max),
  };
}

// ─── Report Generator ──────────────────────────────────────
function printReport(allStats, totalDuration) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 BÁO CÁO LOAD TEST                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Server: ${BASE_URL}`);
  console.log(`⏱  Tổng thời gian: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`📅 Thời điểm: ${new Date().toLocaleString('vi-VN')}`);
  console.log('');

  for (const stats of allStats) {
    console.log(`─── ${stats.scenarioName} ───`);

    if (stats.note) {
      console.log(`   ⚠️  ${stats.note}`);
      continue;
    }

    console.log(`   Requests:  ${stats.total} total | ${stats.success} ok | ${stats.failed} lỗi (${stats.errorRate})`);
    console.log(`   Avg:       ${stats.avg}ms`);
    console.log(`   P50:       ${stats.p50}ms  |  P95: ${stats.p95}ms  |  P99: ${stats.p99}ms`);
    console.log(`   Min/Max:   ${stats.min}ms / ${stats.max}ms`);

    // Health indicator
    if (stats.p95 < 200) console.log(`   Rating:    🟢 XUẤT SẮC`);
    else if (stats.p95 < 500) console.log(`   Rating:    🟡 TỐT`);
    else if (stats.p95 < 1000) console.log(`   Rating:    🟠 CHẤP NHẬN ĐƯỢC`);
    else if (stats.p95 < 3000) console.log(`   Rating:    🔴 CHẬM`);
    else console.log(`   Rating:    ❌ QUÁ CHẬM - Cần nâng cấp server`);

    console.log('');
  }

  // Recommendations
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('💡 KHUYẾN NGHỊ CẤU HÌNH SERVER');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Dựa trên 100k-150k leads/ngày (~1,700 leads/giây peak):');
  console.log('');
  console.log('┌──────────────┬────────────┬────────────┬──────────────────────┐');
  console.log('│ Gói          │ CPU        │ RAM        │ Phù hợp khi          │');
  console.log('├──────────────┼────────────┼────────────┼──────────────────────┤');
  console.log('│ Starter      │ 1 vCPU     │ 1 GB       │ Dev/Test             │');
  console.log('│ Basic        │ 2 vCPU     │ 2 GB       │ < 50k leads/ngày     │');
  console.log('│ Standard ✅  │ 2 vCPU     │ 4 GB       │ 100k-150k leads/ngày │');
  console.log('│ Pro          │ 4 vCPU     │ 8 GB       │ > 200k + export nặng │');
  console.log('└──────────────┴────────────┴────────────┴──────────────────────┘');
  console.log('');
  console.log('📦 PostgreSQL:');
  console.log('   Supabase Pro ($25/mo)   - 8 GB, auto-backup, đủ dùng');
  console.log('   Neon Scale ($19/mo)     - 10 GB, serverless, auto-scale');
  console.log('   VPS tự host ($10/mo)    - DigitalOcean 2GB, quản lý thủ công');
  console.log('');
  console.log('🌐 Application Server:');
  console.log('   Vercel Pro ($20/mo)     - Auto-scale, zero config');
  console.log('   Railway ($5+/mo)        - Pay-per-use, dễ dùng');
  console.log('   VPS ($5-10/mo)          - DigitalOcean/Vultr, tự quản lý');
  console.log('');
  console.log('🔑 Domain: $10-15/năm (.com) hoặc ~300k VND/năm (.vn)');
  console.log('');
  console.log('💰 TỔNG CHI PHÍ ƯỚC TÍNH:');
  console.log('   Tiết kiệm: VPS $10/mo + self-host PG     = ~$10/tháng');
  console.log('   Cân bằng:  Vercel + Supabase              = ~$45/tháng');
  console.log('   Premium:   Vercel Pro + Neon + Monitoring  = ~$70/tháng');
  console.log('');
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          ⚡ LOAD TEST - Lead Admin System                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log('');

  // Health check
  console.log('🔌 Kiểm tra kết nối...');
  const health = await timedFetch(`${BASE_URL}/api/leads?page=1&pageSize=1`);
  if (!health.ok) {
    console.error('❌ Không thể kết nối đến server! Hãy chắc chắn server đang chạy.');
    console.error(`   URL: ${BASE_URL}`);
    console.error(`   Error: ${health.error || `HTTP ${health.status}`}`);
    process.exit(1);
  }
  console.log(`✅ Server online (${Math.round(health.elapsed)}ms)`);
  console.log('');

  const allStats = [];
  const overallStart = Date.now();

  // Run each scenario
  const runners = [
    { key: 'write', fn: runWriteTest },
    { key: 'read', fn: runReadTest },
    { key: 'search', fn: runSearchTest },
    { key: 'export', fn: runExportTest },
    { key: 'mixed', fn: runMixedTest },
  ];

  for (const { key, fn } of runners) {
    const config = SCENARIOS[key];
    console.log(`▶ ${config.name}`);
    console.log(`  Concurrent: ${config.concurrent} | Total: ${config.totalRequests} requests`);

    const start = Date.now();
    const results = await fn(config);
    const duration = Date.now() - start;

    const stats = calcStats(results, config.name);
    stats.rps = Math.round((stats.success / duration) * 1000);
    allStats.push(stats);

    console.log(`  ✓ Xong trong ${(duration / 1000).toFixed(1)}s | RPS: ${stats.rps} | P95: ${stats.p95 || 'N/A'}ms`);
    console.log('');
  }

  const totalDuration = Date.now() - overallStart;
  printReport(allStats, totalDuration);
}

main().catch(console.error);
