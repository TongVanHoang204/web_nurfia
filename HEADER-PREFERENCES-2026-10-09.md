# Thông báo, giao diện sáng–tối và ngôn ngữ

## Thay đổi

- Header cửa hàng và quản trị có nút sáng–tối, chọn EN/VI. Lựa chọn được lưu theo trình duyệt, đồng bộ giữa các tab. Khi chưa chọn giao diện, dùng tùy chọn hệ điều hành.
- Theme áp dụng cho nền, chữ, bảng, input, menu, modal và các trang quản trị/cửa hàng; giữ màu ảnh sản phẩm và ảnh chiến dịch.
- Dùng `i18next` và `react-i18next`, tài nguyên offline tại `frontend/src/i18n/locales/en.json` và `vi.json`. Đổi ngôn ngữ không remount biểu mẫu. Nhãn, nút và ngày tháng dùng ngôn ngữ đã chọn; nội dung sản phẩm, bài viết và tin nhắn do người dùng nhập giữ nguyên.
- Dropdown thông báo có thẻ trạng thái, biểu tượng theo loại, thời gian tương đối, trạng thái chưa đọc, mở chi tiết và hỗ trợ Escape.
- Thông báo đơn hàng mở chi tiết theo ID, kể cả đơn ngoài trang danh sách hiện tại; liên hệ mở đúng tin nhắn; sản phẩm mở trình chỉnh sửa theo ID; cảnh báo tồn kho lọc đúng SKU và mở nhóm biến thể.
- “Tải thêm” nối danh sách và bỏ bản ghi trùng; phân trang trang quản trị vẫn thay trang bình thường.
- Đường dẫn thông báo kiểm tra URL nội bộ và quyền truy cập. API GET chi tiết đơn hàng/liên hệ vẫn yêu cầu quyền của từng mục quản trị.
- Thông báo liên hệ mới lưu contactId. Thông báo cũ chỉ suy ra ID khi dữ liệu và thời điểm xác định duy nhất một tin nhắn; trường hợp đã xóa hoặc không rõ giữ trang danh sách.

## Kiểm chứng

- Backend: 85 kiểm thử, 12 bộ kiểm thử đạt.
- Frontend: 22 kiểm thử, 7 bộ kiểm thử đạt.
- Build TypeScript/Vite frontend và Prisma/TypeScript backend đạt.
- Kiểm tra Edge headless bằng API giả lập: các liên kết chi tiết, đóng dropdown, lưu theme/ngôn ngữ, giữ mật khẩu đang nhập khi đổi ngôn ngữ, các trang quản trị và màn hình 390px; không có lỗi JavaScript hay tràn ngang.
- Dependency audit production: 0 lỗ hổng.
- Dữ liệu thử hoàn toàn giả lập; chưa deploy hoặc ghi dữ liệu trên hệ thống thật.

## Cập nhật hosting

1. Commit/push backend và frontend; triển khai backend trên Render trước. Bản này cũng chứa sửa phân quyền Admin của Owner từ tác vụ trước.
2. Tải `dist/dist.zip` lên hosting và giải nén trực tiếp vào `public_html`. `index.html`, `.htaccess`, `assets` phải nằm ngay bên trong `public_html`; không giải nén vào `assets`.
3. Tải lại web bằng Ctrl+F5, kiểm tra header EN/VI và biểu tượng mặt trăng/mặt trời.

ZIP dùng dấu `/` cho đường dẫn để tương thích giải nén trên Linux.
