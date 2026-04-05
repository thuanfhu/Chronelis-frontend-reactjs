# Chronelis Frontend (React + Vite)

Frontend chính của Chronelis, xây dựng bằng React 19 + TypeScript + Vite.

## 1) Tech Stack

- React 19
- TypeScript
- Vite 8
- React Router
- TanStack Query
- Zustand
- Axios
- Framer Motion
- Radix UI + shadcn-style components
- FullCalendar
- STOMP WebSocket client

## 2) Features

- Auth UI (sliding login/register) + forgot/reset/verify account
- Password visibility toggle trong các form auth có password
- Password strength indicator khi đăng ký
- Smooth transition từ login -> forgot password
- Verify-change-email page theo backend email flow
- Dashboard, workspaces, projects, goals, tasks, calendar, comments, notifications
- Admin dashboard (tab Users / Roles / Permissions) với guard theo role `ADMIN`
- Realtime notifications qua WebSocket

## 3) Environment

Tạo file `.env` ở root frontend:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Ghi chú:
- App tự suy ra WebSocket URL từ `VITE_API_BASE_URL` (`/ws`).
- Axios được cấu hình `withCredentials=true` để dùng refresh cookie.

## 4) Run Locally

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
npm run preview
```

## 5) Scripts

- `npm run dev`: chạy môi trường development
- `npm run build`: type-check + build production
- `npm run lint`: chạy ESLint
- `npm run preview`: preview bản build

## 6) Auth Routes

Public routes:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/auth/reset-password` (alias theo link email backend)
- `/verify-account`
- `/auth/verify-active-account` (alias theo link email backend)

Protected routes (không cần AppShell):

- `/verify-change-email`
- `/auth/verify-change-email` (alias theo link email backend)

Protected routes (trong AppShell):

- `/dashboard`
- `/workspaces`
- `/workspaces/:workspaceId`
- `/workspaces/:workspaceId/projects/:projectId`
- `/workspaces/:workspaceId/projects/:projectId/pomodoro/:taskId`
- `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/notes`
- `/notifications`
- `/profile`
- `/join`
- `/admin` (chỉ role `ADMIN`)

## 7) Admin Dashboard

Trang `/admin` gồm 3 tab:

- Users: sửa thông tin user, add/remove role, xóa user
- Roles: tạo/sửa/xóa role, add/remove permissions cho role
- Permissions: tạo/sửa/xóa permission, tạo/xóa module

Lưu ý theo behavior backend:

- Update role với `permissionIds` là add thêm, không replace toàn bộ.
- Update user admin với `roleIds` là add thêm role, muốn gỡ role dùng endpoint delete roles.
- UI dùng update payload theo diff để giảm lỗi do gửi field không đổi.

## 8) API Integration Notes

- Tất cả endpoint dùng base `/api/v1`.
- Response được unwrap theo chuẩn `{ success, message, data, meta }`.
- Endpoint trả `void` dùng `unwrapVoid` thay vì `unwrapData`.
- 401 sẽ clear session và điều hướng về `/login`.
- 403 sẽ điều hướng về `/forbidden`.

## 9) Backend Alignment

Frontend đã align với backend email links:

- `/auth/verify-active-account?token=...`
- `/auth/verify-change-email?token=...`
- `/auth/reset-password?token=...`

Ngoài ra vẫn hỗ trợ route cũ tương đương để tương thích ngược.

## 10) Recommended Local Setup

1. Chạy backend trước tại `http://localhost:8080`.
2. Cấu hình `VITE_API_BASE_URL` trỏ đúng backend.
3. Chạy frontend `npm run dev` tại `http://localhost:5173`.
4. Đảm bảo cookie/credentials không bị chặn bởi CORS hoặc domain mismatch.
