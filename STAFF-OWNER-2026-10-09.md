# Staff Management và Owner — 09/10/2026

## Tài khoản đã cấp

Đã nâng tài khoản hiện có `admin` (ID 1) trong cơ sở dữ liệu cấu hình tại `backend/.env` lên Owner, kích hoạt tài khoản và đặt mật khẩu theo yêu cầu của chủ website. Mật khẩu được băm bằng bcrypt; không lưu mật khẩu rõ trong mã nguồn hoặc tài liệu này.

Đã xác minh bằng backend vừa build: đăng nhập với mật khẩu đã cung cấp thành công; login, profile và xác thực token đều trả `OWNER`. Các mã đặt lại mật khẩu cũ được xóa và `token_version` được tăng.

Owner lưu dưới dạng `role = ADMIN` cùng `is_owner = true`, để backend cũ vẫn đọc được tài khoản. Backend mới chuyển thành quyền `OWNER` khi xác thực và trả dữ liệu ra API. Backend cũ chưa có cơ chế bảo vệ Owner; cần triển khai backend mới để áp dụng phân cấp này.

## Thay đổi đã làm

- Phân cấp: **Owner > Admin > Manager > Staff**. Owner quản lý Admin; các vai trò chỉ sửa tài khoản cấp thấp hơn mình. Owner được bảo vệ khỏi sửa/xóa qua Staff API; không cho tự sửa quyền hoặc tự khóa tài khoản qua chức năng này.
- Người được giao quản lý nhân viên chỉ được cấp các quyền mình đang có. API kiểm tra độc lập với giao diện, bao gồm chức năng khôi phục từ Activity Logs.
- Đổi mật khẩu, quyền, vai trò hoặc trạng thái tăng phiên bản token và đóng kết nối đang hoạt động trên backend mới.
- Staff Management có ba thống kê, bảng gọn trên máy tính và thẻ trên điện thoại; tìm kiếm, lọc, phân trang và thao tác hàng loạt có báo lỗi từng phần.
- Panel chỉnh sửa gồm Information, Permissions, History; mẫu quyền theo công việc, xem phạm vi truy cập và lịch sử có người thực hiện. Không trả mật khẩu hoặc hash trong lịch sử.
- Khóa nút khi đang lưu; giữ nội dung khi lưu thất bại; hỏi trước khi bỏ thay đổi. Menu thao tác và hộp xác nhận hỗ trợ bàn phím.

## Kiểm tra

- Backend: **71 kiểm thử / 10 bộ đạt**; Prisma generate và TypeScript build thành công.
- Frontend: **9 kiểm thử / 2 bộ đạt**; TypeScript và Vite build thành công.
- `npm audit`: **0 lỗ hổng**; `git diff --check` đạt.
- Kiểm tra trình duyệt Edge bằng Playwright với API giả lập ở 1440px và 390px: Owner vào trang quản trị, menu nằm trong màn hình, điện thoại không tràn ngang, hủy xác nhận giữ thay đổi, lịch sử hiển thị và form thiếu dữ liệu trở về Information. Không ghi dữ liệu thật từ kiểm tra giao diện.
- Tài khoản thật đã được kiểm tra qua dịch vụ đăng nhập và xác thực backend mới, không in JWT hoặc mật khẩu.

## Triển khai

Mã nguồn chưa được commit, push hoặc triển khai trong lần làm việc này. Thay đổi tài khoản trong DB đã hoàn tất.

1. Triển khai backend mới trên Render trước. Build dùng `npm run build --workspace backend`; Start dùng `npm start --workspace backend` khi chạy từ gốc workspace. Nếu Render đang đặt Root Directory là `backend`, giữ lệnh tương ứng `npm run build` / `npm start`.
2. Startup tự thêm cột `is_owner` và `token_version` nếu thiếu, trước khi mở server. Có migration `0007_owner_flag`; không chạy lại seed để cấp Owner. Lưu ý migration khởi tạo cũ của repo có nội dung lỗi được ghi vào file; không chạy toàn bộ migration cũ trực tiếp lên DB đang dùng.
3. Triển khai nội dung `frontend/dist` vừa build lên hosting chính, bao gồm `.htaccess`.
4. Đăng nhập lại bằng tài khoản `admin`; profile phải trả `role: OWNER`, badge hiển thị Owner và Staff Management cho phép quản lý Admin.

CLI cấp Owner cho tài khoản hiện có: `npm run owner:provision --workspace backend`, nhận `OWNER_USERNAME` / `OWNER_PASSWORD` từ môi trường tạm thời. Không cần chạy lại cho `admin` sau lần cấp này và không lưu hai biến đó vào repo.
