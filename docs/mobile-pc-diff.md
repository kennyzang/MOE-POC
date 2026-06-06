# 移动端 (Mobile) vs 桌面端 (PC) 差异分析

两个前端共享同一个后端 API (`backend/`, Express + Prisma + SQLite)，但定位和实现差异明显。

---

## 一、技术栈版本差异

| 维度 | Mobile | PC |
|------|--------|-----|
| **React** | 18.3 | 19.2 |
| **TypeScript** | 5.4 | 6.0 |
| **Vite** | 5.3 | 8.0 |
| **UI 库** | antd-mobile 5.39 | antd 6.4 |
| **路由** | react-router-dom 6.23 | react-router-dom 7.15 |
| **状态管理** | zustand 4.5 | zustand 5.0 |
| **表单方案** | 无专用库 | React Hook Form + Zod |
| **图表** | 无 | Recharts 3.8 |
| **ESLint** | 传统配置 | 9.x flat config |

> PC 端技术栈整体领先 **1-2 个大版本**，React 19 / TS 6 / Vite 8 均为当前最新一代。

---

## 二、功能范围差异

| 模块 | PC (桌面端) | Mobile (移动端) |
|------|:----------:|:--------------:|
| **页面数量** | ~90 个页面 | ~10 个页面 |
| **支持角色** | 11 种角色 | 3 种角色 (学生/家长/教师) |
| **SIS 学生信息系统** | ✅ 完整 (目录/详情/招生/成绩/考勤/费用/行为) | ⚠️ 仅成绩+考勤 |
| **EMS 教育者管理** | ✅ 完整 (教师目录/认证/工作量/绩效/请假/CPD/退休/表彰) | ❌ 无 |
| **SMS 学校管理** | ✅ 完整 (课程/资源/课表/校历/财务/图书馆/库存/考试/CCA) | ❌ 无 |
| **考勤** | ✅ 员工签到+历史+仪表盘 | ⚠️ 仅学生考勤+缺席原因 |
| **招生管理** | ✅ 完整流程 | ❌ 无 |
| **财务** | ✅ 报表+费用 | ❌ 无 |
| **AI 聊天助手** | ✅ SSE 流式响应浮动窗 | ❌ 无 |
| **PWA 离线** | ❌ 无 | ✅ Service Worker + 离线缓存 |
| **Web Push 通知** | ❌ 无 | ✅ VAPID 推送订阅 |

> **PC 端是完整的管理系统**，覆盖所有角色和模块；**Mobile 端是轻量门户**，只提供家长/学生/教师的核心日常功能。

---

## 三、架构设计差异

| 维度 | PC | Mobile |
|------|-----|--------|
| **布局** | Sider 侧边栏 + Header 顶栏 + Content 三区布局 | NavBar 顶栏 + TabBar 底栏 |
| **导航** | 多级侧边菜单 (角色过滤) | 底部 3-4 个 Tab 切换 |
| **路由** | `createBrowserRouter` + `React.lazy` 懒加载 + 角色路由守卫 | 简单组件路由 + `RequireAuth` |
| **Store 数量** | 4 个 (auth/language/notification/ui) | 2 个 (auth/language) |
| **组件复用** | CSS Modules + ErrorBoundary + PageLoader + FileUploader + SyncBadge | 无模块化 CSS，组件较简单 |
| **i18n 规模** | ~92KB (en 36KB / zh 27KB / ms 29KB) | ~360 行 (每种语言 ~120 行) |

---

## 四、PC 端独有功能

### 4.1 布局组件
- **AppLayout**：Sider + Header + Content 三区经典管理后台布局
- **Sidebar**：多级侧边菜单 (角色动态过滤，19KB 大型组件)
- **Navbar**：面包屑导航 + 语言切换 + 通知铃铛 + 用户下拉菜单

### 4.2 业务组件
- **ErrorBoundary**：页面级错误边界，崩溃时显示 Ant Design Result
- **PageLoader**：页面加载 Spin
- **FileUploader**：文件上传 + 预览 (Ant Design Upload)
- **FileList**：文件列表展示
- **SyncBadge**：数据同步来源徽章
- **ChatWidget**：AI 聊天浮窗 (SSE 流式响应，按角色预设问题)
- **NotificationBell**：通知铃铛组件

### 4.3 业务模块
- **SIS (学生信息系统)**：学生目录、详情、招生管理 (63KB 最复杂页面)、成绩管理、考勤跟踪、费用发票、公告管理、行为与纪律
- **EMS (教育者管理)**：教师目录、详情、认证管理、工作量、绩效评估、请假管理 (含日历/报告)、CPD 工作坊、退休管理、员工表彰、员工调查、自助服务门户
- **SMS (学校管理)**：课程管理、学校资源、时间表、校历、财务报告、管理报告、图书馆、库存、学校档案、考试、CCA 活动、同意书管理、自动触发器、时间表冲突检测
- **考勤系统**：员工签到/签退、考勤历史、考勤仪表盘
- **门户网站**：学生门户 (Dashboard/Profile/Courses/Grades/Assignments/Behavior/Report Card)、家长门户 (Children/Grades/Attendance/Fees/Homework/Communications/Consent Forms)、教师门户 (Form Class/Assignments/Messages)、HOD 门户、财务门户、辅导员门户
- **其他**：EGNC 集成、多学校管理、私立教育监管 (DPE)、注册门户、审批收件箱、系统设置、命令中心、风险预警

### 4.4 技术特性
- React Router v7 `createBrowserRouter` + 懒加载代码分割
- React Hook Form + Zod 表单校验
- Recharts 图表可视化
- 通知轮询 (30s 间隔)
- 学校配置缓存查询
- 学生搜索 Hook

---

## 五、Mobile 端独有功能

### 5.1 PWA & 离线能力
- **Service Worker**：vite-plugin-pwa 自动注册 (`autoUpdate` 模式)
- **离线缓存策略**：
  - 课表 (`/api/v1/sms/timetable`) → `StaleWhileRevalidate` (24h)
  - 成绩 (`/api/v1/grades/`) → `StaleWhileRevalidate` (1h)
  - 考勤 (`/api/v1/attendance/`) → `NetworkFirst` (5s 超时, 1h)
  - 仪表盘 (`/api/v1/dashboard/`) → `StaleWhileRevalidate` (5min)
- **OfflineBanner**：离线状态横幅提示
- **PWA Manifest**：应用名 "MOE SERPS"，主题色 `#165DFF`

### 5.2 Web Push 通知
- **VAPID 协议**：完整的 Web Push 订阅/推送流程
- **PushNotificationBanner**：推送订阅管理横幅
- **usePushNotification Hook**：获取公钥 → 订阅 → 发送后端 → 退订

### 5.3 移动端特色交互
- **缺席原因提交**：家长可在考勤页为子女缺席记录提交原因 (Modal 弹窗 + Sick/Personal/Unexplained/Other + 备注)
- **底部 TabBar**：基于角色动态切换 (家长 3 个 Tab / 学生 4 个 Tab / 教师 3 个 Tab)
- **简化的 Demo 登录**：一键快速登录 (fatimah/adam/drsiti)

---

## 六、设计定位总结

```
PC 桌面端 (端口 3000)
┌────────────────────────────────────────────────┐
│  完整 ERP 管理系统                               │
│  • 管理员/HOD/校长/财务/招生/辅导员等 11 种角色      │
│  • SIS + EMS + SMS 三大模块全覆盖                 │
│  • AI 聊天助手、图表分析、审批流程、报告生成         │
│  • 复杂表单 (React Hook Form + Zod 校验)          │
└────────────────────────────────────────────────┘

Mobile 移动端 (端口 3001)
┌──────────────────────┐
│  轻量 PWA 门户        │
│  • 仅学生/家长/教师    │
│  • 仪表盘 + 成绩 +    │
│    考勤三大核心功能    │
│  • 离线可用 + 推送    │
│  • 简化交互           │
└──────────────────────┘
```

**核心差异**：PC 端是面向学校管理人员的**全功能后台系统**，Mobile 端是面向终端用户（学生、家长、教师）的**轻量 PWA 门户**，只保留最核心的日常查询和简单操作功能。两者共享同一套后端 API 和数据库，通过不同端口独立部署。
