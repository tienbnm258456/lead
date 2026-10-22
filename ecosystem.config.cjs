// ─────────────────────────────────────────────────────────────────────────────
// PM2 Ecosystem Config
//
// Giải quyết 3 vấn đề khi chạy PM2 trên production (IP, chưa có domain):
//
// 1. PM2 KHÔNG tự load .env → Secrets được load từ .env.production
// 2. PM2 mặc định output log bị buffer → console.log không hiện real-time
//    → Sử dụng merge_logs: true
// 3. CORS khi dùng IP → Không cần xử lý vì Next.js API routes trên cùng
//    origin không bị CORS.
//
// Cách dùng:
//   1. Tạo file .env.production với secrets thật (xem .env.example)
//   2. pm2 start ecosystem.config.cjs --env production
//   3. pm2 logs lead-admin --lines 100
//   4. pm2 restart lead-admin
//
// ── Quản lý log (QUAN TRỌNG) ───────────────────────────────────────────
// Log PM2 nằm ở: ~/.pm2/logs/
// Cài pm2-logrotate để tự động rotate + dọn log:
//
//   pm2 install pm2-logrotate
//   pm2 set pm2-logrotate:max_size 10M        # rotate khi file đạt 10MB
//   pm2 set pm2-logrotate:retain 7            # giữ tối đa 7 file cũ
//   pm2 set pm2-logrotate:compress true       # nén file cũ (.gz)
//   pm2 set pm2-logrotate:workerInterval 30   # check mỗi 30 giây
//   pm2 set pm2-logrotate:rotateInterval '0 0 * * 0'  # rotate mỗi CN 00:00
//
// Xem log thủ công:
//   pm2 logs lead-admin --lines 200
//
// Xóa toàn bộ log thủ công:
//   pm2 flush
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Load production secrets from .env.production (gitignored) ────────────
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const env = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const prodSecrets = loadEnvFile('.env.production');

module.exports = {
  apps: [
    {
      name: 'lead-admin',
      // Chạy next start (production server)
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: './',

      // ── Logging ───────────────────────────────────────────────────
      // Dùng log mặc định của PM2 (~/.pm2/logs/)
      // pm2-logrotate sẽ tự quản lý rotate + cleanup
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // ── Node.js args ──────────────────────────────────────────────
      // --max-http-header-size: tăng giới hạn header (hữu ích cho cookie lớn)
      node_args: '--max-http-header-size=16384',

      // ── Environment Variables ──────────────────────────────────────
      // PM2 KHÔNG đọc .env file → secrets được load từ .env.production
      //
      // Dùng --env production khi start:
      //   pm2 start ecosystem.config.cjs --env production
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,

        // ── Secrets (loaded from .env.production) ──────────────────
        // H3 Fix: Secrets KHÔNG hardcode ở đây nữa.
        // Tạo file .env.production trên server với nội dung thật.
        // (Xem .env.example để biết format)
        ...prodSecrets,

        // ── Non-secret defaults (có thể override bởi .env.production) ──
        CLEANUP_CRON_HOUR: prodSecrets.CLEANUP_CRON_HOUR || '23',
        SHEETS_EXPORT_MONTHS: prodSecrets.SHEETS_EXPORT_MONTHS || '2,4,6,8,10,12',
        ORDER_PREFIX: prodSecrets.ORDER_PREFIX || 'LDP-',
      },

      // ── Process Management ─────────────────────────────────────────
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,

      // Tự restart nếu app dùng quá 512MB RAM (tránh memory leak)
      max_memory_restart: '512M',

      // ── Graceful Shutdown ──────────────────────────────────────────
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
