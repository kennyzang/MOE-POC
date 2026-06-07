# Mobile 教师端功能补全计划

> **日期**: 2026-06-07
> **目标**: 补齐 PC 有但移动端缺失的教师端功能，确保演示体验完整
> **优先级**: 演示前必须完成 (T-3 days)

---

## 背景分析

对比 PC 端 `routes.tsx` 和移动端 `App.tsx` 的教师路由，发现以下 Gap：

| # | PC 功能 | 移动端现状 | 演示影响 |
|---|---------|-----------|:--------:|
| 1 | Messages (`/teacher/messages`) | 缺失 | 🔴 高 — 演示脚本多次提到 notification |
| 2 | Profile (Self Service / Profile) | 缺失 | 🟡 中 — 学生/家长都有，教师没有 |
| 3 | Announcements Tab 入口 | 路由存在但无 Tab | 🟡 中 — 用户找不到 |

---

## 功能清单

### Feature 1: TeacherMessagesPage (教师消息中心)

**文件**: `mobile/src/pages/teacher/TeacherMessagesPage.tsx` (新建)
**路由**: `/teacher/messages`

**功能点**:
- [x] 消息线程列表（来自家长的消息会话）
- [x] 未读计数 Badge
- [x] 下拉刷新
- [x] 空状态提示
- [x] Loading 骨架屏
- [x] 点击进入对话详情页（复用 ParentMessageDetailPage 或新建）
- [x] 对话详情：消息气泡列表（左右区分发送者）
- [x] 回复输入框 + 发送按钮
- [x] 发送成功后自动刷新

**参考**: `ParentMessagesPage.tsx` + PC `TeacherMessagesPage.tsx`

**API 依赖**:
- `GET /messages/threads` — 获取消息线程列表
- `GET /messages/threads/:id` — 获取对话详情
- `POST /messages/threads/:id/reply` — 回复消息

---

### Feature 2: TeacherProfilePage (教师个人资料)

**文件**: `mobile/src/pages/teacher/TeacherProfilePage.tsx` (新建)
**路由**: `/teacher/profile`

**功能点**:
- [x] 头像卡片（姓名、Staff ID、部门）
- [x] 基本信息 List（职位、学历、科目、入职日期、状态）
- [x] 联系信息（Email）
- [x] 课程分配摘要（课程数、学生总数）
- [x] 统计卡片（本月考勤率、CPD 学时）
- [x] Loading 状态

**参考**: `StudentProfilePage.tsx` + PC Self Service Portal

**API 依赖**:
- `GET /teachers/me` — 教师个人信息（含 courseAssignments）
- `GET /dashboard/stats` — Dashboard 统计数据
- `GET /staff-attendance/today` — 今日打卡状态
- `GET /staff-attendance/history?period=month` — 月度考勤统计

---

### Feature 3: TabBar 更新 (Announcements + Profile 入口)

**文件**: `mobile/src/components/RoleTabBar.tsx` (修改)

**改动**:
- [x] 教师 Tab 从 4 个增加到 5 个：Home / Classes / Grades / Announcements / Attendance
- [x] 或改为 5 个：Home / Classes / Grades / Attendance / Profile（根据空间考虑）
- [x] 新增图标选择（Bell/Megaphone for Announcements, User for Profile）

**决策**: 增加到 5 个 Tab，移动端底部导航可以容纳。最终方案：
> Home / Classes / Grades / **Announcements** / Attendance / **Profile** → 6 个可能太挤
>
> **最终方案**: Home / Classes / Grades / Attendance / **More** (弹出菜单含 Announcements + Profile + Messages)
>
> **简化方案**: 直接加到 5 个 Tab：Home / Classes / Grades / Announcements / Attendance（Profile 从首页入口进入，Messages 从通知入口进入）

---

### Feature 4: i18n 翻译键补充

**文件**: `mobile/src/locales/en.ts`, `zh.ts`, `ms.ts` (修改)

**新增键**:
```
teacher.messages        = 'Messages'
teacher.profile         = 'Profile'
teacher.staffId         = 'Staff ID'
teacher.department      = 'Department'
teacher.designation     = 'Designation'
teacher.qualification   = 'Qualification'
teacher.subjects        = 'Subjects'
teacher.joinDate        = 'Join Date'
teacher.status          = 'Status'
teacher.monthlyAttend   = 'Monthly Attendance'
teacher.cpdHours        = 'CPD Hours'
teacher.noMessages      = 'No messages from parents yet'
teacher.replyPlaceholder = 'Type a reply...'
teacher.sent            = 'Sent'
teacher.messageDetail   = 'Conversation'
```

---

## 完成情况追踪

| # | 功能 | 状态 | 完成时间 | 备注 |
|---|------|:----:|:--------:|------|
| F1 | TeacherMessagesPage | ✅ 完成 | 2026-06-07 | 含列表+详情+回复，下拉刷新，未读Badge |
| F2 | TeacherProfilePage | ✅ 完成 | 2026-06-07 | 含头像卡片+统计+个人信息+课程分配 |
| F3 | TabBar 更新 | ✅ 完成 | 2026-06-07 | 教师Tab增至5个：Home/Classes/Grades/Announcements/Attendance |
| F4 | i18n 翻译 | ✅ 完成 | 2026-06-07 | en/zh/ms 三语共18个新键 |
| V1 | 构建验证 | ✅ 通过 | 2026-06-07 | `npm run build` 零错误 |
| V2 | 演示走查 | ⬜ 待验证 | — | teacher01 全流程 |

---

## 文件变更清单

| 操作 | 文件路径 |
|------|---------|
| **新建** | `mobile/src/pages/teacher/TeacherMessagesPage.tsx` |
| **新建** | `mobile/src/pages/teacher/TeacherProfilePage.tsx` |
| **修改** | `mobile/src/components/RoleTabBar.tsx` |
| **修改** | `mobile/src/App.tsx` (注册新路由) |
| **修改** | `mobile/src/locales/en.ts` |
| **修改** | `mobile/src/locales/zh.ts` |
| **修改** | `mobile/src/locales/ms.ts` |
