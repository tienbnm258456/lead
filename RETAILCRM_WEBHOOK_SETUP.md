# RetailCRM: nhận webhook và đọc trạng thái đơn

## Hai API nghiệp vụ

### POST /api/webhook/retailcrm/<secret>
Endpoint public dành cho trigger RetailCRM. Gửi URL thật riêng cho đối tác, không đăng công khai.
JSON gồm eventId, orderId, externalId, status, updatedAt; tất cả là string. Ví dụ:

```json
{"eventId":"123456-confirmed-1793770200","orderId":"123456","externalId":"ORDT-00008","status":"confirmed","updatedAt":"2026-11-04T10:30:00+05:00"}
```

- 202: đã lưu inbox, chưa có nghĩa đã cập nhật trạng thái thành công.
- 200 duplicate:true: sự kiện đã tồn tại; không tạo tác vụ trùng.
- 400 payload sai; 401 secret sai; 503 chưa cấu hình hoặc không lưu được DB, phía gửi cần retry.
- Mã status chưa biết vẫn được tiếp nhận.
- Worker không dùng status trong trigger làm trạng thái chính thức: gọi GET CRM lấy trạng thái hiện tại.

### GET /api/retailcrm/status/<externalId>
Endpoint nội bộ của ứng dụng; cần cookie đăng nhập và quyền xem đơn theo nhóm. Chỉ đọc, không cập nhật DB.
Ví dụ /api/retailcrm/status/ORDT-00008.
Response chuẩn hóa:

```json
{"success":true,"data":{"orderId":"123456","externalId":"ORDT-00008","status":"confirmed","updatedAt":"2026-11-04T10:30:00+05:00"}}
```

Không có eventId vì thao tác GET không phải sự kiện. updatedAt có thể null nếu API CRM không trả statusUpdatedAt hợp lệ.
404 nếu không có quyền/không tồn tại đơn; 502 nếu CRM lỗi hoặc response thiếu trường bắt buộc.

## API được gọi ở phía RetailCRM
GET <RETAILCRM_BASE_URL>/orders/<externalId>?apiKey=<key>&by=externalId&site=<site>
RETAILCRM_BASE_URL phải kết thúc bằng /api/v5 (giống tích hợp tạo đơn hiện tại).
Response CRM được đọc từ envelope {success:true, order:{id,externalId,status,statusUpdatedAt?}}, không phải JSON trigger.
Cần đối tác gửi mẫu response thật để xác nhận trường thời gian có xuất hiện hay không.
Tài liệu: https://docs.retailcrm.ru/developers/api/api-methods-v5/

## Cấu hình local/production
Đặt trong .env khi dev, .env.production khi chạy PM2:

```dotenv
RETAILCRM_BASE_URL=https://YOUR-ACCOUNT.retailcrm.ru/api/v5
RETAILCRM_API_KEY=KEY_WITH_ORDER_READ_PERMISSION
RETAILCRM_SITE=SITE_CODE_FROM_PARTNER
RETAILCRM_WEBHOOK_SECRET=PRIVATE_RANDOM_STRING_AT_LEAST_32_CHARACTERS
CRON_SECRET=SEPARATE_PRIVATE_CRON_SECRET
```

Tạo secret bằng: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
Không dùng prefix NEXT_PUBLIC cho secret. Dùng HTTPS. Proxy ứng dụng che secret trong log riêng; cần cấu hình reverse proxy/access log và công cụ giám sát để không ghi URL bí mật.

Chạy npx prisma migrate deploy, npx prisma generate, npm run build rồi restart PM2 --update-env.
Kiểm tra Prisma CLI và PM2 cùng database; nếu P3005, cần hoàn tất baseline database cũ trước.
Migration: 20261104110000_retailcrm_status_webhook. Local đã áp dụng, production cần tự triển khai.

## Xử lý nền và lỗi
Khi đủ RETAILCRM_WEBHOOK_SECRET và CRON_SECRET, scheduler chạy cả dev và production: lượt đầu sau 5 giây, sau đó mỗi 15 giây.
Route kỹ thuật GET /api/cron/retailcrm-status chỉ nhận header x-cron-secret bằng CRON_SECRET.
Mỗi lượt xử lý tối đa 10 sự kiện. PostgreSQL advisory transaction lock ngăn fetch/write chồng nhau giữa các PM2 process; process chết thì transaction rollback, tác vụ còn lại để chạy tiếp.
Retry tăng dần 30 giây đến tối đa 1 giờ, dừng sau 12 lần; lỗi lưu trong retailcrm_events.error. Trạng thái mới lưu orders.crm_status, thời điểm CRM ở crm_status_updated_at, thời điểm truy vấn ở crm_status_checked_at; giữ nguyên sync_status.
Không chạy Google Sheets/CRM thật trong kiểm thử tự động.

Tra sự kiện chưa thành công:
```sql
SELECT event_id, external_id, attempts, error, next_attempt_at
FROM retailcrm_events WHERE processed_at IS NULL ORDER BY received_at;
-- Sau khi xử lý nguyên nhân lỗi, có thể cho retry lại một sự kiện:
UPDATE retailcrm_events SET attempts = 0, next_attempt_at = NOW()
WHERE event_id = 'EVENT_ID_TO_RETRY' AND processed_at IS NULL;
```

## Giới hạn của bước triển khai này
- Chưa bổ sung cột trạng thái nghiệp vụ CRM trên giao diện/Excel/Google Sheets.
- Chưa sửa job xóa đơn sau xuất Sheets. Nếu đơn đã xóa, inbox giữ sự kiện và ghi lỗi Local order missing or previously purged; không tự tạo lại đơn.
- Inbox không có FK đến orders nên không mất theo thao tác xóa đơn. Chưa có chính sách tự dọn inbox.
- GET chỉ lấy trạng thái, không gửi sửa đơn hay sửa trạng thái sang phía đối tác.

## Request/response log lấy trạng thái

Mỗi lần gọi GET CRM ghi log [RetailCRM Status] REQUEST và RESPONSE, có requestId, externalId, eventId (khi chạy worker), URL che apiKey, HTTP status, thời gian xử lý và toàn bộ response body. Lỗi mạng/timeout ghi ERROR; response lỗi HTTP hoặc không phải JSON vẫn có body để kiểm tra. Xem local ở terminal npm run dev; production: pm2 logs lead-admin --lines 200. Log mới chỉ có từ sau khi triển khai thay đổi, không truy hồi response cũ; không lưu thêm response GET trong database. Response có thể chứa thông tin khách hàng nên chỉ cấp quyền log cho quản trị vận hành.

## Site cho GET trạng thái
Đặt RETAILCRM_STATUS_SITE=bigbox trong .env / .env.production. GET trạng thái ưu tiên biến này, fallback RETAILCRM_SITE khi chưa đặt. Biến RETAILCRM_SITE của luồng tạo đơn được giữ riêng. Restart ứng dụng sau khi đổi cấu hình.
