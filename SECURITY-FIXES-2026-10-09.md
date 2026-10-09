# Các bản sửa bảo mật — 09/10/2026

Đã sửa các mục trong `SECURITY-AUDIT-2026-10-09.md` ở mã nguồn local. Chưa deploy, chưa chạy migration hoặc thay đổi dữ liệu production. Kết quả audit ban đầu được giữ để đối chiếu.

## Các thay đổi đã thực hiện

- [x] **Thanh toán:** MoMo IPN trả 503 trước khi đọc đơn hàng nếu thiếu partnerCode/accessKey/secretKey; kiểm tra schema, merchant và chữ ký bằng timing-safe comparison. Callback hợp lệ vẫn được xử lý; số tiền sai, đơn đã hủy/đã trả hoặc thanh toán thất bại không được xác nhận. Stripe demo bị chặn trong production, thiếu khóa thật không tự động đánh dấu PAID.
- [x] **Settings công khai:** truy vấn và phản hồi chỉ chứa các khóa được phép; loại newsletterSubscribers và khóa nội bộ/không biết. Giữ các tên camelCase/snake_case cũ cùng thông tin chuyển khoản cần thiết cho checkout.
- [x] **Thu hồi JWT:** thêm `users.token_version`; logout và đổi/reset mật khẩu tăng phiên bản, HTTP và Socket.IO kiểm tra phiên bản trong DB. Token cũ thiếu tokenVersion bị từ chối. Logout thu hồi tất cả JWT đang tồn tại của cùng tài khoản, kể cả bản sao trong Swagger và các thiết bị khác. Đăng nhập lại tạo token dùng phiên bản mới; gửi lại token đã thu hồi không làm mất phiên mới.
- [x] **Kết nối đang mở:** Socket.IO và stream trạng thái admin đóng ngay khi thu hồi trên cùng process; instance khác kiểm tra DB mỗi 15 giây. Đóng khi JWT hết hạn, tài khoản bị vô hiệu hóa hoặc không thể kiểm tra DB. Stream dừng heartbeat và gỡ subscription khi đóng.
- [x] **Giao diện đăng xuất:** khi server logout thất bại vì mạng/DB, báo lỗi và giữ trạng thái đăng nhập để người dùng thử lại. Sau đổi mật khẩu thành công, chuyển về login vì các JWT cũ đã bị thu hồi.
- [x] **Hosting:** thêm chuyển HTTP sang HTTPS với hostname cố định, HSTS trên HTTPS, CSP chống nhúng trang, X-Frame-Options, nosniff và Referrer-Policy vào `frontend/public/.htaccess`. Chặn đường dẫn file ẩn, giữ ACME và SPA routing. Đã xác nhận build sao chép nguyên vẹn `.htaccess`; chưa kiểm tra bằng Apache hoặc response production sau deploy.
- [x] **Query công khai:** sản phẩm, sản phẩm theo danh mục/liên quan và blog trả 400 trước truy vấn DB cho pagination sai; page tối đa 10.000, limit tối đa 100. Giá phải hữu hạn, không âm và minPrice không vượt maxPrice. Giữ tùy chọn sort=default đang dùng trên Shop.
- [x] **Dependencies:** nâng multer, sharp, sanitize-html, socket.io, axios, DOMPurify, React Router, Nodemailer, basic-ftp và các dependency gián tiếp. Gom công cụ test/chạy TypeScript dùng chung ở workspace root. Override deepmerge-ts, esbuild và js-yaml để loại các phiên bản bị cảnh báo.

Prisma và bộ nạp cấu hình NYC được khai báo trực tiếp ở root để npm thực sự áp dụng override cho dependency dùng chung qua workspace. Đây là cách xử lý [lỗi truyền overrides qua workspace của npm](https://github.com/npm/cli/issues/9659), đã kiểm tra bằng cây dependency, audit và build; không chỉnh mã trong node_modules.

## Kiểm tra local

Test dùng tài khoản/đơn hàng giả và database boundary được mock; DATABASE_URL của test trỏ tới loopback không có database. Test upload chỉ ghi ảnh vào thư mục tạm; không gửi tới Cloudinary. Không gửi thanh toán, email hoặc request ghi dữ liệu production.

| Kiểm tra | Kết quả |
| --- | --- |
| Backend regression suite | 47 test, 8 suite — passed |
| Frontend authStore | 2 test — passed |
| Backend build | Prisma generate + TypeScript — passed |
| Frontend build | TypeScript + Vite — passed |
| npm audit | 0 vulnerability entries |
| npm audit --omit=dev | 0 vulnerability entries |
| npm ci --dry-run --ignore-scripts | Lockfile hợp lệ |
| .htaccess public/dist | Cùng SHA256 |

Test bao gồm callback giả/hợp lệ, settings không lộ dữ liệu, token sao chép sau logout/đổi/reset mật khẩu, đăng nhập mới, JWT cũ, Socket.IO, stream admin, DB polling/hết hạn phiên, query sai và sort mặc định, upload PNG hợp lệ, file giả và upload không đăng nhập. Đã kiểm tra cấu hình YAML NYC sau override js-yaml và sanitizer rich text trong backend build. Các cảnh báo không làm thất bại kiểm tra: chunk frontend trên 500 kB, cấu hình Prisma package.json deprecated ở phiên bản major sau, cảnh báo localStorage của Node 25 trong Jest.

## Triển khai backend trên Render

1. Dùng Node >=22.12.0 và cài từ workspace root để áp dụng toàn bộ overrides/lockfile. Cần devDependencies ở bước build cho Prisma/TypeScript.
2. Đặt `NODE_ENV=production`, `STRIPE_DEMO_MODE=false`. Nếu sử dụng MoMo, cấu hình đủ `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, endpoint phù hợp môi trường và `MOMO_IPN_URL=https://web-nurfia.onrender.com/api/payment/momo/ipn`. Khi chưa cấu hình MoMo, 503 là hành vi đóng thanh toán có chủ đích. Nếu sử dụng Stripe thật, cấu hình secret key và webhook secret.
3. Build từ root:

   ```sh
   npm ci --include=dev
   npm run build --workspace backend
   ```

4. Start: `npm run start --workspace backend`.

Backend tạo cột token_version bằng câu lệnh idempotent trước khi nhận HTTP/Socket.IO. Migration tương ứng: `backend/prisma/migrations/0006_user_token_version/migration.sql`. Nếu tài khoản DB chạy ứng dụng không có quyền ALTER TABLE, người quản trị DB phải áp dụng riêng migration này trước khi start. Server sẽ không mở cổng khi bước chuẩn bị schema xác thực thất bại.

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;
```

**Lưu ý migration cũ:** file `0001_init/migration.sql` hiện có nội dung cảnh báo PowerShell/npm trước SQL. Không chạy toàn bộ `prisma migrate deploy` một cách máy móc lên DB đang dùng; cần kiểm tra lịch sử migration và xử lý file cũ trước khi dùng lại quy trình đó. Bản sửa này dùng bước compatibility sẵn có và migration riêng, không sửa lịch sử DB hiện tại.

Sau deploy, tất cả token được phát hành trước bản sửa phải đăng nhập lại. Đăng nhập lại vào web admin, lấy token mới nếu dùng Swagger. Nếu có nhiều instance, phải cập nhật hết các instance; instance chạy mã cũ chưa kiểm tra tokenVersion.

## Triển khai frontend trên Apache

```sh
npm run build --workspace frontend
```

Upload toàn bộ nội dung `frontend/dist`, **bao gồm file ẩn `.htaccess`**, vào document root của `vanhoang.mauweb68.com`. Hosting cần Apache mod_rewrite/mod_headers và cho phép directive tương ứng trong .htaccess.

Nếu TLS kết thúc ở reverse proxy/CDN thay vì Apache, cấu hình redirect/HSTS tại tầng biết chắc kết nối HTTPS hoặc cấu hình Apache HTTPS đúng; quy tắc `%{HTTPS}` cần được kiểm tra để tránh redirect loop. Không tin cậy header X-Forwarded-Proto do client tự gửi.

Kiểm tra sau triển khai:

- HTTP `/` và `/login` chuyển 301 sang HTTPS, HTTPS không lặp redirect.
- HTTPS `/`, `/login`, `/admin` có HSTS, CSP frame-ancestors và X-Frame-Options.
- `/api/settings` không chứa newsletterSubscribers hoặc dữ liệu subscriber.
- `/api/products?minPrice=abc` và `?limit=101` trả 400; Shop với sort=default vẫn hiển thị sản phẩm.
- Đăng nhập bằng tài khoản thử; sao chép token, logout, gọi API được bảo vệ với token đó phải trả 401. Đăng nhập mới phải thành công. Socket/stream của phiên cũ phải đóng.
- Kiểm tra payment sandbox có merchant/key thật và callback hợp lệ; local test chưa thay thế xác nhận từ MoMo/Stripe.

Chưa kiểm chứng production sau deploy, SMTP thực, Cloudinary thực hoặc giao dịch thật. Số lượng cảnh báo npm bằng 0 là kết quả dependency audit tại thời điểm kiểm tra, không phải chứng nhận website không còn mọi lỗ hổng.
