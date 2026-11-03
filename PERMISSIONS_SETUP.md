# Phân quyền ba role và nhóm dữ liệu

## Quyền đã triển khai

| Chức năng | Quản trị viên (ADMIN) | Quản lý Landing Page (ADMIN2) | Người dùng (USER) |
|---|---|---|---|
| Dashboard, xem đơn/chi tiết | Toàn bộ | Cả nhóm | Cả nhóm |
| Tạo/sửa/xóa Landing Page | Toàn bộ | Trong nhóm | Trong nhóm |
| Thêm đơn, gửi CRM khi thêm | Có | Landing Page trong nhóm | Landing Page trong nhóm |
| Sửa/xóa đơn, xóa hàng loạt | Có | Không | Không |
| Gửi lại CRM/API CRM trực tiếp | Có | Không | Không |
| Xuất Excel thủ công | Toàn bộ | Trong nhóm | Trong nhóm |
| Quản lý tài khoản cấp dưới | Quản lý Landing Page, Người dùng | Người dùng cùng nhóm | Không |
| Dung lượng/cấu hình tổng | Có | Không | Không |
| Job Google Sheets | Toàn hệ thống qua cron secret | Không có chức năng quản trị | Không có chức năng quản trị |

Phân quyền áp dụng ở backend, không chỉ ẩn nút. Người dùng và Quản lý Landing Page cùng nhóm dùng chung dữ liệu kể cả Landing Page do thành viên khác trong nhóm tạo.

## Bắt đầu trên local

Migration 20261103090000_group_permissions đã được áp dụng vào database local trong phiên triển khai. Các phiên cũ không có session_version sẽ hết hiệu lực. Restart npm run dev và đăng nhập lại.

1. Đăng nhập bằng tài khoản ADMIN hiện có (Quản trị viên).
2. Vào Tài khoản → Thêm tài khoản → chọn Quản lý Landing Page. Hệ thống tự tạo nhóm riêng cho tài khoản đó.
3. Quản trị viên tạo Người dùng và chọn nhóm, hoặc đăng nhập Quản lý Landing Page rồi tạo Người dùng. Quản lý Landing Page không thể tự chọn nhóm khác/nâng role.
4. Vào Landing Pages → Sửa Landing Page cũ → Nhóm sở hữu → chọn nhóm → Lưu.
5. Khi phân công một trang chưa gán nhóm, Product và các đơn cũ liên quan được gán cùng nhóm trong transaction.
6. Đăng nhập Người dùng cùng nhóm để kiểm tra: thấy chung Landing Page/đơn, tạo trang và thêm đơn, xuất Excel; không có nút sửa/xóa đơn, không thấy Tài khoản hay Dung lượng.
7. Đăng nhập nhóm khác: không được thấy dữ liệu nhóm trước, kể cả gọi API bằng ID/slug.

Trang Quản trị viên tạo mới có thể để nhóm trống (chỉ Quản trị viên thấy) hoặc chọn nhóm. Thành viên tạo trang luôn nhận group_id từ phiên đăng nhập, không tin giá trị do client gửi.

## Dữ liệu cũ và tài khoản cũ

- ADMIN giữ nguyên là Quản trị viên. Không tạo/sửa/xóa các ADMIN ngang cấp qua màn hình cấp dưới.
- USER giữ role USER; VIEWER cũ được chuyển thành USER vì nghiệp vụ mới chỉ có ba role. Cả hai loại cũ ban đầu chưa có nhóm nên không được xem dữ liệu hệ thống.
- Quản trị viên sửa tài khoản Người dùng để gán nhóm. Có thể chuyển tài khoản cấp dưới thành Quản lý Landing Page; hệ thống tạo nhóm riêng nếu cần.
- Landing Page, Product, Order cũ chưa phân công có group_id NULL: chỉ Quản trị viên thấy. Không tự gán toàn bộ dữ liệu cho người đầu tiên.
- Đơn cũ được liên kết landing_page_id từ landing_slug nếu tìm được Landing Page tương ứng. Đơn không xác định được trang vẫn chỉ Quản trị viên thấy.
- Quản trị viên có thể gán lại Landing Page sang nhóm khác hoặc bỏ gán nhóm. Landing Page, Product và toàn bộ đơn liên quan được chuyển cùng nhau trong transaction. Nhóm cũ mất quyền, nhóm mới được xem lịch sử; thành viên nhóm không có quyền đổi nhóm sở hữu. Bản Excel/Google đã xuất không tự thay đổi.
- Xóa Landing Page là xóa mềm: deleted_at và active=false; Product ngừng hoạt động; đơn và log CRM được giữ. Webhook API key của trang đã xóa không tiếp tục nhận đơn.
- Xóa tài khoản là khóa active=false và thu hồi phiên. Không xóa lịch sử, nhóm hoặc dữ liệu do người đó tạo. Khóa Quản lý Landing Page không tự khóa các Người dùng trong nhóm; Quản trị viên vẫn quản lý được nhóm và thành viên.

## Phiên đăng nhập

Token chứa ID user và session_version; mỗi request xác thực lại tài khoản/role/nhóm hiện tại trong database. Role/nhóm trong token cũ không được tin cậy.

- Khóa user, đặt lại mật khẩu hoặc sửa quyền sẽ làm phiên cũ không dùng được ở request tiếp theo.
- Đổi/reset mật khẩu tăng session_version, đăng xuất tất cả phiên của tài khoản đó, gồm cả máy vừa đổi; cần đăng nhập lại.
- Triển khai lần đầu cũng yêu cầu tất cả người dùng đăng nhập lại.

## Excel và Google Sheets

- Excel của Quản lý Landing Page/Người dùng chỉ lấy nhóm mình, không xóa đơn/log và không cập nhật exported_at. Vì vậy việc cấp dưới tải Excel không đánh dấu đơn cho chức năng dọn dữ liệu của Quản trị viên.
- Quản trị viên xuất Excel vẫn giữ cơ chế đánh dấu exported_at như trước.
- Job Sheets tiếp tục lấy toàn bộ đơn theo lịch và xử lý dọn database như trước. Không có bộ lọc nhóm ở cron. CRON_SECRET chỉ cấp cho người vận hành/Quản trị viên, không chia sẻ với cấp dưới.
- Quyền Google Drive độc lập với quyền trong app: chỉ chia sẻ thư mục/file lưu trữ tổng cho Quản trị viên.

## Triển khai production

1. Sao lưu PostgreSQL theo quy trình hiện tại.
2. Đưa source và migration mới lên VPS.
3. Dừng app trong lúc migration, vì schema role và phiên đăng nhập thay đổi.

~~~bash
pm2 stop lead-admin
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart ecosystem.config.cjs --env production --update-env
~~~

Nếu migration/build lỗi, xử lý lỗi trước khi khởi động bản mới; không reset database. Không cần đổi AUTH_SECRET hay cấu hình lại Apps Script. Không chạy seed trên production.

4. Đăng nhập lại Quản trị viên, tạo Quản lý Landing Page/nhóm, phân công Người dùng và Landing Page cũ theo các bước local.
5. Kiểm tra bằng hai nhóm riêng trước khi bàn giao.

## Kiểm thử

~~~bash
node --test scripts/test-permissions.cjs scripts/test-ladipage.cjs scripts/test-sheets.cjs scripts/test-background-jobs.cjs
npx tsc --noEmit
~~~

Test tích hợp database chỉ cho localhost/127.0.0.1, tạo fixture trong transaction và rollback tất cả, mock CRM để không gửi đơn thật:

~~~bash
node scripts/test-permissions-db.cjs
~~~

Các test kiểm tra scope, IDOR qua order/page IDs, nâng quyền, giả group_id, xóa mềm giữ lịch sử, Excel không lộ nhóm khác/không đánh dấu dọn dữ liệu và thu hồi phiên.

## Khóa Quản lý và chuyển thành viên

Nhóm chỉ nhận phân công mới khi có Quản lý đang hoạt động. Khóa Quản lý sẽ làm nhóm hiện trạng vẫn còn tên nhưng không thể chọn để gán Landing Page hoặc thêm/chuyển Người dùng mới vào. Backend cũng kiểm tra, kể cả dropdown đang mở từ trước. Mở khóa Quản lý sẽ cho phép phân công trở lại.

Người dùng hiện tại không bị khóa theo, giữ dữ liệu và quyền nhóm cũ. Quản trị viên vào Tài khoản → Sửa Người dùng → Nhóm làm việc → chọn nhóm có Quản lý hoạt động → Lưu để chuyển người; phiên cũ của người đó bị thu hồi. Chuyển người không tự chuyển Landing Page/đơn. Muốn bàn giao cả dữ liệu, dùng Sửa Landing Page → Nhóm sở hữu riêng; việc chuyển trang sẽ chuyển cả đơn lịch sử liên quan.
