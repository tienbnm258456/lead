# 🚀 Lead Admin Management

Hệ thống quản lý Lead/Data thu thập từ Landing Page - Xây dựng bằng Next.js 16 (App Router), PostgreSQL & Prisma.

---

## 📋 Mục lục

- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt & Khởi chạy](#-cài-đặt--khởi-chạy)
- [Tài khoản đăng nhập](#-tài-khoản-đăng-nhập)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [API Endpoints](#-api-endpoints)
- [Database Schema](#-database-schema)
- [Tính năng](#-tính-năng)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)

---

## 💻 Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu |
|---|---|
| **Node.js** | v18.17 trở lên |
| **PostgreSQL** | v14 trở lên |
| **npm** | v9 trở lên |

---

## 🛠 Cài đặt & Khởi chạy

### Bước 1: Mở thư mục dự án

```bash
cd D:\home\vibe-code\lead-admin
npm install
```

### Bước 2: Cấu hình Database PostgreSQL

File `.env`:

```env
DATABASE_URL="postgresql://postgres:123456@localhost:5432/lead_admin?schema=public"
```

> **Cú pháp:** `postgresql://[user]:[password]@[host]:[port]/[database_name]?schema=public`

### Bước 3: Đồng bộ Database Schema

```bash
# Tự động tạo database 'lead_admin' và đồng bộ bảng
npx prisma db push

# (Tùy chọn) Xem database trực quan trên trình duyệt
npx prisma studio
```

### Bước 4: Khởi chạy ứng dụng

```bash
npm run dev
```

Truy cập: **http://localhost:3000** (hệ thống sẽ tự động chuyển hướng đến `/login` nếu chưa đăng nhập).

---

## 🔐 Tài khoản đăng nhập

Hệ thống được bảo vệ bởi middleware xác thực phiên. Bạn sử dụng tài khoản sau để đăng nhập:

| Tên đăng nhập | Mật khẩu | Quyền |
|---|---|---|
| `admin` | `123456` | Quản trị viên hệ thống |
| `postgres` | `123456` | Quản trị viên dự phòng |

> 💡 **Tip:** Trên giao diện trang đăng nhập có sẵn nút **"Điền nhanh"** 1-click để tự động nhập tài khoản và mật khẩu rất thuận tiện.

---

## 📁 Cấu trúc thư mục

```
lead-admin/
├── prisma/
│   └── schema.prisma           # Định nghĩa database schema (PostgreSQL)
├── src/
│   ├── middleware.ts           # Middleware bảo vệ route /admin & chuyển hướng /login
│   ├── app/
│   │   ├── layout.tsx          # Layout gốc (Providers, Theme, Toast)
│   │   ├── page.tsx            # Trang chủ → kiểm tra phiên & điều hướng
│   │   ├── login/
│   │   │   └── page.tsx        # Trang đăng nhập giao diện Glassmorphism hiện đại
│   │   ├── globals.css         # Design system (Light/Dark mode)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts  # POST xác thực đăng nhập
│   │   │   │   ├── logout/route.ts # POST đăng xuất
│   │   │   │   └── me/route.ts     # GET thông tin tài khoản hiện tại
│   │   │   └── leads/
│   │   │       ├── route.ts        # GET (danh sách) + POST (tạo mới từ landing page)
│   │   │       ├── [id]/route.ts   # GET + PUT + DELETE (theo ID)
│   │   │       ├── bulk/route.ts   # DELETE hàng loạt
│   │   │       └── export/route.ts # POST xuất file Excel
│   │   └── admin/
│   │       ├── layout.tsx      # Layout dashboard (Sidebar + Header + Logout)
│   │       ├── page.tsx        # Trang Dashboard thống kê
│   │       └── leads/
│   │           └── page.tsx    # Trang quản lý Lead (CRUD + Table + Export)
│   ├── components/
│   │   ├── providers.tsx       # React Query + next-themes
│   │   ├── layout/
│   │   │   ├── sidebar.tsx     # Sidebar thu gọn/mở rộng + trạng thái PostgreSQL + Đăng xuất
│   │   │   └── header.tsx      # Header (Breadcrumb, Search, Theme, Avatar, Đăng xuất)
│   │   └── leads/
│   │       ├── lead-form.tsx   # Modal thêm/sửa Lead tối ưu hiển thị và nhập liệu
│   │       ├── delete-dialog.tsx   # Dialog xác nhận xóa
│   │       └── status-badge.tsx    # Badge trạng thái
│   └── lib/
│       ├── auth.ts             # Logic xác thực, mã hóa token phiên
│       ├── prisma.ts           # Prisma Client (singleton)
│       ├── utils.ts            # Hàm tiện ích (cn, formatDate)
│       ├── validations.ts      # Zod schemas validate dữ liệu
│       └── types.ts            # TypeScript type definitions
├── .env                        # Biến môi trường
├── .env.example                # Mẫu biến môi trường
├── package.json
├── next.config.ts
└── tsconfig.json
```

---

## 🔌 API Endpoints

### 1. Landing Page API (Public)

#### `POST /api/leads` — Tạo Lead mới từ Landing Page

```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "Nguyễn Văn A",
    "phone": "0912345678",
    "email": "nguyenvana@gmail.com",
    "note": "Quan tâm gói Premium",
    "source": "Facebook Ads",
    "utm_source": "facebook",
    "utm_medium": "cpc"
  }'
```

**Các trường dữ liệu:**

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `fullname` | string | ✅ | Họ tên (tối thiểu 2 ký tự) |
| `phone` | string | ✅ | SĐT Việt Nam (VD: 0912345678) |
| `email` | string | ❌ | Email khách hàng |
| `note` | string | ❌ | Ghi chú nhu cầu |
| `source` | string | ❌ | Nguồn lead (mặc định: "Landing Page") |
| `utm_source` | string | ❌ | UTM Source chiến dịch |
| `utm_medium` | string | ❌ | UTM Medium chiến dịch |

---

### 2. Authentication API

- `POST /api/auth/login`: Xác thực tài khoản & cấp cookie phiên `lead_admin_token`
- `POST /api/auth/logout`: Xóa phiên đăng nhập
- `GET /api/auth/me`: Kiểm tra thông tin phiên hiện tại

---

### 3. Admin Lead API

- `GET /api/leads`: Lấy danh sách phân trang, tìm kiếm, lọc theo ngày/trạng thái/nguồn
- `PUT /api/leads/:id`: Cập nhật thông tin lead
- `DELETE /api/leads/:id`: Xóa một lead
- `DELETE /api/leads/bulk`: Xóa nhiều lead theo danh sách ID
- `POST /api/leads/export`: Xuất file Excel (.xlsx)

---

## 🗄 Database Schema (PostgreSQL)

```prisma
enum LeadStatus {
  NEW          // Mới
  PROCESSING   // Đang xử lý
  COMPLETED    // Hoàn thành
  FAILED       // Lỗi
}

model Lead {
  id         Int        @id @default(autoincrement())
  fullname   String     @db.VarChar(255)
  phone      String     @db.VarChar(20)
  email      String?    @db.VarChar(255)
  note       String?    @db.Text
  source     String     @default("Landing Page") @db.VarChar(255)
  utm_source String?    @db.VarChar(255)
  utm_medium String?    @db.VarChar(255)
  status     LeadStatus @default(NEW)
  created_at DateTime   @default(now())
  updated_at DateTime   @updatedAt

  @@index([status])
  @@index([source])
  @@index([created_at])
  @@map("leads")
}
```

---

## ✨ Tính năng

### 🔒 Bảo mật & Xác thực
- **Trang Login**: Giao diện Glassmorphism hiện đại, hỗ trợ Dark/Light mode, nút điền nhanh tài khoản.
- **Next.js Middleware**: Tự động chặn và chuyển hướng các truy cập trái phép vào Dashboard về trang đăng nhập.
- **Đăng xuất linh hoạt**: Tích hợp nút Đăng xuất trên cả Header và Sidebar.

### 📋 Quản lý Lead & Trải nghiệm nhập liệu
- **Modal thêm/sửa Lead tối ưu**: Căn chỉnh chiều cao chuẩn, tiêu đề và nút đóng luôn cố định, thanh cuộn nội dung độc lập, không bao giờ bị tràn mép trên màn hình.
- **Trường Họ tên & SĐT rõ ràng**: Tự động focus vào ô Họ tên khi mở modal, icon trực quan và nhãn có màu sắc phân biệt.
- **Thao tác nhanh**: Hỗ trợ phím `Esc` để đóng modal nhanh.
- **Tìm kiếm & Bộ lọc nâng cao**: Tìm theo tên/SĐT/email, lọc theo trạng thái, khoảng ngày, nguồn lead.
- **Xuất Excel chuyên nghiệp**: Xuất toàn bộ, xuất theo bộ lọc, hoặc xuất các lead đã tick chọn.

---

## 🔧 Lệnh hữu ích

```bash
# Chạy môi trường phát triển
npm run dev

# Đồng bộ thay đổi schema sang PostgreSQL
npx prisma db push

# Mở giao diện xem dữ liệu Prisma Studio
npx prisma studio

# Build kiểm tra production
npm run build
```
