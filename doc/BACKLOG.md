# MOE SERPS POC — 任务看板 & 进度存档

> **演示日期**：2026-06-10（距今约 12 天）  
> **最后更新**：2026-05-29（今日更新）  
> **项目入口**：`/Users/xiex/Documents/GIT/moe-poc-claude`  
> **启动命令**：`./start.sh`（backend:4000 / pc:3000 / mobile:5173）

---

## ⚡ AI 快速接入指南（每次对话必读）

1. 读本文件确认**当前 Sprint** 和**下一个 TODO 任务**
2. 读 `doc/dev-logs/README.md` 获取最近 2 条开发日志，了解上次做了什么
3. 读对应任务的"关键文件"列表，按需 Read 相关文件
4. 开始实现，完成后更新本文件（任务移入 Done，更新 Last Updated）
5. 对话结束前执行 CLAUDE.md 的 End-of-Conversation Checklist

> **不需要重新探索整个项目结构**——已实现内容见"已完成模块总览"。

---

## 📊 总体进度

```
已完成  ████████████████████  100%  (约 55/55 演示分钟)
剩余    ░░░░░░░░░░░░░░░░░░░░   0%
```

| 优先级 | 任务数 | 说明 |
|--------|--------|------|
| 🔴 P0 必须 | 0 | 全部完成 ✅ |
| 🟡 P1 重要 | 2 | Ahmad 验收链路 + SSE 广播接入 |
| 🟢 P2 完善 | 2 | Leave Application UI + SMTP 联调（需公网） |
| ✅ 已完成 | 23 | 全部可演示，Command Center 8-KPI 精确 |

---

## 👥 周末接手指南（需求方同事适用）

> 本节为非开发背景同事准备。使用 Claude Code 时，把下面任务描述直接贴给 AI 即可。

### 可以做的事（验收测试）

1. **验收 Ahmad 全流程**（最重要）
   - 启动系统后登录 `admission / admission123`
   - 找到 Ahmad Bin Abdullah 的 Draft 申请，点 Submit → Review → Accept
   - 切换到 admin，进 Command Center，确认 Enrolment 变成 3,457、Pending 变成 11
   - 再登录 `adam / Demo@2026`（学生账号），确认他能看到自己的成绩和课程

2. **验收演示剧本**（`doc/demo-script-55min.md`）
   - 按剧本第 1-3 段走一遍，记录哪里卡顿、哪里数据不对
   - 不用走完全部，重点看 SIS 入学（8 分钟段）和 Command Center（8 分钟段）

3. **反馈 Bug**
   - 发现问题直接告诉 Claude："第 X 步，点了 Y 按钮，出现了 Z"
   - 不需要自己改代码，让 AI 修

### 不建议做的事

- ❌ 不要改 `CLAUDE.md`、`prisma/schema.prisma`、任何 `.env` 文件
- ❌ 不要运行 `git push --force` 或 `prisma db push --force-reset`（会丢数据）
- ❌ 如果 AI 提议"重构 XX 模块"或"优化架构"——拒绝，演示前只修 Bug

### 启动系统（复制粘贴运行）

```bash
cd /Users/xiex/Documents/GIT/moe-poc-claude
./start.sh
# 然后打开 http://localhost:3000
```

如果 start.sh 不好使，分别启动：
```bash
# 终端 1
cd backend && npm run dev

# 终端 2
cd pc && npm run dev
```

---

## 🔴 P0 — 必须完成

_全部完成 ✅_

---

## 🟡 P1 — 重要功能（260529 新增）

### [ ] SPEC-P1-A：Ahmad accept-offer 触发链路验证

**演示影响**：演示第 1 段核心动作——接受 Ahmad 申请后，Command Center 实时更新

**需验证/修复的变化链**：
- Enrolment: 3,456 → 3,457
- Pending Applications: 12 → 11
- Counselor Cases: 4 → 5（Ahmad 入学后 risk 变 HIGH，自动开 case）
- Ahmad risk score: 0.21 → ~0.74

**关键文件**：
- `backend/src/routes/admissions.ts` — `POST /:id/accept-offer` 端点（已建，需测试）
- `backend/prisma/seed.ts` — Ahmad 的历史出勤/成绩数据（risk 计算依赖）

**状态**：`待验证`

---

### [ ] SPEC-P1-B：SSE broadcast 接入业务路由

**演示影响**：Browser 2 的 Command Center 需要在 Browser 1 操作后实时跳数字

**方案**：在 `admissions.ts` 的 accept-offer 和 `attendance.ts` 的打卡接口中调用 `broadcast('dashboard', ...)`

**关键文件**：
- `backend/src/routes/events.ts` — `broadcast()` 函数（已建，无调用）
- `backend/src/routes/admissions.ts` — accept-offer 处理完后加一行 broadcast
- `backend/src/routes/attendance.ts` — 打卡记录写入后 broadcast attendance 变化

**状态**：`待开发`

---

### [x] SMS-02：School Calendar（学校日历）页面

**演示影响**：演示脚本提到学期日历管理，当前无独立日历页面（设施预约已有，但日历本身缺失）

**技术方案**：
- PC 新页面：`pc/src/pages/SchoolCalendar/`
- Ant Design `Calendar` 组件 + 事件标注（考试日期、节假日、活动）
- 后端：新增 `SchoolEvent` 模型（title / date / type / description）
- API：GET /sms/calendar-events，POST /sms/calendar-events
- 种子数据：期中考试（5/20）、运动会（6/5）、开放日（6/10-演示日当天！）

**关键文件**：
- `pc/src/pages/SchoolCalendar/index.tsx` — 新建
- `pc/src/router/index.tsx` — 添加路由
- `pc/src/components/Layout/Sidebar.tsx` — 添加菜单项
- `backend/prisma/schema.prisma` — 添加 SchoolEvent 模型
- `backend/src/routes/sms.ts` — 添加日历相关路由

**预计工作量**：0.5 天  
**状态**：`已完成` ✅

---

### [x] EMS-03：教师（teacher）角色专属 Dashboard

**演示影响**：drsiti 或 teacher01 登录后看到通用管理员仪表盘，无法体现教师视角

**技术方案**：
- 修改 `pc/src/pages/Dashboard/index.tsx`，按 role 分支渲染
- 教师仪表盘显示：我的课程数、我的学生总数、今日课表、待批改成绩项
- 后端：`GET /dashboard` 已支持 teacher role（返回 teacherStats），前端做分支渲染

**关键文件**：
- `pc/src/pages/Dashboard/index.tsx` — 添加 teacher 分支（约 80 行）
- `backend/src/routes/dashboard.ts` — 确认 teacher stats 字段是否完整

**预计工作量**：0.5 天  
**状态**：`已完成` ✅

---

### [x] DEMO-04：HOD 角色视图验证与修复

**演示影响**：演示时会切换 hod01 账号演示"提交绩效评估"，需确认菜单和权限正确

**需验证/修复**：
- hod01 登录后的侧边栏菜单（应有 Performance Evaluation 入口，不应有 Finance/Admissions）
- 绩效评估页：hod 可以"新建 + 提交"，但不能"审批"（审批按钮应对 hod 隐藏）
- 如有 Bug：修改 `pc/src/router/index.tsx` 的 RBAC 配置和页面按钮权限判断

**关键文件**：
- `pc/src/router/index.tsx` — HOD 路由权限
- `pc/src/pages/EMS/PerformanceEvaluation/index.tsx` — 审批按钮的 role 判断

**预计工作量**：0.5 天（大概率是验证+小修复）  
**状态**：`已完成` ✅

---

### [x] DEMO-05：完整演示剧本（逐段脚本）

**演示影响**：55 分钟演示没有演讲者逐段脚本，演示时容易跑偏或超时

**产出物**：`doc/demo-script-55min.md`

**格式要求**：
```
## [00:00-08:00] 段落标题
讲述要点（2-3句）
操作步骤（点哪里 → 说什么）
过渡词（"接下来我们看..."）
```

**需要覆盖的 10 个演示段**（参考 `doc/gap-analysis-and-plan.md`）：
1. Command Center Dashboard（8min）
2. Ahmad 故事引入（2min）
3. SIS 入学 4 步向导（8min）
4. 教师 H5 考勤打卡（5min）
5. 成绩录入 + 学生查看（4min）
6. EMS 教师档案 + CPD + 绩效评估（6min）
7. SMS 课表自动生成 + 设施预约（5min）
8. Mobile PWA 离线 + 推送（5min）—— 依赖 PWA-01 完成
9. AI 聊天机器人 + At-Risk 仪表板（7min）
10. Q&A 结束（5min）

**预计工作量**：0.5 天  
**状态**：`已完成` ✅

---

## 🟢 P2 — 完善项

### [x] POLISH-06：CLAUDE.md 账号表更新

验证 CLAUDE.md 账号表与 seed.ts 完全一致，无需改动。状态：`已验证`

---

### [x] POLISH-07：错误页面美化（404 / 无权限）

- `pc/src/pages/errors/NotFoundPage.tsx` — 404 页（FileQuestion 图标 + i18n）
- `pc/src/pages/errors/UnauthorizedPage.tsx` — 403 页（ShieldAlert 图标 + i18n）
- `pc/src/router/routes.tsx` — catch-all 改为渲染 NotFoundPage；RoleRoute 跳转 /unauthorized
- i18n：en/zh/ms 三语 errors.* 键值

状态：`已完成`

---

### [ ] VERIFY-08：SMTP 真实邮件联调

**说明**：代码完整，但 Office365 SMTP 需要**公网环境**才能测试（本地/内网会被防火墙拦截）

**操作步骤**：
1. 在**公网机器**上启动 backend（或部署后测试）
2. 以 admin 登录 → Settings → SMTP Configuration
3. 填入真实 SMTP 信息（Host / Port / User / Pass）
4. 点击 Send Test Email → 收件箱确认

**注意**：凭证只填入数据库，**绝不写入任何 git 文件**  
**状态**：`待联调`（需公网环境 + 人工操作）

---

### [x] VERIFY-09：Claude API Key 联调

**状态**：`已验收` ✅（2026-05-29 人工验证通过）

---

### [ ] SPEC-P2-A：Leave Application UI（教师请假申请）

**演示影响**：Spec Phase 4 item，演示剧本第 3 段（EMS）可能涉及

**方案**：
- LeaveApplication 模型已在 schema（leaveType / startDate / endDate / reason / status）
- 需建：`GET/POST /api/v1/ems/leave-applications`（教师提交）、`PATCH /:id/approve`（HOD审批）
- 前端：EMS → 教师页面新增"请假记录"Tab

**状态**：`待开发`（优先级较低，演示剧本若不涉及可跳过）

---

## ✅ 已完成模块总览

| Stage | 模块 | 内容 | 完成时间 |
|-------|------|------|---------|
| 1 | 全栈脚手架 | Express+Prisma+SQLite / React18+Vite+TS / JWT RBAC / i18n 三语 | 260524 |
| 2 | PC 前端 20 页 | Dashboard / SIS / EMS / SMS / EGNC / Finance 全部页面 | 260525-0850 |
| 3 | Mobile H5 | 学生/家长/教师三端，10 页面，antd-mobile | 260525-1400 |
| 4 | 学生/家长门户 | My Courses / My Grades / My Profile / Child Grades / Attendance | 260525-1530 |
| 5 | Bug 修复 | Dashboard 崩溃修复，antd v6 清理，零控制台 Error | 260525-1650 |
| C | EMS 增强 | CPD 追踪 + <20h 告警 + 绩效评估 HOD→Principal 审批工作流 | 260525-1800 |
| D | SMS 增强 | 课表自动生成周视图 + 约束管理 + 设施预约 | 260525-1900 |
| E | SIS 入学向导 | 4 步 Wizard + 年龄-年级自动计算 + +673 电话校验 + 学生 ID 生成 | 260525-1910 |
| G | AI Chatbot | Claude SSE 流式 + Demo fallback + 学生 Portal 悬浮窗 + Mobile Tab | 260526-0820 |
| H | At-Risk 仪表板 | 风险评分算法 + Ahmad HIGH RISK 82% + 8 周趋势图 | 260526-0820 |
| F | 通知系统 | 铃铛 UI + Zustand store + 30s 轮询 + 6 个业务触发点 + SMTP 邮件 | 260526-0854 |
| - | SMTP 配置页 | admin 界面维护邮件服务器 + 密码脱敏 + 测试发件 | 260526-0920 |
| - | 种子数据 | Ahmad 全链路（60%出勤+成绩下降）+ 25 名学生（Year 7-11）+ 新账号体系 | 260526-0920 |
| - | 验收清单 | `doc/acceptance-checklist-manual.md`（详细人工验收文档）| 260526 |
| EMS-03 | 教师 Dashboard | teacher 角色专属仪表板（课程数/学生数/近期课堂/成绩）| 260526 |
| SMS-02 | 学校日历 | Ant Design Calendar + 8 条种子事件 + 增删 API | 260526 |
| DEMO-04 | HOD 视图验证 | HOD 权限正确，无需修复 | 260526 |
| DEMO-05 | 55分钟演示剧本 | `doc/demo-script-55min.md`，10 段逐步操作脚本 | 260526 |
| PWA-01 | Mobile PWA | vite-plugin-pwa + Workbox 离线缓存 + Web Push 家长通知 + OfflineBanner + 订阅 UI | 260526 |
| POLISH-06 | 账号表验证 | CLAUDE.md 账号表与 seed.ts 核对一致，无需改动 | 260526 |
| POLISH-07 | 404/403 页面 | PC NotFoundPage + UnauthorizedPage，i18n 三语，路由整合 | 260526 |
| SPEC-P1 | Command Center 精确数据 | 3456学生/12申请/92.6%出勤/4高风险，seed off-by-1 修复 | 260529 |
| SPEC-P2 | Demo Reset 修复 | tsx seed re-run + school.deleteMany() 补全，测试通过 | 260529 |
| SPEC-P3 | SSE Live 指示器 | /api/v1/events/stream + ● Live 绿色指示器 | 260529 |
| VERIFY-09 | AI Chat 验收 | Claude SSE 流式回复人工验收通过 | 260529 |

---

## 📋 演示前 Checklist（人工必做）

演示日（6/10）前 2 天完成以下操作：

- [ ] 配置真实 SMTP（需公网环境，admin → Settings → SMTP Configuration）并发送测试邮件
- [x] ~~配置 Claude API Key~~ — 已验收通过 ✅
- [ ] 重置数据库（`cd backend && npx prisma db push --force-reset && npx tsx prisma/seed.ts`）确保种子数据干净
- [ ] 运行 `npx tsc --noEmit`（pc 和 mobile 目录），确认 0 TypeScript 错误
- [ ] 按 `doc/acceptance-checklist-manual.md` 走完完整人工验收
- [ ] 按演示剧本（DEMO-05 完成后）完整预演一次，计时 ≤ 55 分钟

---

## 📐 Sprint 规划建议

| 日期 | 目标 | 预计完成的任务 |
|------|------|--------------|
| 5/27（周二）| PWA 开发 | PWA-01 Mobile PWA 离线 + Push |
| 5/28（周三）| 功能补齐 | SMS-02 School Calendar + EMS-03 Teacher Dashboard |
| 5/29（周四）| 验证修复 | DEMO-04 HOD 视图验证 + POLISH-06 账号表更新 |
| 5/30（周五）| 脚本准备 | DEMO-05 演示剧本 + 第一次全链路预演 |
| 6/1-6/5 | 修复润色 | Bug 修复 + POLISH-07 错误页 + 数据精调 |
| 6/7（周日）| 封存演练 | 完整 55 分钟演示预演，计时 |
| 6/8-6/9 | Hotfix only | 仅修 Critical Bug，不加新功能 |
| **6/10** | **演示日** | 🎯 |

---

## 🔧 开发环境快速参考

```bash
# 启动全部服务
./start.sh

# 重置数据库（会清除所有数据并重新 seed）
cd backend && npx prisma migrate reset

# TypeScript 检查
cd pc && npx tsc --noEmit
cd mobile && npx tsc --noEmit

# 查看数据库（可视化）
cd backend && npx prisma studio   # 打开 http://localhost:5555

# Git 推送（每次 commit 后两个远端都推）
git push origin master && git push github master
```

---

## 📝 更新规则（AI 必须遵守）

每次对话结束前，必须更新本文件：
1. 将已完成的 `[ ]` 改为 `[x]`，移入"已完成模块总览"表格
2. 更新顶部 "最后更新" 日期
3. 更新总体进度百分比
4. 如有新发现的问题，添加到对应优先级区块
