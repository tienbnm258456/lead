// ─────────────────────────────────────────────────────────────────────────────
// PM2 Ecosystem Config
//
// Giải quyết 3 vấn đề khi chạy PM2 trên production (IP, chưa có domain):
//
// 1. PM2 KHÔNG tự load .env → Phải khai báo env_production ở đây
// 2. PM2 mặc định output log bị buffer → console.log không hiện real-time
//    → Sử dụng merge_logs: true
// 3. CORS khi dùng IP → Không cần xử lý vì Next.js API routes trên cùng
//    origin không bị CORS.
//
// Cách dùng:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 logs lead-admin --lines 100
//   pm2 restart lead-admin
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
      // PM2 KHÔNG đọc .env file → phải khai báo env ở đây
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

        // Database
        DATABASE_URL: 'postgresql://postgres:123456@localhost:5433/lead_admin?schema=public',

        // RetailCRM
        RETAILCRM_BASE_URL: 'https://uzshopping.retailcrm.ru/api/v5',
        RETAILCRM_API_KEY: 'Um9xgLlLFkl7A59fX2c37ciGFtE5x94X',
        RETAILCRM_SITE: 'uzshopping',

        // Cleanup
        CLEANUP_CRON_HOUR: '23',

        // Google Sheets Export
        GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbykFQSWjsx450NxHq4kvAL-6k3-MJiYAyg9jUoFyC3c7LBJDh6_cGaYo07Q9UKes701/exec',
        SHEETS_EXPORT_MONTHS: '2,4,6,8,10,12',

        // Force HTTP mode (vì chưa có domain/SSL)
        // Bỏ dòng này khi đã có domain + HTTPS
        FORCE_HTTP: 'true',
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

