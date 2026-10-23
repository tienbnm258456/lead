# 📖 HƯỚNG DẪN SỬ DỤNG — Lead Admin

> **Phiên bản:** 1.0 | **Cập nhật:** Tháng 10/2026  
> **Hệ thống:** Quản lý đơn hàng từ LadiPage + đồng bộ RetailCRM  
> **Đối tượng:** Quản trị viên (Admin)

---

## 📑 Mục lục

1. [Giới thiệu chung](#1--giới-thiệu-chung)
2. [Đăng nhập & Tài khoản](#2--đăng-nhập--tài-khoản)
3. [Tổng quan giao diện](#3--tổng-quan-giao-diện)
4. [Dashboard — Bảng điều khiển](#4--dashboard--bảng-điều-khiển)
5. [Quản lý Đơn hàng](#5--quản-lý-đơn-hàng)
6. [Quản lý Landing Page](#6--quản-lý-landing-page)
7. [Dung lượng & Dọn dẹp dữ liệu](#7--dung-lượng--dọn-dẹp-dữ-liệu)
8. [Đổi mật khẩu](#8--đổi-mật-khẩu)
9. [Quên mật khẩu](#9--quên-mật-khẩu)
10. [Giải thích trạng thái & Lỗi thường gặp](#10--giải-thích-trạng-thái--lỗi-thường-gặp)
11. [Câu hỏi thường gặp (FAQ)](#11--câu-hỏi-thường-gặp-faq)

---

## 1. 📋 Giới thiệu chung

**Lead Admin** là hệ thống quản trị đơn hàng tích hợp với LadiPage và RetailCRM, bao gồm:

| Tính năng | Mô tả |
|-----------|-------|
| 📊 Dashboard | Thống kê tổng quan đơn hàng, biểu đồ, doanh thu |
| 🛒 Quản lý Đơn hàng | CRUD, lọc, tìm kiếm, xuất Excel, xóa hàng loạt |
| 🌐 Quản lý Landing Page | Đăng ký trang LadiPage, cấu hình sản phẩm & gói giá |
| 💾 Dung lượng | Thống kê DB, dọn dẹp dữ liệu đã xuất, cấu hình cleanup |
| 🔄 Đồng bộ CRM | Tự động đẩy đơn sang RetailCRM, retry đơn lỗi |
| 📤 Xuất Google Sheets | Tự động xuất data lên Google Sheets mỗi 2 tháng |
| 🔐 Xác thực | Đăng nhập, đăng ký, đổi/quên mật khẩu |

### Luồng hoạt động tổng quan

```
Khách đặt hàng (LadiPage) 
  → Webhook gửi đơn về Lead Admin 
    → Lưu DB + Đồng bộ RetailCRM 
      → Admin quản lý trên web admin
        → Xuất Excel / Tự động xuất Google Sheets
```

---

## 2. 🔐 Đăng nhập & Tài khoản

### 2.1. Đăng nhập

1. Truy cập địa chỉ hệ thống: `http://<IP>:3000/login`
2. Nhập **Tên đăng nhập** và **Mật khẩu**
3. Nhấn **Đăng nhập**
4. Sau khi đăng nhập thành công, hệ thống sẽ chuyển đến trang Dashboard

![Màn hình đăng nhập](./assets/images/login_page.png)
> **Gợi ý chụp ảnh:** Chụp toàn bộ trang đăng nhập với form nhập tên đăng nhập, mật khẩu và nút Đăng nhập. Khoanh tròn nút "Đăng nhập".

| Trường | Loại dữ liệu | Bắt buộc | Lưu ý |
|--------|--------------|----------|-------|
| Tên đăng nhập | Văn bản | ✅ Có | Phân biệt hoa/thường |
| Mật khẩu | Mật khẩu | ✅ Có | Tối thiểu 6 ký tự |

> 💡 **Mẹo:** Nhấn biểu tượng 👁️ bên phải ô mật khẩu để hiện/ẩn mật khẩu.

### 2.2. Đăng ký tài khoản mới

1. Truy cập: `http://<IP>:3000/register`
2. Điền đầy đủ thông tin
3. Nhấn **Đăng ký**
4. Sau khi thành công, hệ thống chuyển đến trang đăng nhập

![Màn hình đăng ký](./assets/images/register_page.png)
> **Gợi ý chụp ảnh:** Chụp trang đăng ký với các trường nhập liệu. Khoanh tròn nút "Đăng ký".

| Trường | Loại dữ liệu | Bắt buộc | Lưu ý |
|--------|--------------|----------|-------|
| Tên đăng nhập | Văn bản | ✅ Có | Không trùng tài khoản đã có |
| Tên hiển thị | Văn bản | ✅ Có | Hiển thị trên giao diện admin |
| Email | Email | ❌ Không | Dùng cho chức năng quên mật khẩu |
| Mật khẩu | Mật khẩu | ✅ Có | Tối thiểu 6 ký tự |
| Xác nhận mật khẩu | Mật khẩu | ✅ Có | Phải trùng với mật khẩu ở trên |

### 2.3. Đăng xuất

Có 2 cách đăng xuất:
- **Cách 1:** Nhấn nút **Đăng xuất** ở góc phải trên cùng (Header)
- **Cách 2:** Nhấn nút **Đăng xuất** ở cuối thanh Sidebar bên trái

![Vị trí nút đăng xuất](./assets/images/logout_buttons.png)
> **Gợi ý chụp ảnh:** Chụp góc phải header và cuối sidebar, khoanh tròn cả 2 nút Đăng xuất.

---

## 3. 🖥️ Tổng quan giao diện

Giao diện admin gồm 3 phần chính:

```
┌──────────────────────────────────────────────────┐
│ Sidebar │           Header (Breadcrumb + Avatar)  │
│         │────────────────────────────────────────│
│ - Dashboard     │                                 │
│ - Đơn hàng     │        NỘI DUNG CHÍNH            │
│ - Landing Pages │                                 │
│ - Dung lượng   │                                  │
│                │                                  │
│ - Đổi mật khẩu│                                  │
│ - Đăng xuất   │                                  │
└──────────────────────────────────────────────────┘
```

![Tổng quan giao diện](./assets/images/layout_overview.png)
> **Gợi ý chụp ảnh:** Chụp toàn bộ trang Dashboard, chú thích 3 vùng: Sidebar, Header, Nội dung chính.

### Menu Sidebar

| Biểu tượng | Menu | Trang |
|------------|------|-------|
| 📊 | Dashboard | Bảng điều khiển thống kê |
| 🛒 | Đơn hàng | Quản lý đơn hàng |
| 🌐 | Landing Pages | Quản lý trang LadiPage |
| 💾 | Dung lượng | Thống kê & dọn dẹp DB |
| 🔑 | Đổi mật khẩu | Thay đổi mật khẩu đăng nhập |

### Header

| Thành phần | Vị trí | Chức năng |
|------------|--------|-----------|
| Breadcrumb | Bên trái | Hiển thị đường dẫn trang hiện tại |
| Tìm kiếm | Giữa | Thanh tìm kiếm nhanh (⌘K) |
| 🌙 / ☀️ | Bên phải | Chuyển đổi giao diện Sáng/Tối |
| 🔔 | Bên phải | Thông báo |
| 👤 | Bên phải | Tên tài khoản + Nút đăng xuất |

> 💡 **Giao diện Sáng/Tối:** Nhấn biểu tượng mặt trời ☀️ hoặc mặt trăng 🌙 trên header để chuyển đổi.

---

## 4. 📊 Dashboard — Bảng điều khiển

**Đường dẫn:** Sidebar → **Dashboard** hoặc truy cập `/admin`

Dashboard hiển thị cái nhìn tổng quan về toàn bộ hệ thống.

### 4.1. Thẻ thống kê (Stat Cards)

![Thẻ thống kê Dashboard](./assets/images/dashboard_stat_cards.png)
> **Gợi ý chụp ảnh:** Chụp 4 thẻ thống kê nằm trên cùng trang Dashboard.

| Thẻ | Ý nghĩa | Màu sắc |
|-----|---------|---------|
| **Tổng đơn hàng** | Tổng số đơn trong hệ thống | Xanh dương |
| **Đơn hôm nay** | Số đơn nhận được trong ngày | Xanh lá |
| **Chờ xử lý** | Số đơn chưa đồng bộ CRM | Vàng |
| **Thất bại** | Số đơn đồng bộ lỗi + hết thời gian | Đỏ |

### 4.2. Biểu đồ

| Biểu đồ | Vị trí | Nội dung |
|---------|--------|----------|
| **Đơn hàng 7 ngày** | Trái | Biểu đồ diện tích — số đơn + doanh thu theo ngày (7 ngày gần nhất) |
| **Phân bố trạng thái** | Phải | Biểu đồ tròn — tỷ lệ Thành công / Chờ / Lỗi / Timeout |
| **Top Landing Pages** | Dưới trái | Biểu đồ cột — 5 trang nhận nhiều đơn nhất |
| **Đơn hàng gần đây** | Dưới phải | Bảng 5 đơn mới nhất (tên, SĐT, giá, trạng thái) |

![Biểu đồ Dashboard](./assets/images/dashboard_charts.png)
> **Gợi ý chụp ảnh:** Chụp toàn bộ khu vực biểu đồ bên dưới các thẻ thống kê.

---

## 5. 🛒 Quản lý Đơn hàng

**Đường dẫn:** Sidebar → **Đơn hàng** hoặc truy cập `/admin/orders`

### 5.1. Xem danh sách đơn hàng

Trang hiển thị bảng danh sách tất cả đơn hàng với các cột:

| Cột | Mô tả | Sắp xếp |
|-----|-------|---------|
| ☑️ | Checkbox chọn đơn (xóa hàng loạt) | — |
| **Mã đơn** | Mã đơn hàng (VD: `LDP-00001`) | ✅ |
| **Landing Page** | Sản phẩm/trang nguồn | ✅ |
| **Khách hàng** | Tên khách đặt hàng | ✅ |
| **SĐT** | Số điện thoại khách | ✅ |
| **Địa chỉ** | Địa chỉ giao hàng | ❌ |
| **Giá SP** | Giá sản phẩm (UZS) | ✅ |
| **Phí ship** | Phí vận chuyển (UZS) | ✅ |
| **Tổng tiền** | Tổng tiền = Giá SP + Phí ship | ✅ |
| **Gói SP** | Gói sản phẩm đã chọn | ❌ |
| **Tùy chọn** | Size / trọng lượng đã chọn | ❌ |
| **Trạng thái** | Trạng thái đồng bộ CRM | ✅ |
| **Ngày tạo** | Thời gian nhận đơn | ✅ |
| **Hành động** | Sửa / Xóa | — |

![Danh sách đơn hàng](./assets/images/orders_list.png)
> **Gợi ý chụp ảnh:** Chụp toàn bộ trang đơn hàng bao gồm header, thanh tìm kiếm, bảng dữ liệu. Khoanh tròn các nút hành động.

### 5.2. Tìm kiếm & Lọc đơn hàng

#### Tìm kiếm nhanh
1. Nhập từ khóa vào ô **"Tìm theo tên, SĐT, mã đơn..."**
2. Nhấn **Enter** để tìm kiếm
3. Nhấn **X** để xóa từ khóa tìm kiếm

#### Lọc nâng cao
1. Nhấn nút **🔍 Lọc** để mở bảng lọc
2. Chọn các tiêu chí lọc:

| Bộ lọc | Mô tả |
|--------|-------|
| **Landing Page** | Lọc theo sản phẩm/trang nguồn |
| **Trạng thái** | Lọc theo: Tất cả / Chờ xử lý / Thành công / Thất bại / Timeout |
| **Từ ngày** | Lọc đơn từ ngày nào |
| **Đến ngày** | Lọc đơn đến ngày nào |

3. Bộ lọc áp dụng ngay khi chọn (không cần nhấn nút xác nhận)
4. Nhấn **"Xóa tất cả bộ lọc"** để reset

![Bộ lọc đơn hàng](./assets/images/orders_filter.png)
> **Gợi ý chụp ảnh:** Mở bảng lọc nâng cao, chọn 1-2 tiêu chí lọc. Khoanh tròn khu vực bộ lọc và các tag lọc đang active.

### 5.3. Thêm đơn hàng thủ công

1. Nhấn nút **➕ Thêm đơn** (góc phải trên cùng)
2. Chọn **Landing Page** (dropdown) → hệ thống tự load danh sách gói sản phẩm
3. Chọn **Gói sản phẩm** → hệ thống tự điền giá
4. Chọn **Tùy chọn phụ** (Size/trọng lượng) nếu sản phẩm có
5. Nhập thông tin khách hàng
6. Nhấn **Tạo đơn hàng**

![Form thêm đơn hàng](./assets/images/orders_create_form.png)
> **Gợi ý chụp ảnh:** Mở modal thêm đơn hàng đã điền đầy đủ thông tin. Khoanh tròn dropdown Landing Page và nút Tạo đơn hàng.

| Trường | Loại dữ liệu | Bắt buộc | Lưu ý |
|--------|--------------|----------|-------|
| Landing Page | Dropdown | ✅ Có | Chọn trang nguồn → load gói sản phẩm tương ứng |
| Gói sản phẩm | Dropdown | ❌ Không | Tự động điền giá + phí ship khi chọn |
| Tùy chọn phụ | Dropdown | ❌ Không | Chỉ hiện khi sản phẩm có cấu hình Size |
| Tên khách hàng | Văn bản | ✅ Có | |
| Số điện thoại | Văn bản | ✅ Có | |
| Địa chỉ giao hàng | Văn bản | ✅ Có | |
| Tổng tiền | Số | ❌ Không | Tự tính từ gói SP, có thể chỉnh tay |

> ⚠️ **Lưu ý:** Khi tạo đơn thủ công, hệ thống sẽ tự động đồng bộ sang RetailCRM. Kết quả đồng bộ hiển thị qua thông báo toast.

### 5.4. Chỉnh sửa đơn hàng

1. Trong bảng đơn hàng, nhấn biểu tượng **✏️ Sửa** ở cột Hành động
2. Cập nhật thông tin cần thay đổi
3. Nhấn **Cập nhật**

![Sửa đơn hàng](./assets/images/orders_edit_form.png)
> **Gợi ý chụp ảnh:** Mở modal chỉnh sửa đơn hàng. Khoanh tròn các trường đã thay đổi và nút Cập nhật.

### 5.5. Xóa đơn hàng

#### Xóa từng đơn
1. Nhấn biểu tượng **🗑️ Xóa** ở cột Hành động
2. Xác nhận xóa trong hộp thoại

#### Xóa hàng loạt
1. Tick checkbox ở cột đầu tiên để chọn các đơn cần xóa
2. Tick checkbox ở header để chọn tất cả đơn trên trang hiện tại
3. Thanh hành động hàng loạt xuất hiện: hiển thị số đơn đã chọn
4. Nhấn **🗑️ Xóa đã chọn**
5. Xác nhận xóa

![Xóa hàng loạt](./assets/images/orders_bulk_delete.png)
> **Gợi ý chụp ảnh:** Tick chọn vài đơn hàng, chụp thanh hành động hàng loạt phía trên bảng. Khoanh tròn nút "Xóa đã chọn" và số đơn đã chọn.

### 5.6. Xuất Excel

Có 2 chế độ xuất:

| Nút | Chế độ | Mô tả |
|-----|--------|-------|
| **📥 Xuất theo bộ lọc** | Filtered | Chỉ xuất các đơn khớp với bộ lọc đang áp dụng → 1 sheet |
| **📊 Xuất tất cả** | All | Xuất toàn bộ đơn → chia thành nhiều sheet theo sản phẩm |

**Các bước:**
1. (Tùy chọn) Áp dụng bộ lọc trước nếu muốn xuất theo điều kiện
2. Nhấn **Xuất theo bộ lọc** hoặc **Xuất tất cả**
3. File Excel (.xlsx) sẽ tự động tải về

> ⚠️ **Lưu ý:** Sau khi xuất, các đơn sẽ được đánh dấu `exported_at` (đã xuất Excel). Đơn đã đánh dấu có thể được dọn dẹp ở trang **Dung lượng**.

![Nút xuất Excel](./assets/images/orders_export.png)
> **Gợi ý chụp ảnh:** Khoanh tròn 2 nút xuất Excel ở góc phải trên cùng trang đơn hàng.

### 5.7. Sắp xếp & Phân trang

- **Sắp xếp:** Nhấn vào tiêu đề cột (có biểu tượng ↕️) để sắp xếp tăng/giảm dần
- **Phân trang:** Sử dụng nút **◀ Trước** / **Sau ▶** ở cuối bảng
- **Số dòng/trang:** Mặc định 10 đơn/trang

---

## 6. 🌐 Quản lý Landing Page

**Đường dẫn:** Sidebar → **Landing Pages** hoặc truy cập `/admin/landing-pages`

Trang này quản lý các Landing Page (trang bán hàng LadiPage), bao gồm cấu hình sản phẩm, gói giá, và webhook URL.

### 6.1. Danh sách Landing Page

Mỗi Landing Page hiển thị dưới dạng **card** với các thông tin:
- Tên trang + trạng thái (Hoạt động / Ngừng)
- Tên sản phẩm gắn với trang
- Danh sách gói sản phẩm (giá, số lượng, phí ship)
- Tùy chọn phụ (Size) nếu có
- Webhook URL (copy để dán vào LadiPage)
- Ngày tạo

![Danh sách Landing Pages](./assets/images/landing_pages_list.png)
> **Gợi ý chụp ảnh:** Chụp trang Landing Pages với 2-3 card. Khoanh tròn webhook URL và nút Copy.

### 6.2. Thêm Landing Page mới

1. Nhấn nút **➕ Thêm Landing Page**
2. Điền tên trang
3. Thêm **gói sản phẩm** (ít nhất 1 gói):
   - Nhập tên gói (VD: "1 hộp + 1 quà tặng")
   - Nhập số lượng, giá, phí ship
   - Nhấn **Thêm gói** nếu cần thêm nhiều gói
4. (Tùy chọn) Bật **Tùy chọn phụ** nếu sản phẩm có Size/trọng lượng:
   - Nhập nhãn tùy chọn (VD: "Size", "Trọng lượng")
   - Thêm các lựa chọn (VD: "S", "M", "L", "XL")
5. Nhấn **Tạo**

![Form thêm Landing Page](./assets/images/landing_pages_create.png)
> **Gợi ý chụp ảnh:** Mở modal thêm Landing Page đã điền 2-3 gói sản phẩm. Khoanh tròn khu vực gói sản phẩm và nút Tạo.

| Trường | Loại dữ liệu | Bắt buộc | Lưu ý |
|--------|--------------|----------|-------|
| Tên trang | Văn bản | ✅ Có | Tên hiển thị (VD: "Đai lưng UZ v2") |
| **Gói sản phẩm** | | | **Tối thiểu 1 gói** |
| ↳ Tên gói | Văn bản | ✅ Có | Text dùng để matching webhook (VD: "1 quti + 1 sovga") |
| ↳ Số lượng | Số nguyên | ✅ Có | Mặc định: 1 |
| ↳ Giá (UZS) | Số | ✅ Có | Phải ≥ 0 |
| ↳ Phí vận chuyển | Số | ❌ Không | Mặc định: 0 (miễn phí) |
| **Tùy chọn phụ** | Toggle | ❌ Không | Bật nếu SP có size/trọng lượng |
| ↳ Nhãn | Văn bản | Có (nếu bật) | VD: "Size", "Trọng lượng" |
| ↳ Các lựa chọn | Danh sách | Có (nếu bật) | VD: ["S", "M", "L", "XL"] |

### 6.3. Chỉnh sửa Landing Page

1. Nhấn biểu tượng **✏️ Sửa** trên card
2. Cập nhật thông tin: tên, gói sản phẩm, tùy chọn phụ
3. Nhấn **Cập nhật**

> ⚠️ **Lưu ý:** Khi sửa gói sản phẩm, những đơn hàng cũ không bị ảnh hưởng (đã lưu snapshot giá tại thời điểm đặt).

### 6.4. Xóa Landing Page

1. Nhấn biểu tượng **🗑️ Xóa** trên card
2. Xác nhận xóa trong hộp thoại

> ⚠️ **Cảnh báo:** Xóa Landing Page sẽ xóa luôn tất cả sản phẩm và gói giá liên quan. Đơn hàng đã nhận **không bị xóa**.

### 6.5. Tạo lại API Key

1. Nhấn biểu tượng **🔄 Tạo lại** trên card (cạnh webhook URL)
2. API Key mới sẽ được tạo
3. **Phải** cập nhật lại webhook URL trên LadiPage POS

> ⚠️ **Cảnh báo:** Sau khi tạo lại, API Key cũ sẽ không hoạt động nữa. Các đơn hàng từ LadiPage sẽ bị từ chối cho đến khi cập nhật URL mới.

### 6.6. Copy Webhook URL

1. Nhấn biểu tượng **📋 Copy** cạnh webhook URL
2. URL sẽ được copy vào clipboard
3. Paste URL này vào phần cấu hình webhook trên LadiPage POS

**Format URL:**
```
http://<IP>:3000/api/webhook/ladipage?api_key=<API_KEY>
```

![Copy webhook URL](./assets/images/landing_pages_webhook.png)
> **Gợi ý chụp ảnh:** Khoanh tròn khu vực webhook URL trên card Landing Page, highlight nút Copy.

---

## 7. 💾 Dung lượng & Dọn dẹp dữ liệu

**Đường dẫn:** Sidebar → **Dung lượng** hoặc truy cập `/admin/storage`

### 7.1. Thống kê tổng quan

Trang hiển thị các thông số về database:

| Thông số | Mô tả |
|----------|-------|
| **Tổng đơn hàng** | Tổng số đơn trong DB |
| **Đã xuất** | Số đơn đã xuất Excel hoặc Google Sheets |
| **Chưa xuất** | Số đơn chưa xuất |
| **Dung lượng DB** | Dung lượng thực tế (MB) |
| **Sync logs** | Số bản ghi log đồng bộ CRM |
| **Activity logs** | Số bản ghi log hoạt động |
| **Trung bình đơn/ngày** | Tốc độ tăng trưởng trung bình (30 ngày gần nhất) |
| **Dự báo đến 100K** | Ước tính bao nhiêu ngày để DB đạt 100.000 bản ghi |

![Thống kê dung lượng](./assets/images/storage_stats.png)
> **Gợi ý chụp ảnh:** Chụp khu vực thống kê tổng quan phía trên trang Dung lượng.

### 7.2. Bảng phân tích dung lượng theo bảng

Hiển thị chi tiết dung lượng từng bảng trong PostgreSQL:

| Cột | Ý nghĩa |
|-----|---------|
| Tên bảng | Tên bảng trong DB (orders, sync_logs,...) |
| Tổng (KB) | Dung lượng tổng (data + index) |
| Data (KB) | Dung lượng dữ liệu thuần |
| Index (KB) | Dung lượng chỉ mục (index) |
| Số dòng | Số bản ghi trong bảng |

### 7.3. Dọn dẹp dữ liệu (Purge)

Chức năng này xóa các đơn hàng **đã xuất** (Excel hoặc Google Sheets) khỏi database để giải phóng dung lượng.

**Các bước:**
1. Nhấn nút **Dọn dẹp dữ liệu** để mở panel xác nhận
2. Nhập chính xác chữ `DELETE` vào ô xác nhận
3. Nhấn **Xóa dữ liệu đã xuất**

![Dọn dẹp dữ liệu](./assets/images/storage_purge.png)
> **Gợi ý chụp ảnh:** Mở panel dọn dẹp, nhập "DELETE" vào ô xác nhận. Khoanh tròn ô nhập và nút xóa.

> ⚠️ **CẢNH BÁO QUAN TRỌNG:**
> - Chỉ xóa đơn **đã xuất** (có `exported_at` hoặc `sheets_exported_at`)
> - Đơn **chưa xuất** sẽ **KHÔNG bị xóa**
> - Hành động này **KHÔNG THỂ HOÀN TÁC**
> - Dữ liệu đã được lưu an toàn trong file Excel hoặc Google Sheets trước khi xóa

### 7.4. Cấu hình Cleanup tự động

Hệ thống tự động dọn dẹp các bản ghi log cũ. Cấu hình thời gian giữ lại:

| Cấu hình | Mặc định | Mô tả |
|----------|----------|-------|
| **Sync logs** | 30 ngày | Log đồng bộ CRM cũ hơn X ngày sẽ bị xóa |
| **Activity logs** | 90 ngày | Log hoạt động (xuất/dọn) cũ hơn X ngày sẽ bị xóa |

**Các bước thay đổi:**
1. Thay đổi số ngày trong ô cấu hình
2. Nhấn **Lưu cấu hình**
3. (Tùy chọn) Nhấn **Reload cache** nếu cần áp dụng ngay

![Cấu hình cleanup](./assets/images/storage_cleanup_settings.png)
> **Gợi ý chụp ảnh:** Chụp phần cấu hình cleanup với các ô nhập số ngày. Khoanh tròn nút "Lưu cấu hình" và nút "Reload cache".

### 7.5. Lịch sử hoạt động

Phía dưới trang hiển thị bảng **20 hoạt động gần nhất** gồm:

| Cột | Mô tả |
|-----|-------|
| **Loại** | `EXPORT` (xuất dữ liệu) hoặc `PURGE` (dọn dẹp) |
| **Số lượng** | Số bản ghi đã xử lý |
| **Ghi chú** | Chi tiết hành động |
| **Thời gian** | Thời điểm thực hiện |

### 7.6. Xuất Google Sheets tự động

Hệ thống **tự động** xuất đơn hàng lên Google Sheets theo lịch:

- **Tần suất:** Mỗi 2 tháng (tháng chẵn: T2, T4, T6, T8, T10, T12)
- **Thời điểm:** Ngày mùng 1 lúc 00:00 (nếu miss sẽ bắt kịp những ngày sau)
- **Nội dung:** Tất cả đơn chưa xuất Google Sheets (`sheets_exported_at = null`)
- **Sau khi xuất thành công:** Tự động dọn dẹp đơn đã xuất khỏi DB

> 💡 **Lưu ý:** Quá trình này hoàn toàn tự động, admin không cần thao tác gì. Dữ liệu được lưu an toàn trên Google Sheets trước khi xóa khỏi DB.

---

## 8. 🔑 Đổi mật khẩu

**Đường dẫn:** Sidebar → **Đổi mật khẩu** hoặc truy cập `/admin/change-password`

### Các bước:

1. Nhập **Mật khẩu hiện tại**
2. Nhập **Mật khẩu mới**
3. Nhập **Xác nhận mật khẩu mới**
4. Nhấn **Đổi mật khẩu**

![Đổi mật khẩu](./assets/images/change_password.png)
> **Gợi ý chụp ảnh:** Chụp trang đổi mật khẩu. Khoanh tròn thanh chỉ báo độ mạnh mật khẩu và nút "Đổi mật khẩu".

| Trường | Loại dữ liệu | Bắt buộc | Lưu ý |
|--------|--------------|----------|-------|
| Mật khẩu hiện tại | Mật khẩu | ✅ Có | Phải đúng mật khẩu đang dùng |
| Mật khẩu mới | Mật khẩu | ✅ Có | Tối thiểu 6 ký tự, phải khác mật khẩu cũ |
| Xác nhận mật khẩu | Mật khẩu | ✅ Có | Phải trùng với mật khẩu mới |

### Chỉ báo độ mạnh mật khẩu

| Mức độ | Điều kiện | Màu |
|--------|-----------|-----|
| 🔴 Yếu | < 6 ký tự | Đỏ |
| 🟡 Trung bình | 6+ ký tự + 1 tiêu chí | Vàng |
| 🔵 Khá | 8+ ký tự + chữ hoa/số | Xanh dương |
| 🟢 Mạnh | 8+ ký tự + chữ hoa + số + ký tự đặc biệt | Xanh lá |

---

## 9. 🔓 Quên mật khẩu

**Đường dẫn:** Trang đăng nhập → nhấn **"Quên mật khẩu?"** hoặc truy cập `/forgot-password`

### Bước 1: Yêu cầu mã reset

1. Nhập **Tên đăng nhập** hoặc **Email** đã đăng ký
2. Nhấn **Gửi mã reset**
3. Hệ thống sẽ tạo mã token reset (hiển thị trên màn hình)

### Bước 2: Đặt lại mật khẩu

1. Nhập **Mã xác nhận** (tự động điền nếu vừa yêu cầu)
2. Nhập **Mật khẩu mới** (tối thiểu 6 ký tự)
3. Nhập **Xác nhận mật khẩu**
4. Nhấn **Đặt lại mật khẩu**

![Quên mật khẩu](./assets/images/forgot_password.png)
> **Gợi ý chụp ảnh:** Chụp cả 2 bước trên trang quên mật khẩu. Bước 1: form nhập username/email. Bước 2: form nhập token + mật khẩu mới.

> 💡 **Lưu ý:** Mã reset có thời hạn. Nếu hết hạn, cần yêu cầu mã mới.

---

## 10. 🏷️ Giải thích trạng thái & Lỗi thường gặp

### 10.1. Trạng thái đồng bộ CRM

| Trạng thái | Badge | Ý nghĩa | Cần làm gì? |
|-----------|-------|---------|------------|
| **Chờ xử lý** | 🟡 Vàng | Đơn mới, chưa gửi sang CRM | Hệ thống sẽ tự động xử lý |
| **Thành công** | 🟢 Xanh lá | Đã đồng bộ sang RetailCRM thành công | Không cần thao tác |
| **Thất bại** | 🔴 Đỏ | Lỗi khi đồng bộ (API lỗi, validation,...) | Kiểm tra thông tin đơn, retry nếu cần |
| **Timeout** | 🟠 Cam | Hết thời gian chờ phản hồi từ CRM | Thử lại sau, kiểm tra kết nối CRM |

### 10.2. Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|------------|----------------|
| **"Không thể kết nối máy chủ"** | Server đang tắt hoặc mất mạng | Kiểm tra server đang chạy, kiểm tra kết nối mạng |
| **"Đăng nhập không thành công"** | Sai tên đăng nhập hoặc mật khẩu | Kiểm tra lại thông tin, thử quên mật khẩu |
| **"Không có đơn hàng đã xuất để dọn dẹp"** | Chưa có đơn nào được xuất Excel/Sheets | Xuất Excel hoặc chờ hệ thống tự xuất Google Sheets |
| **"Thiếu GOOGLE_APPS_SCRIPT_URL"** | Chưa cấu hình Google Sheets integration | Liên hệ kỹ thuật viên cấu hình .env |
| **"Cần nhập chính xác: DELETE"** | Nhập sai xác nhận khi dọn dẹp | Nhập chính xác chữ `DELETE` (viết hoa) |
| **Webhook 401 Unauthorized** | API Key không hợp lệ hoặc Landing Page đã tắt | Kiểm tra API Key, bật lại Landing Page |
| **Đơn trùng lặp trên Sheets** | Server crash giữa lúc xuất batch | Hệ thống đã có cơ chế progressive marking để tránh trường hợp này |

---

## 11. ❓ Câu hỏi thường gặp (FAQ)

### Q: Đơn hàng từ LadiPage vào hệ thống như thế nào?
> **A:** Khi khách đặt hàng trên LadiPage, LadiPage gửi webhook đến URL được cấu hình (chứa `api_key`). Hệ thống tự động nhận đơn, lưu DB, và đồng bộ sang RetailCRM.

### Q: Tôi có thể xóa đơn chưa xuất không?
> **A:** Có, bạn có thể xóa từng đơn hoặc xóa hàng loạt trong trang **Đơn hàng**. Tuy nhiên, chức năng **Dọn dẹp** ở trang Dung lượng chỉ xóa đơn **đã xuất**.

### Q: Xuất Google Sheets tự động có cần tôi làm gì không?
> **A:** Không. Hệ thống chạy tự động mỗi 2 tháng. Sau khi xuất thành công, dữ liệu cũ tự động được dọn dẹp khỏi DB.

### Q: Tôi thấy DB phình to, làm sao?
> **A:** Vào trang **Dung lượng** → kiểm tra số đơn đã xuất → nhấn **Dọn dẹp** để xóa đơn đã xuất. Hoặc chờ hệ thống tự dọn sau lần xuất Google Sheets tiếp theo.

### Q: Khi nào đơn được đánh dấu "đã xuất"?
> **A:** Có 2 loại đánh dấu:
> - `exported_at`: Khi admin nhấn **Xuất Excel** trên trang đơn hàng
> - `sheets_exported_at`: Khi hệ thống tự động xuất lên **Google Sheets**

### Q: Tôi muốn thay đổi lịch xuất Google Sheets?
> **A:** Liên hệ kỹ thuật viên để thay đổi biến `SHEETS_EXPORT_MONTHS` trong file cấu hình `.env`. Mặc định: `2,4,6,8,10,12` (tháng chẵn).

### Q: Tải trang admin bị chậm?
> **A:** Kiểm tra dung lượng DB ở trang **Dung lượng**. Nếu có quá nhiều đơn hàng (>50K), hãy dọn dẹp đơn đã xuất.

---

> 📄 **Tài liệu này được tạo tự động từ source code.** Để cập nhật nội dung, liên hệ đội phát triển.  
> **Thư mục ảnh minh họa:** `./assets/images/` — Chụp ảnh màn hình và lưu vào thư mục này theo tên file đã gợi ý.
