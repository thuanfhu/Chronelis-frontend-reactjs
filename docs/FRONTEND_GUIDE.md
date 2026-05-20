# Chronelis Frontend Guide

Tài liệu này mô tả frontend theo code hiện tại trong `Chronelis-frontend-reactjs`. Mục tiêu là giúp người mới join dự án nắm được luồng app, route, page, component, state, API layer và các điểm cần chú ý khi sửa UI.

## 1. Tổng quan kỹ thuật

Frontend là React SPA chạy bằng Vite, TypeScript và React Router. App không gọi API trực tiếp trong component bằng `fetch`; hầu hết request đi qua `src/lib/api/modules/*`, dùng `http.ts` làm axios client chung và dùng TanStack Query để cache/invalidate dữ liệu.

Các thư viện chính:

- React 19, React Router 7, Vite 8, TypeScript 6.
- TanStack Query cho server state.
- Zustand cho client state (`auth-store`, `ui-store`).
- React Hook Form + Zod cho form.
- Radix/shadcn-style components trong `src/components/ui`.
- Lucide/Tabler icons.
- FullCalendar cho calendar.
- DnD Kit cho Kanban/Todo drag and drop.
- TipTap cho task notes rich editor.
- Recharts cho dashboard/chart.
- STOMP WebSocket cho realtime.
- i18next cho đa ngôn ngữ.

## 2. Cấu trúc thư mục quan trọng

| Đường dẫn | Vai trò |
| --------- | ------- |
| `src/app/router/AppRouter.tsx` | Khai báo toàn bộ route chính và guard |
| `src/app/router/guards.tsx` | `ProtectedGuard`, `PublicOnlyGuard`, `AdminGuard` |
| `src/app/providers/AppProviders.tsx` | QueryClient, tooltip, theme sync, realtime provider, toaster |
| `src/app/store/auth-store.ts` | access token, current user, hydrate persisted auth |
| `src/app/store/ui-store.ts` | selected workspace/project, theme, drawer, command palette, delete confirm |
| `src/lib/api/http.ts` | axios base client, auth header, 401/403 handling, unwrap helpers |
| `src/lib/api/query-keys.ts` | query key chuẩn cho TanStack Query |
| `src/lib/api/modules/*` | wrapper API theo backend module |
| `src/features/*` | page và component nghiệp vụ |
| `src/components/layout/*` | App shell, sidebar, topbar |
| `src/components/shared/*` | component dùng chung không gắn chặt domain |
| `src/components/charts/*` | chart dùng ở dashboard/my-work/workspace/project |
| `src/components/ui/*` | UI primitives |
| `src/types/*` | type domain và API |

## 3. Bootstrap, providers và route

`AppProviders` tạo `QueryClient` với `staleTime=30s`, `retry=1` và tắt refetch khi focus lại cửa sổ. Bên trong còn có `ThemeSync`, `RealtimeProvider`, `TooltipProvider` và `Toaster`.

Route chính nằm trong `AppRouter`:

- `/`: landing page.
- Public auth: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/reset-password`, `/verify-account`, `/auth/verify-active-account`.
- Protected auth utility: `/verify-change-email`, `/auth/verify-change-email`.
- App shell: `/dashboard`, `/my-work`, `/workspaces`, `/workspaces/:workspaceId`, `/workspaces/:workspaceId/projects/:projectId`, `/workspaces/:workspaceId/projects/:projectId/goals/:goalId/tasks`, `/workspaces/:workspaceId/projects/:projectId/pomodoro/:taskId`, `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/notes`, `/notifications`, `/profile`.
- Invite route: `/join`, protected nhưng không nằm trong `AppShell`.
- Admin: `/admin`, `/admin/:section`.
- Fallback: `/forbidden`, `*`.

`/workspaces/:workspaceId/projects/:projectId` render `TasksLayout`. Các tab project không dùng route con mà dùng query `?view=calendar|kanban|todo|goals|activity|settings`.

## 4. State và API layer

`auth-store` giữ `accessToken`, `currentUser`, trạng thái hydrate và các action set/clear session. Khi clear session, store cũng dọn context UI liên quan đến workspace/project để tránh UI giữ lựa chọn cũ.

`ui-store` giữ theme, sidebar, command palette, selected workspace/project, task drawer mode (`view`, `edit`, `duplicate`) và delete confirm state. `AppShell` đọc route params để sync selected workspace/project vào store.

`http.ts` là axios client chung:

- base URL lấy từ env và trỏ tới `/api/v1`.
- luôn gửi `withCredentials` để backend nhận refresh cookie.
- gắn `Authorization: Bearer <accessToken>` nếu đang login.
- khi `401`, chỉ clear session nếu token thiếu/hết hạn; một số lỗi permission backend có thể trả `401` nên frontend không logout mù.
- khi `403` trên admin route/admin API, chuyển về `/forbidden`.
- `unwrapData`, `unwrapVoid`, `unwrapPagination` chuẩn hóa response `ApiResponse<T>`.

`query-keys.ts` là contract nội bộ cho cache. Khi thêm API mới, nên thêm query key ở đây trước, rồi dùng thống nhất trong page và mutation invalidation.

## 5. API modules

Các API wrapper hiện có:

- `auth-api`: register, verify active account, resend verify, login, logout, account, refresh, forgot/reset password.
- `user-api`: profile, password, email, verify change email.
- `workspace-api`: workspace CRUD, member list/add/update/delete.
- `workspace-invite-api`: create/list/revoke/validate/join invite.
- `workspace-team-api`: team CRUD và team members.
- `project-api`: project CRUD/status, analytics, project access list/effective/upsert/update/delete.
- `goal-api`: goal CRUD/list.
- `task-api`: task CRUD, project/goal list, my-work, analytics, dependency, move/reorder/assign/completion.
- `task-status-api`: status CRUD/reorder.
- `task-type-api`: task type CRUD/list.
- `task-schedule-api`: schedule CRUD, task schedules, project/workspace calendar.
- `task-comment-api`: comment create/update/delete/list.
- `notification-api`: list, unread count, mark one/all read.
- `activity-log-api`: workspace activity log filters.
- `storage-api`: Azure Blob upload/delete/move.
- `pomodoro-api`: save/list task Pomodoro sessions.
- `admin-user-api`, `admin-role-api`, `admin-permission-api`: admin modules.

## 6. Layout components

### `AppShell`

`AppShell` là layout cho khu vực đã login. Nó render sidebar, topbar, outlet, global task drawer, global delete confirm và command palette. Component này cũng sync `workspaceId/projectId` từ URL vào `ui-store`.

### `AppSidebar`

Sidebar hiển thị cây workspace/project, search, expand/collapse, quick navigation và các action tạo/sửa/xóa project/goal. Nó dùng optimistic cache và deferred delete để user có thể undo xóa trong một khoảng ngắn.

### `AppTopbar`

Topbar chứa workspace selector, nút tạo/sửa workspace, notification indicator, theme/language switcher, command palette trigger và user menu. Admin user có link vào khu vực admin.

### `AdminShell` và `AdminSidebar`

Admin shell tách khỏi app shell chính. Nó render navigation cho `users`, `roles`, `permissions` và đặt context cho admin pages.

## 7. Pages public và auth

### `LandingPage`

Trang giới thiệu sản phẩm. Có visual components (`ColorBends`, `Prism`, `Aurora`, `TrueFocus`, `ScrollReveal`, `ScrollFloat`), logo, CTA, language/theme toggle và user menu nếu đã login.

### `AuthSlidingPage`

Màn auth dạng sliding panel gom login, register và forgot password. Form dùng React Hook Form/Zod. Login nhận email hoặc phone, register gửi email verify và có cooldown resend, forgot password gửi email reset.

### `ResetPasswordPage`

Đọc token từ query, validate form password mới và gọi reset password API. Nếu route đến từ `/auth/reset-password`, vẫn dùng cùng page.

### `VerifyAccountPage`

Đọc token verify active account từ query, gọi API verify và hiển thị trạng thái thành công/thất bại/resend.

### `VerifyEmailChangePage`

Route protected cho flow đổi email. User phải đang login, page gọi verify change email token.

## 8. Pages trong AppShell

### `DashboardPage`

Dashboard lấy workspace page đầu, unread count và my-work snapshot. Page dùng metric cards và chart để tóm tắt task cá nhân, workspace gần đây và trạng thái công việc.

### `MyWorkPage`

Execution hub cá nhân. Page gọi `/tasks/my-work` và `/tasks/analytics`, sau đó resolve project directory từ project IDs trong task. UI chia task blocked/ready, hỗ trợ search, priority filter, sort, pagination và mở `TaskDetailsDrawer`.

### `WorkspacesPage`

Liệt kê workspace, tạo/sửa/xóa workspace, thống kê tăng trưởng và trạng thái. Xóa workspace dùng deferred delete stack để có undo trước khi mutation thật chạy.

### `WorkspaceDetailPage`

Màn chi tiết workspace, gom nhiều domain nhất:

- workspace detail
- members
- projects
- invites
- teams
- team membership map

Owner có thể thêm member, tạo/revoke invite, tạo/sửa/xóa team, thêm/xóa team member và tạo/sửa/xóa project. Page dùng `useWorkspaceRealtime` để refresh cache khi có event.

### `JoinByInvitePage`

Màn `/join?code=...` validate invite code, hiển thị thông tin workspace và gọi join. Route protected để backend biết user nào đang join.

### `NotificationsPage`

Liệt kê notification, mark one read, mark all read và invalidate unread count. Realtime provider đẩy notification mới vào cache.

### `ProfilePage`

Profile cá nhân gồm update thông tin, đổi email và đổi password. Page có country/city helper query và cập nhật lại `auth.me` cache/auth store sau khi lưu.

## 9. Project workspace và task views

### `TasksLayout`

Project shell dùng `workspaceId`, `projectId`, `view` query param. Nó tải project context và render tab:

- `calendar`: lịch công việc.
- `kanban`: board theo status.
- `todo`: list task tập trung xử lý.
- `goals`: goal management.
- `activity`: audit log.
- `settings`: cấu hình project.

### `KanbanPage`

Kanban dùng DnD Kit cho column/card. Nó query tasks, statuses và project permissions. Các mutation chính:

- create/update/reorder status.
- move task giữa status.
- reorder task trong status.
- mở task drawer/context menu/create dialog.

Optimistic cache giúp board phản hồi ngay trước khi backend trả kết quả.

### `TodoPage`

Todo view tập trung thao tác nhanh. Có group none/day/goal, date filter qua `todoDate`, priority filter, show completed, drag/reorder, toggle completion và shortcut mở timer/notes/drawer.

### `CalendarPage`

Calendar dùng FullCalendar. Nó query lịch theo project trong khoảng `fromDate/toDate`, cho phép tạo schedule/task, kéo thả schedule, resize duration và mở task detail. Permission quyết định user được tạo/sửa lịch hay chỉ xem.

### `GoalsPage`

Quản lý goal trong project. Page query project, workspace, members, teams, team memberships, goals và tasks của project. Owner/manager có thể tạo/sửa/xóa goal, assign manager user/team và xem task gắn goal.

### `GoalTasksPage`

Route riêng cho task của một goal. Page query goal detail và task theo goal, có search/filter/sort/pagination để drill-down theo mục tiêu.

### `ActivityLogPage`

Hiển thị audit log workspace, filter theo project thông qua query `actorId=project:{projectId}`. Dùng realtime project để refresh khi có action mới.

### `ProjectSettingsPage`

Project settings gồm:

- sửa tên/mô tả/status/visibility project.
- `ProjectTaskTypesTab`: CRUD task type với màu, icon, scope goal hoặc toàn project.
- project access management: cấp quyền cho user/team với role `MANAGER`, `CONTRIBUTOR`, `VIEWER`, hiển thị provenance `grantedBy`.

Permission UI cần đọc kỹ `EffectiveProjectAccessResponse`, đặc biệt các boolean như `canManageProjectAccess`, `canChangeVisibility`, `canGrantManager`, `canRevokeManager`.

### `ProjectOverviewPage`

Component này vẫn tồn tại trong source nhưng không được route chính trong `AppRouter` hiện tại. Nếu muốn dùng lại, cần cập nhật navigation vì app hiện điều hướng project tab bằng query `view`, không dùng route con kiểu `/kanban`.

## 10. Task components

### `TaskCreateDialog`

Dialog tạo task. Nó tải statuses, goals, members, task types và project tasks để hỗ trợ:

- chọn status/priority/goal/assignee/task type.
- nhập due date, estimate, description.
- tạo schedule ban đầu.
- chọn dependencies và blocker note.

Sau khi tạo task, dialog có thể gọi thêm assign/schedule/dependency APIs rồi invalidate task, my-work, calendar và schedule caches.

### `TaskDetailsDrawer`

Drawer task dùng chung toàn app. Nó query task detail, goals, members, dependencies, project tasks, schedules và comments. Drawer hỗ trợ:

- view/edit/duplicate mode.
- cập nhật title, description, priority, due date, estimate, goal, assignee, task type.
- cập nhật dependency/blocker.
- cập nhật schedule.
- toggle completion optimistic.
- comment/reply/edit/delete.
- mở notes hoặc Pomodoro.

### `TaskCommentsPanel` và `TaskCommentsDialog`

Hiển thị threaded comments. Logic quyền xóa/sửa dựa trên author và project permission. Khi mutate comment, cache task comments được cập nhật/invalidate.

### `TaskDeleteConfirmDialog`

Xóa task toàn cục với undo window. Component tạm remove task khỏi cache detail/project/goal/calendar/schedules/comments, sau đó finalize delete hoặc restore nếu user undo.

### `TaskContextMenu`

Menu thao tác nhanh trên task card/list/event: open detail, edit, duplicate, notes, pomodoro, delete và các action domain khác tùy ngữ cảnh.

### `TaskNotesPage`

Rich text editor dùng TipTap. Ảnh paste/drag/drop upload qua `storageApi.uploadSingle` vào folder `task-notes/{taskId}`. Nội dung cuối cùng lưu vào `task.notesHtml`. Editor có toolbar cho heading, bold/italic/underline, list, quote, code, màu chữ, highlight, cỡ chữ; khi chọn ảnh có thể zoom in/out, căn trái/giữa/phải hoặc xóa ảnh.

### `TaskPomodoroPage`

Timer có focus, short break, long break. Focus duration khởi tạo từ `estimatedMinutes` của task, giới hạn trong khoảng hợp lý. Khi hoàn tất focus session, page gọi `pomodoroApi.saveSession(taskId, { durationMinutes, startedAt, endedAt })` và hiển thị lịch sử session của user hiện tại.

## 11. Workspace/project components

### `ProjectFormFields`

Form fields dùng chung khi tạo/sửa project: name, description, visibility, manager user, manager team. Component giúp giữ form project nhất quán giữa workspace detail/sidebar/settings.

### `ProjectTaskTypesTab`

Tab quản lý task type trong project settings. Nó list task types, tạo/sửa/xóa type và invalidate cache `taskTypes.byProject(projectId)`.

### `ProjectMembersList`

Component hiển thị member/project-related people để các màn project dễ dùng lại.

### `SearchableSelectPopover`

Select có search, dùng cho các form chọn user/team/project/task. Nên ưu tiên dùng component này thay vì tự dựng dropdown mới khi option list dài.

## 12. Admin features

### `AdminDashboardPage`

Đọc `section` từ URL và render users/roles/permissions. Nếu section không hợp lệ, page xử lý fallback về section mặc định.

### Users module

Gồm `UsersProvider`, users table, toolbar, row actions, action dialog, invite dialog và delete dialog. Dùng admin user API để list/update/delete user và remove roles. Khi mở rộng flow tạo staff/onboarding, cần rà lại context này vì current UI có một số nhánh phụ thuộc contract backend hiện tại.

### Roles module

Gồm `RolesProvider`, table, form dialog, delete dialog và row actions. Hỗ trợ tạo/sửa/xóa role, list permission gắn role và gỡ permission khỏi role.

### Permissions module

Gồm `PermissionsProvider`, tree/table, create module dialog, form/delete dialog. UI có group theo module, search, expand/collapse và sortable tree để quản lý permission/module.

## 13. Shared components và hooks

- `CommandPalette`: mở bằng Ctrl/Cmd+K, navigate nhanh dashboard/workspace/notification và toggle theme.
- `DeferredDeleteStack` + `useDeferredDelete`: cơ chế undo delete cho workspace/project/task.
- `PageHeader`: header thống nhất cho page.
- `LoadingPanel`: trạng thái loading có khung chuẩn.
- `EmptyState`: trạng thái không có dữ liệu.
- `ConfirmModal`: modal xác nhận chung.
- `LanguageSwitcher`, `ThemeLanguageToggle`: đổi ngôn ngữ và theme.
- `use-dialog-state`: hook quản lý open/close dialog.

## 14. Charts

Chart components nằm trong `src/components/charts` và dùng Recharts:

- `TaskHealthDonut`: tỷ lệ healthy/blocked/overdue.
- `PriorityBarChart`, `PriorityPieChart`, `PriorityComposedChart`: task theo priority.
- `DailyAreaChart`, `CompletionLineChart`: trend theo ngày.
- `GrowthComposedChart`: tăng trưởng workspace/project.
- `ProjectStatusDonut`, `ProjectCombinedChart`: thống kê project.
- `TaskStatusBarChart`: task theo status.

Khi thêm chart mới, nên nhận data đã normalize từ page/container thay vì để chart tự gọi API.

## 15. Realtime và cache invalidation

Các hook realtime có nhiệm vụ lắng nghe event từ backend rồi invalidate hoặc patch cache liên quan. Quy tắc chung:

1. Event workspace chỉ nên ảnh hưởng workspace detail/list, members, teams, invites và projects thuộc workspace.
2. Event project/task chỉ nên ảnh hưởng cache của project hiện tại, task detail, comments, schedules, my-work và analytics khi cần.
3. Notification event cập nhật list notification và unread count.
4. Mutation optimistic phải có rollback hoặc invalidate cuối cùng để tránh cache lệch backend.

## 16. Permission model frontend cần nhớ

Workspace role hiện tại là `OWNER` hoặc `MEMBER`. Không còn workspace `ADMIN` trong code hiện tại.

Project access mới là nơi phân quyền thao tác project:

- `MANAGER`: quản lý project work và có thể quản lý nhiều action theo effective access.
- `CONTRIBUTOR`: tạo/sửa công việc cơ bản, comment, tham gia thực thi.
- `VIEWER`: xem project/task.

Project có `visibility`:

- `PUBLIC`: member workspace có quyền mặc định để tham gia theo backend.
- `PRIVATE`: cần owner hoặc grant user/team phù hợp.

Frontend không nên tự suy luận quyền từ role hệ thống. Khi cần enable/disable action, ưu tiên dùng `/projects/{projectId}/access/me` và các boolean trong `EffectiveProjectAccessResponse`.

## 17. Quy ước khi thêm/sửa frontend

1. Thêm API wrapper trong `src/lib/api/modules` trước khi gọi từ page.
2. Thêm query key trong `query-keys.ts` nếu API có cache.
3. Dùng `unwrapData`, `unwrapVoid`, `unwrapPagination` thay vì đọc response thô.
4. Mutation phải invalidate đúng cache domain liên quan.
5. Với task/project/workspace delete, cân nhắc dùng deferred delete nếu UX cần undo.
6. Không hard-code `/api/v1` trong component; dùng module API.
7. Không dùng route `/focus/:taskId`; Pomodoro hiện là `/pomodoro/:taskId`.
8. Với project tab, dùng `?view=` để giữ đúng router hiện tại.
9. Với UI permission, không thêm lại workspace `ADMIN` label/union.

## 18. Ghi chú rủi ro hiện tại

- `ProjectOverviewPage` chưa được route chính; các link bên trong cần rà lại trước khi bật.
- Admin users flow cần rà lại nếu backend bổ sung API tạo staff/user chính thức.
- Một số optimistic update phức tạp ở task/calendar/kanban cần kiểm tra rollback kỹ khi thay backend contract.
- Notes editor lưu HTML trực tiếp vào `notesHtml`; nếu backend đổi sanitizer/policy, frontend cần cập nhật editor và upload flow tương ứng.

## 19. Thứ tự đọc khuyến nghị cho người mới

1. Đọc `src/app/router/AppRouter.tsx` để hiểu navigation.
2. Đọc `src/lib/api/http.ts` và `src/lib/api/query-keys.ts` để hiểu data layer.
3. Đọc `src/components/layout/app-shell.tsx`, `app-sidebar.tsx`, `app-topbar.tsx`.
4. Đọc `src/pages/dashboard-page.tsx` và `src/pages/my-work-page.tsx`.
5. Đọc `src/features/workspaces/workspace-detail-page.tsx`.
6. Đọc `src/features/tasks/tasks-layout.tsx`, sau đó `kanban-page.tsx`, `todo-page.tsx`, `calendar-page.tsx`.
7. Đọc `task-create-dialog.tsx`, `task-details-drawer.tsx`, `task-delete-confirm-dialog.tsx`.
8. Đọc `project-settings-page.tsx` để hiểu project access và task types.
9. Đọc admin modules nếu cần làm RBAC/admin.
