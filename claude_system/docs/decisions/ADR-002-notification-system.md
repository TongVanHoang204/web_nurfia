# ADR-002: Notification System Architecture

## Status
Proposed

## Context
Dự án `Web_klbtheme` hiện tại chưa có hệ thống thông báo người dùng (User Notification). Cần thiết kế một module có khả năng:
1. Lưu trữ thông báo một cách có cấu trúc trong Database.
2. Cho phép User xem lại lịch sử thông báo, đánh dấu đã đọc.
3. Nhận thông báo Real-time (thời gian thực) ngay khi có sự kiện (ví dụ: trạng thái đơn hàng thay đổi).

## Decision
Chúng ta sẽ triển khai hệ thống thông báo sử dụng kiến trúc **Polling + Real-time Push**:

1. **Lưu trữ dữ liệu**: Sử dụng MySQL thông qua Prisma ORM. Một bảng `Notification` sẽ liên kết với `User` (1-N).
2. **Real-time Engine**: Tái sử dụng `socket.io` đang có sẵn trong project. Backend sẽ có một helper để `emit` event `new_notification` tới room được định danh theo `userId` (vd: `room:user_{id}`).
3. **Frontend State**: Dùng `Zustand` store để giữ trạng thái toàn cục của thông báo (danh sách và bộ đếm chưa đọc).
4. **API Layer**: Cung cấp các endpoint chuẩn REST (`GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`).

## Consequences
### Positive
- Dễ dàng tích hợp với các module khác (VD: Order Service có thể gọi hàm helper để tạo và push thông báo).
- Trải nghiệm người dùng mượt mà nhờ Socket.io.
- Tận dụng tốt các stack có sẵn (Prisma, Socket.io, Zustand) mà không cần cài thêm dependency lạ.

### Negative
- Sẽ cần cẩn thận quản lý kết nối Socket.io để tránh memory leak.
- Cơ sở dữ liệu sẽ tăng nhanh chóng nếu có nhiều thông báo (cần cơ chế dọn dẹp định kỳ cho các thông báo cũ).

### Neutral
- Hiện tại tập trung vào In-App Notification. Chưa hỗ trợ Web Push Notification hoặc Email Notification trực tiếp từ module này (dù có thể mở rộng sau này).
