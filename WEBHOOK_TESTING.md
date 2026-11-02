# Kiểm tra LadiPage / RetailCRM

## Cấu hình

- Giá và phí ship trong admin/database luôn là UZS đầy đủ. Nhập 299000 hoặc 299.000; CRM nhận 299. Ship 50000 được gửi thành 50.
- Mọi caller của bộ gửi RetailCRM phải cung cấp tiền UZS đầy đủ, kể cả API đồng bộ thủ công. Không chia trước khi gọi.
- Mỗi dòng cấu hình gói là một combo. Webhook gửi quantity = 1 cho mỗi gói được chọn; quantity trong cấu hình cũ không còn là số combo đặt mua.
- Nhập tên gói khớp LadiPage và thông tin khuyến mại (1+1, 2+2). Mỗi gói có một dòng cấu hình; size khách chọn được áp dụng chung cho tất cả dòng hàng để sale xác nhận.
- XML ID tự sinh theo ID gói: XML0001_OFFER, XML0002_OFFER. Mã được lưu khi tạo/sửa hoặc nhận webhook/gửi lại cho gói cũ. Giữ mã đã có; sửa tên/giá không đổi mã. Mã tạm chưa tự tạo offer trong RetailCRM.
- Có migration bổ sung cột promotion trong product_variants. Trước khi chạy bản mới: npx prisma migrate deploy và npx prisma generate.

## Quy tắc

- products/size nhận chuỗi hoặc mảng chuỗi; form-data nhận khóa lặp. Không tách tên gói theo dấu phẩy.
- Nhiều gói: tạo nhiều items, ship lấy mức cao nhất một lần. Một size được áp dụng cho các gói được chọn.
- Nhiều size: lưu đầy đủ và nối bằng dấu + trên mọi dòng hàng, không nhân tổ hợp, không thay đổi số lượng/giá. Khuyến mại và danh sách size được ghép trực tiếp vào offer.xmlId: XML0001, 1+1, S + L. Không gửi customerComment. Nhãn size mô tả bắt đầu S/M/L/XL/... được rút gọn về mã size.
- Không match tên gói hoặc cấu hình trùng cũng giữ đơn FAILED. Payload gốc được giữ trong items_json. Đơn chưa resolve có total_price=0, không được hiểu là đơn miễn phí.
- Sau khi bổ sung cấu hình còn thiếu, dùng gửi lại để resolve theo cấu hình mới. Đơn cũ bị giữ vì nhiều size có thể gửi lại theo quy tắc size chung mới.
- Giá và dữ liệu gốc trong database không bị chia khi gửi lại. API response syncStatus và log gửi CRM cho biết kết quả thực tế.
- Endpoint /api/webhook/ladipage/test bị tắt khi NODE_ENV=production. Thay đổi chuẩn hóa áp dụng endpoint api_key và test; endpoint slug cũ chưa thay đổi matching.

## Kiểm tra

Chạy: node --test scripts/test-ladipage.cjs

1. Radio: một gói + một size -> một item, quantity=1, giá 299000 -> 299, ship 50000 -> 50.
2. Checkbox: hai gói + một size -> hai items; giá 299000/529000, ship 50000 -> tổng nội bộ 878000, CRM 299/529 và ship 50.
3. Hai gói + hai size -> 2 items, mỗi item chứa cả hai size; khuyến mại và size được ghép trong offer.xmlId của từng item.
4. Để trống XML ID -> tự tạo mã theo gói. Gửi tên gói sai -> giữ dữ liệu gốc, không gửi nhầm offer.
5. Lỗi CRM -> gửi lại giữ đủ dòng hàng và ship, chia tiền đúng một lần.
6. Xuất Excel/Sheets -> mỗi item một dòng; tổng đơn chỉ hiện trên dòng đầu để không cộng trùng.

Chưa gọi webhook/CRM production trong quá trình kiểm thử tự động.
