# Google Sheets: file theo năm, tab theo tháng và sản phẩm

## Kết quả sau khi cấu hình

Chỉ dùng một Apps Script và một URL /exec cố định. Script tự tạo file khi nhận đơn đầu tiên của mỗi năm:

~~~text
Thư mục Google Drive: Lead Admin Archives
├─ Lead Admin - 2026
│  ├─ 2026-11_Dai-lung
│  └─ 2026-12_Kem
└─ Lead Admin - 2027
   └─ 2027-01_Dai-lung
~~~

- Năm/tháng lấy theo ngày tạo đơn và SHEETS_EXPORT_TIMEZONE, không lấy ngày job chạy.
- Tên tab từ tên sản phẩm, bỏ dấu và thay khoảng trắng bằng dấu gạch nối.
- Hai sản phẩm khác ID/slug nhưng trùng tên: tab thứ hai thêm hậu tố mã ngắn. Sau khi đăng ký, tên tab giữ ổn định kể cả đổi tên sản phẩm.
- Tất cả combo của một đơn nằm cùng tab sản phẩm. Mỗi combo một dòng. Tổng đơn chỉ ở dòng đầu, giá giữ UZS đầy đủ.
- Cột A là tên khách, không còn bị thay bằng STT. Không bổ sung cột STT vào dữ liệu.
- Cột Q (_ExportRowId) bị ẩn, dùng chống ghi trùng khi gửi lại. Không sửa/xóa cột hoặc khóa dòng này.
- 16 cột A–P: Tên, SĐT, E-mail, Đăng ký email, Ngày đặt, Mã đơn, Loại sản phẩm, Trạng thái CRM, Gói, Số lượng, Đơn giá, Ship, Tổng đơn, Địa chỉ, Thanh toán, Ghi chú.

## 1. Tạo thư mục Google Drive (một lần)

1. Đăng nhập tài khoản Google sẽ sở hữu các file xuất.
2. Vào Google Drive → Mới → Thư mục. Đặt tên Lead Admin Archives.
3. Mở thư mục. URL ví dụ: https://drive.google.com/drive/folders/ABC123.
4. Sao chép phần ABC123, đây là EXPORT_FOLDER_ID.
5. Chia sẻ thư mục cho nhân viên cần xem/chỉnh sửa nếu cần; không phải công khai file cho bất kỳ ai.

Không cần tạo trước từng file năm hoặc từng tab. Thư mục My Drive do tài khoản triển khai sở hữu là cách cấu hình đơn giản nhất.

## 2. Tạo hoặc cập nhật Apps Script (một lần)

### Nếu chưa có script

1. Mở https://script.google.com và chọn Dự án mới.
2. Đặt tên Lead Admin Annual Export.
3. Mở Code.gs, xóa nội dung mẫu.
4. Copy toàn bộ src/lib/google-apps-script.js của project vào Code.gs và lưu.

### Nếu đã dùng Apps Script cũ trong Google Sheets

1. Mở file Sheets cũ → Extensions / Tiện ích mở rộng → Apps Script.
2. Thay toàn bộ Code.gs bằng src/lib/google-apps-script.js mới và lưu.
3. Giữ nguyên project Apps Script này để URL triển khai và các Script Properties được dùng lại.

Script mới không phụ thuộc file Sheets đang mở. Các file/tab cũ vẫn giữ nguyên; script không tự chuyển dữ liệu cũ sang cấu trúc năm mới và không phục hồi được tên khách đã bị ghi đè trong quá khứ.

## 3. Thiết lập Script Properties

Trong Apps Script → Project Settings / Cài đặt dự án (biểu tượng bánh răng) → Script Properties → Add script property:

| Property | Giá trị | Bắt buộc |
|---|---|---|
| EXPORT_FOLDER_ID | ID thư mục ở bước 1 | Có |
| EXPORT_SECRET | Chuỗi bí mật ngẫu nhiên, dùng giống bên server | Có |
| EXPORT_FILE_PREFIX | Lead Admin | Không; mặc định Lead Admin |

Có thể tạo secret trên terminal local, rồi copy cùng giá trị vào hai nơi:

~~~bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
~~~

Không đưa secret thật vào Git. Không điền ID file spreadsheet vào EXPORT_FOLDER_ID.

Không tự xóa các thuộc tính YEAR_SPREADSHEET_2026, YEAR_SPREADSHEET_2027, TAB_... mà script tự sinh. Chúng lưu ánh xạ năm → file và sản phẩm → tab. Không đổi project Apps Script mỗi năm.

## 4. Cấp quyền và kiểm tra cấu hình

1. Trong editor, chọn hàm checkSetup từ dropdown cạnh Run.
2. Bấm Run / Chạy.
3. Chọn Review permissions / Xem lại quyền, đăng nhập đúng tài khoản sở hữu thư mục và cấp quyền Sheets/Drive.
4. Nếu gặp cảnh báo ứng dụng chưa xác minh, chỉ tiếp tục với project do chính bạn tạo và đã kiểm tra code; tài khoản Workspace có thể cần quản trị viên cho phép.
5. Execution log phải có Setup OK và tên thư mục đúng.

checkSetup chỉ kiểm tra quyền/cấu hình, chưa tạo file năm hoặc gửi đơn.

## 5. Deploy Web App

### Triển khai mới

1. Deploy → New deployment → chọn loại Web app.
2. Execute as: Me (tài khoản của bạn).
3. Who has access: Anyone, để server gọi được không cần phiên đăng nhập Google. Request vẫn phải có secret đã cấu hình.
4. Deploy, chấp nhận quyền nếu được yêu cầu.
5. Copy Web app URL kết thúc bằng /exec; không dùng /dev.

Nếu tổ chức không cho phép Anyone, cần quản trị viên cho phép hoặc dùng kiến trúc xác thực khác; server hiện không hỗ trợ đăng nhập Google tương tác.

### Cập nhật deployment đang có, giữ URL

Deploy → Manage deployments → chọn deployment Web App → Edit (bút chì) → Version: New version → Deploy. Chỉ Save code không cập nhật phiên bản /exec đã deploy.

Không cần tạo trigger Google theo giờ: app Next.js chủ động gọi Web App.

## 6. Cấu hình môi trường code

### Local

Thêm vào .env.local (hoặc .env), tránh khai báo trùng khác giá trị:

~~~dotenv
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_APPS_SCRIPT_SECRET=CHUOI_GIONG_EXPORT_SECRET_TREN_GOOGLE
SHEETS_EXPORT_TIMEZONE=Asia/Bangkok
GOOGLE_SHEETS_SOURCE=lead-admin-local
CRON_SECRET=CHUOI_BI_MAT_RIENG_CHO_API_CRON
~~~

GOOGLE_SHEETS_SOURCE phải cố định, khác giữa các app/database nếu dùng chung thư mục. Đổi source sau khi đã xuất có thể làm dữ liệu cũ được ghi lại thành dòng mới.

Restart server sau khi sửa env. Trong npm run dev, đặt SHEETS_EXPORT_INTERVAL_MINUTES=5 để bật job Sheets: lần đầu sau khoảng 15 giây, sau đó mỗi 5 phút; nếu không đặt interval hợp lệ thì dev không chạy lịch ngày. CLEANUP_INTERVAL_MINUTES chỉ bật job cleanup riêng khi được cấu hình. Không cần đổi URL, secret hay code khi đổi năm.

### Production / PM2

Đặt các biến tương tự trong .env.production trên VPS, thay GOOGLE_SHEETS_SOURCE bằng lead-admin-production. Dùng tài khoản Google/thư mục riêng cho test nếu muốn tách hẳn dữ liệu thử.

~~~dotenv
NODE_ENV=production
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_APPS_SCRIPT_SECRET=CHUOI_GIONG_EXPORT_SECRET_TREN_GOOGLE
SHEETS_EXPORT_TIMEZONE=Asia/Bangkok
GOOGLE_SHEETS_SOURCE=lead-admin-production
CRON_SECRET=CHUOI_BI_MAT_RIENG_CHO_API_CRON
SHEETS_EXPORT_MONTHS=2,4,6,8,10,12
TZ=Asia/Bangkok
~~~

TZ quyết định giờ của scheduler hiện tại. SHEETS_EXPORT_TIMEZONE quyết định năm/tháng và ngày hiển thị trên file; nên để giống nhau.

~~~bash
npm run build
pm2 restart ecosystem.config.cjs --env production --update-env
~~~

Không copy nguyên dòng placeholder vào môi trường thật. Không cần migration database cho thay đổi xuất Sheets này.

## 7. Test mà không xuất/xóa đơn thật

### Kiểm thử tự động không gọi Google

~~~bash
node --test scripts/test-sheets.cjs
~~~

### Gửi dữ liệu mẫu lên Google đã cấu hình

Nên cấu hình một project Apps Script + thư mục test trước. Từ thư mục gốc project:

~~~bash
node scripts/sheets-smoke-test.cjs --send
~~~

Script này kiểm tra kết nối rồi gửi ba đơn giả, mỗi đơn hai dòng. Không đọc database, không gọi API cron, không xóa đơn thật. Nó tạo hai file 2026/2027 trong thư mục Google đã cấu hình:

| Ngày tạo đơn mẫu | File | Tab | Dòng |
|---|---|---|---|
| 15/11/2026 | Lead Admin - 2026 | 2026-11_Mau-dai-lung | 2 |
| 15/12/2026 | Lead Admin - 2026 | 2026-12_Mau-kem | 2 |
| 15/01/2027 | Lead Admin - 2027 | 2027-01_Mau-dai-lung | 2 |

Kiểm tra cột A còn tên KHÁCH THỬ NGHIỆM, cột B còn số 0 đầu, các giá 299000/529000 và tổng đơn 878000 chỉ xuất dòng đầu. Chạy lại lệnh phải không thêm dòng trùng.

Nếu test xong cần xóa file mẫu, dùng project/thư mục test riêng; không xóa file đã đăng ký trong script production. Script sẽ báo lỗi nếu file năm đã đăng ký bị xóa/mất quyền thay vì âm thầm tạo file rỗng thay thế.

## 8. Luồng thật và giới hạn hiện hữu

- Backend chia dữ liệu theo năm/tháng/ngày đặt và sản phẩm; Apps Script tự tạo file theo năm, tab theo nhóm. Có khóa ngăn hai request tạo file cùng lúc trong cùng project Script.
- Batch giới hạn 5000 dòng thực tế và không chia đôi một đơn. Chỉ đánh dấu đơn sau phản hồi v2 xác nhận đúng số dòng và đích nhận.
- Script cũ chưa cập nhật sẽ không được backend coi là xuất thành công. Cần cập nhật Google trước khi bật lại job code mới.
- Dòng trùng được nhận biết bằng cột Q. Gửi lại là bỏ qua dòng đã có, không cập nhật sửa đổi của đơn cũ. Không di chuyển/sửa các dòng đã xuất nếu còn cần retry.
- Đổi năm chỉ tạo file khi có dữ liệu của năm đó. Đơn năm cũ xuất muộn vẫn về file năm cũ.
- Lịch tháng và cơ chế xóa đơn sau khi xuất thành công của API cron vẫn giữ nguyên. Chạy API cron thật có thể xóa đơn và log CRM khỏi database. SHEETS_EXPORT_INTERVAL_MINUTES là chế độ quét thật, không phải dry-run.
- Các vấn đề lịch tháng đã phân tích (dấu tháng nằm trong đơn bị xóa; batch lỗi có thể bị điều kiện đã xuất tháng này chặn) chưa được thiết kế lại trong thay đổi này.
- Google Drive dung lượng/quota vẫn áp dụng. Quá quota/mất quyền sẽ báo lỗi và không đánh dấu batch đó thành công.
- Chưa tự chuyển bản xuất cũ hay sửa tên đã mất. Cần đối chiếu backup/dữ liệu nguồn nếu muốn phục hồi.

## 9. Xử lý lỗi thường gặp

| Thông báo / hiện tượng | Cách kiểm tra |
|---|---|
| Thiếu URL hoặc secret | Kiểm tra env hiệu lực và restart app |
| Unauthorized | GOOGLE_APPS_SCRIPT_SECRET phải giống EXPORT_SECRET, không có khoảng trắng dư |
| Expected protocolVersion / chưa cập nhật v2 | Copy code mới, Deploy New version vào deployment đang dùng |
| File/folder không tồn tại hoặc mất quyền | Kiểm tra EXPORT_FOLDER_ID, tài khoản triển khai và ánh xạ YEAR_SPREADSHEET_* |
| Header mismatch | Tab có layout khác; không sửa/xóa tùy tiện vì có thể mất chống trùng |
| Không có file năm mới | Chưa nhận dữ liệu năm đó hoặc job chưa đến tháng chạy |
| Tên tab có hậu tố | Hai sản phẩm khác slug có cùng tên hiển thị; hệ thống tách để không trộn |

## Tài liệu Google tham khảo

- Web App deployment: https://developers.google.com/apps-script/guides/web
- Script Properties: https://developers.google.com/apps-script/reference/properties/properties-service
- Drive moveTo: https://developers.google.com/apps-script/reference/drive/file#movetodestination

## Khôi phục format cho file đã xuất

Sau khi copy code Apps Script mới, chọn hàm reformatAllYearFiles trong editor và bấm Run một lần. Hàm áp dụng format cho các tab archive đã đăng ký: header xanh/căn giữa/xuống dòng, độ rộng 16 cột, kẻ bảng/nền xen kẽ, trạng thái cột H màu xanh (thành công), đỏ (lỗi), cam (chờ), tím (timeout). Không sửa giá trị, không xuất lại và không thêm dòng. Sau đó Deploy → Manage deployments → Edit → New version → Deploy để các lần xuất tiếp theo tự có format.
