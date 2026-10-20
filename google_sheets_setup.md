# 📊 Setup Google Sheets Auto-Export

> **MIỄN PHÍ 100%** — Không cần Google Cloud Console, không cần thẻ tín dụng.
> Chỉ cần **tài khoản Google thường**.

---

## Bước 1: Tạo Google Spreadsheet

1. Vào [sheets.google.com](https://sheets.google.com/) → **Blank spreadsheet**
2. Đặt tên: `Lead Admin - Đơn hàng`

## Bước 2: Tạo Apps Script

1. Trong Spreadsheet → Menu **Extensions** → **Apps Script**
2. Xóa hết code mặc định
3. Copy toàn bộ nội dung file [`src/lib/google-apps-script.js`](file:///d:/tiennk/Dự án ngoài/project/lead/src/lib/google-apps-script.js) → Paste vào editor
4. Bấm **Save** (Ctrl+S)

## Bước 3: Deploy Web App

1. Trong Apps Script editor → **Deploy** → **New deployment**
2. Click icon ⚙️ → Chọn **Web app**
3. Cấu hình:
   - **Description**: `Lead Admin Export`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Bấm **Deploy**
5. **Authorize**: Google sẽ hỏi quyền → **Review Permissions** → Chọn tài khoản → **Advanced** → **Go to Lead Admin Export (unsafe)** → **Allow**
6. **Copy URL** (dạng `https://script.google.com/macros/s/AKfycbx.../exec`)

## Bước 4: Cấu hình .env

Mở [`.env`](file:///d:/tiennk/Dự án ngoài/project/lead/.env) và uncomment + paste URL:

```bash
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbx.../exec
```

**Done!** Restart server → Job sẽ tự chạy.

---

## Test nhanh

Uncomment dòng này trong `.env` → restart server:

```bash
SHEETS_EXPORT_INTERVAL_MINUTES=5
```

Job sẽ chạy mỗi 5 phút. Sau khi test xong, comment lại.

---

## Kiến trúc

```
┌─ Server (Next.js) ──────────────────────────────────────────────┐
│                                                                  │
│  instrumentation.ts                                              │
│  └── Cron: mỗi 2 tháng (hoặc N phút test)                      │
│      └── GET /api/cron/export-sheets                             │
│          └── google-sheets.ts                                    │
│              └── POST → Apps Script Web App URL                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─ Google Apps Script (miễn phí) ──────────────────────────────────┐
│                                                                  │
│  doPost(e)                                                       │
│  ├── action: "ping"  → Kiểm tra kết nối                        │
│  └── action: "export" → Tạo Sheet tab mới + Ghi data            │
│      ├── Batch 1: 5,000 rows (tạo sheet + header)               │
│      ├── Batch 2: 5,000 rows (append)                            │
│      └── Batch N: còn lại (append + format)                      │
│                                                                  │
│  Kết quả:                                                        │
│  ├── Tab "Đơn hàng T8-T10/2026"  (72,000 rows)                 │
│  ├── Tab "Đơn hàng T10-T12/2026" (80,000 rows)                 │
│  └── Tab "Đơn hàng T12-T2/2027"  (65,000 rows)                 │
└──────────────────────────────────────────────────────────────────┘
```

## Files

| File | Vai trò |
|------|---------|
| [`src/lib/google-sheets.ts`](file:///d:/tiennk/Dự án ngoài/project/lead/src/lib/google-sheets.ts) | Thư viện gửi data → Apps Script |
| [`src/lib/google-apps-script.js`](file:///d:/tiennk/Dự án ngoài/project/lead/src/lib/google-apps-script.js) | **Code paste vào Google Sheets** |
| [`src/app/api/cron/export-sheets/route.ts`](file:///d:/tiennk/Dự án ngoài/project/lead/src/app/api/cron/export-sheets/route.ts) | API endpoint cho cron job |
| [`src/instrumentation.ts`](file:///d:/tiennk/Dự án ngoài/project/lead/src/instrumentation.ts) | Scheduler: 2 jobs (cleanup + export) |
| [`.env`](file:///d:/tiennk/Dự án ngoài/project/lead/.env) | Cấu hình URL + schedule |
