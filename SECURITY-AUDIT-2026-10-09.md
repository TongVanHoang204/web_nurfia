# Báo cáo kiểm tra bảo mật Nurfia

Ngày kiểm tra: 09/10/2026, khoảng 13:47–13:53 (Asia/Saigon).

Website: https://vanhoang.mauweb68.com

Backend: https://web-nurfia.onrender.com. Địa chỉ này được xác nhận từ JavaScript công khai của website.

Phạm vi: các yêu cầu HTTP có giới hạn, không đăng nhập tài khoản thật, không tạo/xóa tài khoản, không gửi email, không tải file lên, không thử tải lớn và không cập nhật đơn hàng thật. Đối chiếu mã nguồn hiện tại; các phép thử phiên và thanh toán thành công chạy trong tiến trình local với database giả lập. Không lưu địa chỉ email, cookie hoặc token thật vào báo cáo.

## 1. Webhook MoMo chấp nhận chữ ký tạo bằng khóa rỗng

**Ưu tiên: khẩn cấp. Chấp nhận chữ ký đã xác nhận trên production; tác động giả mạo thanh toán được xác nhận local, chưa thử trên đơn thật.**

Endpoint: `POST /api/payment/momo/ipn`.

Hai yêu cầu kiểm tra dùng mã đơn không tồn tại `AUDIT-NONEXISTENT-20261009`, `amount=0`, `resultCode=1` (thanh toán thất bại). Trong code hiện tại, trạng thái này không đi vào nhánh truy vấn/cập nhật đơn.

| Phép thử | Phản hồi production |
| --- | --- |
| Chữ ký không hợp lệ | 400, `Invalid signature` |
| HMAC-SHA256 với secret rỗng và accessKey rỗng | 204 |

`backend/src/controllers/payment.controller.ts:245` lấy cấu hình rồi tính HMAC mà không kiểm tra accessKey/secretKey có giá trị. `backend/src/config/index.ts:66` mặc định secretKey thành chuỗi rỗng. Kết quả production phù hợp với cấu hình MoMo đang để trống.

Trong phép thử local dùng đúng controller và một đơn MOMO giả lập có số tiền khớp, chữ ký dùng khóa rỗng cùng `resultCode=0` làm controller gọi cập nhật `paymentStatus=PAID`, `status=CONFIRMED` rồi trả 204. Không có truy vấn database thật hoặc đơn thật nào bị cập nhật.

Nếu production có đơn MOMO chưa thanh toán, kẻ tấn công biết mã đơn và số tiền có thể lợi dụng lỗi này để giả mạo callback thành công. Không thể coi HMAC với khóa rỗng là xác thực.

Khắc phục: trả 503 trước khi xử lý webhook nếu cấu hình MoMo thiếu; kiểm tra partnerCode theo cấu hình; xác thực trường dữ liệu và chữ ký bằng phép so sánh an toàn; bổ sung regression test cho cấu hình rỗng và callback sai. Nếu chưa dùng MoMo, tắt endpoint cho tới khi cấu hình hợp lệ.

Điểm riêng cần kiểm tra cấu hình: Stripe có nhánh demo cho phép đánh dấu PAID khi `STRIPE_DEMO_MODE=true`, kể cả production (`payment.controller.ts:30`, `:172`). Chưa xác minh biến này trên Render và chưa gọi tạo thanh toán thật. Production cần cấm nhánh demo.

## 2. Danh sách email newsletter bị công khai

**Mức độ: cao. Đã xác nhận production, không cần đăng nhập.**

`GET /api/settings` trả 200 và chứa `data.newsletterSubscribers`, một chuỗi JSON chứa **78 bản ghi**, mỗi bản ghi có `email` và `subscribedAt` tại thời điểm kiểm tra.

Nguyên nhân: `backend/src/controllers/setting.controller.ts:79` gọi `prisma.setting.findMany()` không lọc, rồi đưa mọi key/value vào phản hồi công khai. `contact.controller.ts` lưu danh sách newsletter trong cùng bảng settings. Đây là dữ liệu cá nhân, không phải cấu hình giao diện.

Khắc phục: endpoint settings công khai chỉ trả danh sách khóa được phép, bao gồm tên website, logo và thông tin liên hệ công khai; loại bỏ newsletter và các cấu hình nội bộ. Quyền đọc danh sách subscriber phải được kiểm tra ở endpoint admin. Tách dữ liệu newsletter khỏi settings giúp tránh lỗi tương tự trong tương lai.

Kiểm tra sau sửa: yêu cầu không đăng nhập phải không còn khóa newsletter hoặc bất kỳ email subscriber nào; frontend vẫn lấy được cấu hình cần thiết. Các khóa kiểu snake_case và camelCase đang cùng tồn tại trên production, cần tính đến cả hai khi lập danh sách công khai.

## 3. JWT đã sao chép vẫn hợp lệ sau logout và đổi mật khẩu

**Mức độ: cao khi token đã bị lấy. Đã xác nhận bằng code và thử local; chưa dùng phiên production thật.**

`backend/src/controllers/auth.controller.ts:29` chỉ xóa cookie. `backend/src/middlewares/auth.ts:114` xác thực chữ ký, hạn token và trạng thái người dùng, không kiểm tra trạng thái phiên bị thu hồi. `auth.service.ts:154` và `:284` đổi/reset mật khẩu mà không vô hiệu hóa JWT đã phát hành.

Phép thử local: một JWT ADMIN dành cho người dùng giả lập được middleware chấp nhận trước logout; logout gọi clearCookie; cùng JWT vẫn được middleware chấp nhận sau logout. Token không được gửi tới production hoặc ghi ra file.

Hậu quả: logout không kết thúc quyền truy cập của người đã giữ bản sao JWT. Đổi/reset mật khẩu cũng không chặn bản sao đó trong thời hạn JWT.

Khắc phục: dùng phiên có thể thu hồi hoặc session/tokenVersion được kiểm tra trên server. Logout thu hồi phiên hiện tại; đổi/reset mật khẩu thu hồi các phiên liên quan. Áp dụng cùng kiểm tra cho Socket.IO và kết nối stream; cân nhắc ngắt các kết nối đang hoạt động khi phiên bị thu hồi. Thời hạn thực tế phụ thuộc `JWT_EXPIRES_IN`, chưa xác minh cấu hình production.

## 4. Frontend không ép HTTPS và thiếu HSTS riêng

**Mức độ: cao trong tình huống người dùng truy cập qua HTTP. Đã xác nhận phản hồi production.**

`GET http://vanhoang.mauweb68.com/` trả 200 cùng nội dung ứng dụng, không trả redirect HTTPS. Bản HTTPS không có `Strict-Transport-Security`. Backend Render có HSTS nhưng header đó không bảo vệ hostname frontend.

Người dùng truy cập HTTP có thể nhận HTML/JavaScript bị sửa bởi bên kiểm soát đường truyền, dẫn đến giao diện đăng nhập hoặc thao tác mua hàng bị thay đổi. Chưa thực hiện can thiệp đường truyền. Chưa kiểm tra preload/HSTS thừa kế từ domain cha.

Khắc phục: cấu hình Apache/hosting chuyển HTTP sang HTTPS bằng 301 hoặc 308 và gửi HSTS trên phản hồi HTTPS. `frontend/public/.htaccess` hiện chỉ có quy tắc phục vụ SPA, chưa có redirect này. [Hướng dẫn HSTS của MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security).

## 5. Frontend thiếu bảo vệ chống nhúng trang

**Mức độ: trung bình, cần kiểm chứng tương tác trong trình duyệt.**

Phản hồi `/`, `/login` và `/admin` không có `X-Frame-Options` hoặc CSP `frame-ancestors`. Vì vậy response header chưa chặn website khác nhúng giao diện vào iframe. Chưa dựng proof trong trình duyệt và chưa xác nhận hành động nhạy cảm nào bị clickjacking; ảnh hưởng còn phụ thuộc cookie, trình duyệt và cách ứng dụng hoạt động.

Khắc phục: cấu hình header frontend `Content-Security-Policy: frame-ancestors 'self'` và `X-Frame-Options: SAMEORIGIN`, hoặc chính sách cấm nhúng nếu phù hợp. Header backend không thay thế header trên tài liệu HTML frontend. [MDN về frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## 6. Tham số danh sách sản phẩm thiếu validation và giới hạn

**Mức độ: thấp; nguy cơ tài nguyên cần đánh giá thêm. Đã xác nhận production.**

| Request | Kết quả |
| --- | --- |
| `/api/products?minPrice=abc` | 500, lỗi chung |
| `/api/products?limit=-1` | 200, chấp nhận limit âm |
| `/api/products?limit=101` | 200, pagination.limit=101, trả 41 sản phẩm hiện có |
| `/api/products?limit=1` | 200, trả 1 sản phẩm |

Controller parse trực tiếp query. Giá không hợp lệ tạo NaN; pagination không bị giới hạn. Đây chưa phải bằng chứng SQL injection hoặc DoS. Không gửi limit cực lớn hoặc lưu lượng cao.

Khắc phục: schema query yêu cầu page/limit là số nguyên dương, limit có ngưỡng tối đa; giá là số hữu hạn hợp lệ; trả 400 cho dữ liệu sai. Áp dụng cho các endpoint public khác có pagination tương tự.

## 7. Cảnh báo thư viện từ lockfile local

`npm audit --omit=dev` báo **25 package entries có cảnh báo: 2 critical, 18 high, 4 moderate, 1 low**. Đây là kết quả phân loại của npm, không đồng nghĩa 25 lỗ hổng có thể khai thác trên website. Workspaces và các dependencies dùng chung khiến danh sách này cần đối chiếu với bản cài/deploy thực tế.

Một số phiên bản trong lockfile: sanitize-html 2.17.3, multer 1.4.5-lts.2, proxy-addr 2.0.7, socket.io-parser 4.2.6, ws 8.18.3, sharp 0.33.5, axios 1.16.0, DOMPurify 3.4.0.

Critical entries là sanitize-html và proxy-addr. Cấu hình rich text hiện có danh sách tags/attributes riêng và frontend dùng DOMPurify; chưa xác nhận bypass XSS của ứng dụng. Rủi ro proxy-addr phụ thuộc cấu hình proxy; không kết luận vượt quyền hoặc giả IP từ kết quả audit.

Khắc phục: cập nhật có kiểm soát, đọc advisory tương ứng, chạy build và kiểm tra đăng nhập/upload/thanh toán. Không dùng `npm audit fix --force` mà chưa đánh giá thay đổi phiên bản.

## Các phép kiểm tra đã chặn đúng

- Không đăng nhập: admin activities/customers, orders, cart, profile, notifications và ảnh chứng từ đơn hàng đều trả 401.
- JWT khai báo `alg=none`, userId=1, role=ADMIN bị endpoint admin từ chối với 401.
- POST login thiếu CSRF trả 403 trước khi xử lý đăng nhập.
- Origin không được phép không nhận `Access-Control-Allow-Origin`; origin frontend thật được cho phép. Header Allow-Credentials đơn lẻ không chứng minh CORS bị vượt qua.
- `/.env` trên frontend trả 403.
- Các URL `/.git/config`, `/package.json`, file `.map` trả HTML SPA; status 200 ở đây không chứng minh lộ file. Không phát hiện nội dung các file đó.
- Backend Render có CSP, X-Frame-Options, HSTS và nosniff trong các phản hồi đã kiểm tra.
- Swagger công khai là thay đổi đã được thực hiện theo yêu cầu trước đó; việc tài liệu công khai không tự chứng minh vượt xác thực API.

## Thứ tự xử lý

1. Đóng webhook MoMo khi thiếu cấu hình, ngăn giả mạo thanh toán.
2. Loại bỏ dữ liệu newsletter khỏi API settings công khai.
3. Bổ sung thu hồi phiên khi logout và đổi/reset mật khẩu.
4. Ép HTTPS và thêm header frontend.
5. Cập nhật dependencies và validation query.

Giới hạn: chưa có tài khoản CUSTOMER/STAFF/ADMIN thử nghiệm, nên chưa xác minh truy cập chéo giữa người dùng, phân quyền nhân viên qua tài khoản thật, upload có xác thực, các luồng thanh toán thật hoặc SQL/XSS bằng khai thác trong trình duyệt. Chưa kiểm tra hạ tầng bên trong, database policies hoặc lịch sử truy cập để kết luận các lỗi đã từng bị khai thác. Báo cáo này không khẳng định website đã an toàn toàn diện.

Chưa sửa mã ứng dụng hoặc triển khai thay đổi trong lượt kiểm tra này.

## Cập nhật sau khi sửa mã nguồn

Theo yêu cầu xử lý lần lượt, đã sửa các vấn đề trên trong mã nguồn local: thanh toán, settings công khai, thu hồi JWT/kết nối, cấu hình HTTPS/header, validation query và dependencies. **Chưa deploy lên production.**

Backend 47 test và frontend 2 test đã passed; cả hai build thành công. `npm audit` và `npm audit --omit=dev` đều báo 0 vulnerability entries. Cấu hình Apache đã nằm trong frontend build, cần kiểm chứng trên hosting sau triển khai.

Chi tiết thay đổi, migration token_version, ảnh hưởng tới phiên đăng nhập và hướng dẫn triển khai: [SECURITY-FIXES-2026-10-09.md](./SECURITY-FIXES-2026-10-09.md). Các phát hiện phía trên là bằng chứng tại thời điểm audit ban đầu, không đại diện cho trạng thái production sau một lần deploy mới.
