# MOE SERPS — 执行计划（5/26 - 6/9，14 个工作任务）

> **演示日期**：2026-06-10 09:00  
> **演示脚本**：`doc/MOE_SERPS_POC_Demo_v2_EN.xlsx`（55 分钟版）  
> **开发模式**：AI 自主开发，每完成一个 Stage 提交验收  
> **UNISSA 参考**：`/Users/xiex/Documents/GIT/OVERSEABU/unissa-poc`（AI 服务 + PWA 配置直接复用）

---

## 已确认事项

| 项目 | 决定 |
|------|------|
| 演示账号密码 | 与文档一致：`admin123` / `principal123` 等（见下表）|
| AI API Key | 从 `/unissa-poc/backend/.env` 的配置模式获取，使用 Anthropic claude-sonnet-4-6 |
| Mobile 演示 | Chrome DevTools 移动模拟 + 手机真机 PWA |
| 课表算法 | **真实约束求解**（后端 TS 实现，< 1 秒出结果）|
| 开发节奏 | AI 每 Stage 自主跑，你验收后推进下一 Stage |

---

## 最终账号体系

| 角色 | 用户名 | 密码 | 用于演示 |
|------|--------|------|---------|
| System Admin | admin | admin123 | 全模块管理 |
| Principal | principal | principal123 | EMS 绩效审批、AI 风险仪表板 |
| Head of Dept | hod01 | hod123 | EMS CPD 审批 |
| Teacher | teacher01 | teacher123 | 考勤打卡、成绩录入 |
| Student (Ahmad) | student001 | student123 | 学生门户、AI Chatbot |
| Parent (Ahmad's) | parent01 | parent123 | 家长门户、缺勤通知 |
| Admission Officer | admission | admission123 | 录取向导 |
| Finance | finance | finance123 | 财务报表（Q&A 备用）|

> 现有 adam / nurul / fatimah / drsiti / faizal 账号**保留**，仅新增以上演示专用账号

---

## 演示故事线数据（种子数据必须支持）

**主角**：Ahmad Bin Abdullah（student001），IC: BN20100312，Year 7

| 演示节点 | 所需数据 |
|----------|---------|
| 录取向导 | Ahmad applicant profile（status: Application Submitted）|
| 入学 | 自动生成 Student ID: 2026001，仪表板 enrollment +1 |
| 考勤 | teacher01 标记 Ahmad Absent → parent01 收到通知 |
| 成绩 | teacher01 录入 Maths 78 / Science 65，GPA 趋势 4 周历史 |
| EMS | Ms. Aminah（teacher01）：CPD 18h（低于 20h 触发告警）|
| 课表 | Grade 7A 完整周课表，0 冲突，含约束更新演示 |
| AI | Ahmad at-risk（出勤 58% + 成绩下降）→ HIGH RISK 82% |

---

## 分 Stage 执行计划

---

### Stage A — 基础数据 + 账号体系（目标：5/27 完成）

#### A1. 种子数据重构

**后端任务**（`backend/prisma/seed.ts`）：
- 新增 Year 7-11 各 5 名学生（含 Ahmad = Year 7 student001）
- 新增 parent01（Ahmad 的家长），建立 ParentStudentLink
- 新增 teacher01（= Ms. Aminah Binti Hassan），CPD 字段 = 18h
- 新增 principal / hod01 用户，对应新角色
- Ahmad 的出勤记录：最近 10 次课，6 次 present / 4 次 absent（= 60% → at-risk）
- Ahmad 的成绩历史：4 周各科分数呈下降趋势
- 预建 Grade 7A 课表数据（8 科目 × 5 天 × 8 节 = 40 个时间槽）

**验收步骤**：
1. `cd backend && npx prisma db seed` 无报错
2. 登录 admin → Student Directory → 看到 25 名学生（Year 7-11 各 5 人）
3. 登录 student001（密码 student123）→ 进入学生 Dashboard，GPA 有数据
4. 登录 parent01（密码 parent123）→ My Children 显示 Ahmad

#### A2. 账号体系对齐

**后端任务**（`backend/prisma/seed.ts` + `backend/src/middleware/auth.ts`）：
- 新增角色：`principal`（等同 manager 权限 + EMS 全权限）、`hod`（EMS 部门权限）
- 把所有演示账号密码改为文档对应值（admin123 等）
- 快速登录按钮（`pc/src/pages/auth/LoginPage.tsx`）更新为新账号列表

**验收步骤**：
1. 在登录页用每个快速登录按钮逐一登录，不报错
2. principal 登录后可以看到 EMS 菜单
3. hod01 登录后可以看到 EMS → CPD 管理
4. student001 / teacher01 / parent01 / admission 均可正常登录

---

### Stage B — Dashboard 增强（目标：5/28 完成）

**缺失 widget**：Staff Status（在职/请假/培训）、Timetable Conflicts（冲突数）

**后端任务**（`backend/src/routes/dashboard.ts`）：
- 在 admin/manager/principal 分支新增：
  - `staffStatus: { active, onLeave, inTraining }` — 从 Teacher 表统计
  - `timetableConflicts: number` — 从新增 Timetable 表统计冲突数（初始 = 0）

**前端任务**（`pc/src/pages/dashboard/DashboardPage.tsx`）：
- 在现有 5 张 KPI 卡片后新增第 2 行：Staff Status（3 色分布）、Timetable Conflicts
- i18n 新增相关 key

**验收步骤**：
1. admin 登录 → Dashboard → 可以看到 Staff Status 卡片（显示在职/请假/培训人数）
2. Timetable Conflicts 显示 0（初始无冲突）
3. 所有 widget 数字均来自 DB（不是硬编码）
4. 切换语言到 Melayu → 卡片标题变为马来语

---

### Stage C — EMS 补全（目标：5/29 完成）

演示脚本对应：Section 6（6 分钟）

#### C1. CPD 追踪 + 自动告警

**Schema 修改**（`backend/prisma/schema.prisma`）：
- Teacher 表新增：`cpdHours Float @default(0)`、`cpdTarget Float @default(20)`
- 新增 CpdRecord 表：teacherId, date, hours, activityName, status

**后端**（`backend/src/routes/teachers.ts`）：
- `GET /teachers/:id/cpd` — CPD 记录列表
- `POST /teachers/:id/cpd` — 新增 CPD 记录
- `GET /teachers/cpd-alerts` — 返回 CPD 不足（< target）的教师列表

**前端**（`pc/src/pages/ems/`）：
- 在 TeacherDirectoryPage 详情 Modal 的第 2 个 Tab（Certifications）旁新增 **CPD** Tab
  - CPD 进度条（18/20 h），不足时显示橙色告警 banner
  - CPD 记录时间轴列表
- 新增 **CpdAlertsPage**（侧边栏 EMS → CPD Alerts）
  - 列表：教师名、当前 CPD 小时数、目标值、差距
  - 低于目标的行标红并显示"Alert Sent"标签

**验收步骤**：
1. 以 hod01 登录 → EMS → Teacher Directory → 点击 Ms. Aminah → CPD Tab
2. 显示 CPD 18/20h，进度条橙色，banner 显示"CPD shortfall – alert sent to HOD"
3. EMS → CPD Alerts 页面列出 Ms. Aminah，状态为告警
4. 新增一条 CPD 记录（+3h）→ 总计 21h → 告警消失

#### C2. 绩效评估工作流（HOD → Principal）

**Schema**（新增 PerformanceReview 表）：
```
teacherId, reviewerId(HOD), approverId(Principal), year
criteria: JSON(教学质量/专业素养/CPD 三项)
status: draft | submitted | approved | returned
```

**后端**（`backend/src/routes/performance.ts`）：
- `POST /performance` — HOD 创建评估
- `PUT /performance/:id/submit` — HOD 提交给 Principal
- `PUT /performance/:id/approve` — Principal 批准
- `PUT /performance/:id/return` — Principal 退回

**前端**（`pc/src/pages/ems/PerformancePage.tsx`）：
- HOD 视图：创建/编辑评估表单（三项评分 + 文字评语）+ 提交按钮
- Principal 视图：待审批列表 + 批准/退回操作
- 状态 Tag：草稿/待审批/已批准/已退回

**验收步骤**：
1. hod01 登录 → EMS → Performance Evaluation → 新建 Ms. Aminah 年度评估 → 填写三项 → 提交
2. 状态变为"Pending Approval"
3. 切换 principal 登录 → EMS → Performance → 列表显示待审批 → 点击批准
4. 状态变为"Approved"，hod01 视图也同步更新

---

### Stage D — SMS 课表模块（目标：5/30 完成）

演示脚本对应：Section 7（5 分钟），包含 M1-M4

#### D1. 数据模型

**Schema 新增**：
```
TimetableSlot: id, gradeLevel, className, subjectName, teacherId, roomId,
               dayOfWeek(1-5), period(1-8), academicYear, status
TimetableGenerationLog: id, triggeredAt, conflictCount, generatedBy
```

#### D2. 课表自动生成算法（后端）

`backend/src/services/timetableService.ts`：
- 输入：teachers, subjects, rooms, classes, constraints
- 算法：贪心分配（按科目周次要求依次填槽，教师/教室冲突检测，失败回退换槽）
- 输出：TimetableSlot 列表 + conflictCount
- 规模：5 班 × 8 科目 × 5 天，< 500ms

`backend/src/routes/timetable.ts`：
- `POST /timetable/generate` — 触发生成，返回结果 + 冲突统计
- `GET /timetable/:gradeLevel/:className` — 查询某班课表
- `POST /timetable/constraints` — 添加约束（如教师某天不可用）
- `GET /timetable/conflicts` — 返回当前冲突列表

#### D3. 课表前端（PC）

`pc/src/pages/sms/TimetablePage.tsx`：
- 顶部：班级选择下拉 + **Generate Timetable** 按钮（触发后端算法）
- 主体：周视图表格（8 节 × 5 天），每格显示科目/教师/教室
- 冲突高亮（红色边框）
- 约束面板：添加"Ms. Aminah 周四下午不可用"→ **Re-generate** → 0 冲突
- 设施预约入口（Modal）

`pc/src/pages/sms/SchoolCalendarPage.tsx`：
- 月历视图（antd Calendar）+ 新增事件 Modal（事件名、日期、类型）

**验收步骤**：
1. admin 登录 → SMS → Timetable → 选择 Grade 7A → 点击 Generate Timetable
2. 生成成功，0 冲突，周视图显示 40 个时间槽
3. 点击约束面板 → 添加"teacher01 Thu PM unavailable"→ Re-generate → 0 冲突，周四下午无 teacher01
4. SMS → School Calendar → 新增"Sports Day – 12 Jun 2026" → 日历上显示

---

### Stage E — SIS 录取 4 步向导（目标：5/31 完成）

演示脚本对应：Section 3（8 分钟）

**现状**：仅有状态列表 + 审批按钮  
**目标**：4 步 Wizard，按 demo script 走

**前端**（`pc/src/pages/sis/AdmissionWizardPage.tsx`）：

| 步骤 | 内容 | 关键逻辑 |
|------|------|---------|
| Step 1 | 基本信息：全名、DOB、IC 号、性别 | DOB 输入后自动计算推荐年级（7岁入 Year 1，依此类推）|
| Step 2 | 监护人信息：姓名、电话（+673 格式）、关系 | 手机号格式校验 |
| Step 3 | 上传文件：出生证明（PDF/JPG ≤ 5MB）| 文件类型+大小校验，可用 mock 文件 |
| Step 4 | 预览 + 提交 | 提交后 status → "Application Submitted" |

**后端**（`backend/src/routes/admissions.ts`）新增：
- `POST /admissions/wizard` — 完整录取表单提交
- `POST /admissions/:id/accept` — 录取：自动生成 Student ID（格式 2026XXX），创建 User 账号，仪表板 enrollment count +1
- 录取后发 Resend 邮件（复用 unissa-poc 的 RESEND_API_KEY 模式）

**验收步骤**：
1. admission 登录 → SIS → New Admission → 走完 4 步，提交后申请出现在列表
2. 输入 2010 年出生日期 → Step 1 自动显示推荐年级"Year 7"
3. 手机号不含 +673 前缀 → Step 2 显示校验错误
4. 点击 Accept → 生成 Student ID 2026001 → Dashboard 中 Total Students +1
5. 控制台或后端日志显示 Resend 邮件已发送（Demo 模式下 console.log 即可）

---

### Stage F — 通知系统（目标：6/1 完成）

演示关键节点：缺勤通知（Section 4）、录取通知（Section 3）

#### F1. 站内通知（Notification Center）

**Schema**（新增 Notification 表，后端已有，扩展 type）：
- type: `ADMISSION_ACCEPTED` | `ATTENDANCE_ABSENT` | `CPD_ALERT` | `PERFORMANCE_REVIEW`
- recipientId, title, body, isRead, createdAt

**后端**：
- 考勤标记为 absent → 自动创建 parent01 的 Notification 记录
- 录取通过 → 创建 family 通知
- CPD < 20h → 创建 hod01 通知

**前端**（PC + Mobile）：
- 顶部 Header 通知铃铛图标 + 未读红点 + 下拉列表
- 点击通知跳转对应页面

#### F2. Email（Resend，直接复用 unissa-poc）

- 复用 `re_R3wt6Yxx_CMvSqwFdFKE3qVkxXUEfn4co`
- 发送场景：录取通过 offer letter、考勤缺席家长告知
- Demo 模式下 console.log 邮件内容（不需要真实收件人）

**验收步骤**：
1. teacher01 标记 Ahmad 缺席 → 顶部 parent01 通知铃铛出现红点 → 切换 parent01 登录 → 看到"Ahmad was marked Absent"
2. 录取 Ahmad → 通知铃铛出现"Offer letter sent to Ahmad's guardian"
3. 后端日志显示 Resend 邮件调用记录

---

### Stage G — AI Chatbot（目标：6/2 完成）

演示脚本对应：Section 9-A（3 分钟）

**直接复用 unissa-poc 的 `aiService.ts`，仅修改**：
- 系统提示词改为 MOE SERPS School ERP context
- 上下文数据结构改为学生的课程/成绩/出勤（已有 API）
- 模型改为 `claude-sonnet-4-6`

**后端**（`backend/src/services/aiService.ts` + `backend/src/routes/ai.ts`）：
- `POST /ai/chat` — 支持 streaming（SSE）
- `GET /ai/context/:userId` — 拉取学生/教师上下文数据
- AI 配置写入后端 `.env`：`AI_PROVIDER=anthropic`、`AI_API_KEY=<key>`、`AI_MODEL=claude-sonnet-4-6`

**前端（PC）**（`pc/src/components/ChatWidget.tsx`）：
- 学生/家长/教师登录后右下角悬浮 Chat 按钮（蓝色圆形）
- 展开为 Chat 面板（标题 MOE AI Assistant）
- 支持 streaming 打字效果
- 预设两个演示问题快捷按钮：
  - "When does course registration close?"
  - "Can I drop my Science course?"

**前端（Mobile）**：
- 学生 Home 页底部新增 AI Chat 入口 Tab

**演示问答（预设，即使 API 慢也有 fallback）**：
```
Q: "When does course registration close?"
A: "Your course registration deadline is 28 February 2026 (4 days remaining)."

Q: "Can I drop Science?"  
A: "Yes, drop period ends 14 March 2026. You currently have 5 courses.
    Dropping reduces to 4 courses (above 3-course minimum)."
```

**验收步骤**：
1. student001 登录 → 右下角 Chat 按钮 → 点击展开
2. 输入"When does course registration close?" → 流式打字效果回答
3. 输入"Can I drop Science?" → 回答提及当前课程数和截止日期
4. Mobile（Chrome 模拟）→ 学生 Home → Chat Tab → 同样可用
5. 网络断开时 → 显示 fallback 预设答案（不崩溃）

---

### Stage H — AI 风险预测仪表板（目标：6/3 完成）

演示脚本对应：Section 9-B（4 分钟）

**算法**（后端规则引擎，无需 ML）：

```typescript
function computeRisk(student) {
  let score = 0
  // 出勤率低
  if (attendanceRate < 60) score += 40
  else if (attendanceRate < 75) score += 20
  // 近4周成绩趋势下降
  if (gradesTrend === 'declining') score += 30
  else if (gradesTrend === 'flat') score += 10
  // 近期未交作业
  if (missedAssignments > 2) score += 20
  // 置信度 = min(score + 42, 100)  
  return { risk: score >= 60 ? 'HIGH' : score >= 30 ? 'MONITOR' : 'OK', confidence: Math.min(score + 42, 100) }
}
```

Ahmad 的数据（出勤 60% + 下降成绩）→ score = 70 → **HIGH RISK 82%**

**后端**（`backend/src/routes/ai.ts`）：
- `GET /ai/risk-report/:gradeLevel` — 返回该年级所有学生的风险评分

**前端（PC）**（`pc/src/pages/dashboard/RiskDashboardPage.tsx`）：
- Principal 侧边栏 Dashboard → At-Risk Students（新菜单项）
- 表格：学生名、出勤率、成绩趋势、风险等级（🔴 HIGH / 🟡 MONITOR / 🟢 OK）、置信度
- Ahmad 行：出勤 60%、下降趋势、HIGH RISK 82%、"Counselor Notified" Tag
- 点击行 → 展开时间轴图表（8 周出勤率 + 成绩叠加折线图，Recharts）

**验收步骤**：
1. principal 登录 → Dashboard → At-Risk Students
2. 看到 Ahmad 标记为 HIGH RISK，置信度 82%，Counselor Notified
3. 另一名出勤 55% 的学生标记为 MONITOR
4. 点击 Ahmad → 展开 8 周时间轴图表，出勤率和成绩都呈下降趋势
5. 切换年级下拉 → 数据随之更新

---

### Stage I — Mobile PWA（目标：6/4 完成）

演示脚本对应：Section 8（5 分钟）

**任务**（`mobile/vite.config.ts`）：
- 安装 `vite-plugin-pwa`（参考 unissa-poc 配置）
- 配置 manifest：name "MOE SERPS", theme_color "#165DFF", display "standalone"
- 生成 icon-192.png 和 icon-512.png（MOE 风格蓝色盾牌图标）
- Workbox 缓存策略：
  - 课表 API `/api/timetable/*` → CacheFirst（离线可用）
  - 成绩 API `/api/grades/*` → NetworkFirst with fallback

**推送通知**（简化方案）：
- 使用浏览器 `Notification API`（不需要 VAPID/Service Worker Push）
- teacher01 标记 Ahmad 缺席 → 后端 webhook → 前端轮询（5 秒）→ `new Notification("Ahmad was marked absent")`
- 演示前在 Chrome 授权通知权限

**验收步骤**：
1. 在 Chrome 打开 `http://localhost:5173`，地址栏出现"安装"图标
2. 点击安装 → 桌面出现 MOE SERPS 图标 → 独立窗口打开
3. student001 登录 → 查看课表 → 开启飞行模式 → 刷新 → 课表仍然显示（离线缓存）
4. 重新联网 → teacher01 在 PC 端标记 Ahmad 缺席 → parent01 Mobile 端收到浏览器通知
5. 通知内容：" Ahmad was marked Absent in Grade 7A Science"

---

### Stage J — 全链路演示彩排（目标：6/7 完成）

严格按 `MOE_SERPS_POC_Demo_v2_EN.xlsx` 的 55 分钟 Run Sheet 逐节走：

**准备检查清单**（对应 Pre-Demo Checklist 工作表）：

| # | 检查项 | 方法 | 负责 |
|---|--------|------|------|
| D1 | Ahmad applicant profile 存在（status: Application Submitted）| admin → Admissions | Dev |
| D2 | Ms. Aminah（teacher01）: CPD=18h, deployed Grade 7A | EMS → Teacher Directory | Dev |
| D3 | Grade 7A 课表已生成（0 冲突）| SMS → Timetable | Dev |
| D4 | Ahmad 风险仪表板：HIGH RISK（≥75% confidence）| principal → At-Risk | Dev |
| D5 | Dashboard 所有 widget 显示正常数字 | admin 登录 | Dev |
| D6 | AI Chatbot 2 个演示问题答案正确 | student001 → Chat | Dev |
| A1 | 所有 8 个演示账号登录成功 | 逐一测试 | Dev |
| T1 | Mobile PWA 已安装到桌面 | 手机浏览器 | Dev |
| T2 | 离线模式：课表+成绩在飞行模式下可查 | 飞行模式测试 | Dev |
| T3 | 家长通知：标记缺席后 < 30s 收到浏览器通知 | 端到端测试 | Dev |

**彩排验收步骤**（按演示顺序）：

1. **[00:00]** admin 登录 → Dashboard 6 个 widget 全部有数据，无报错
2. **[00:08]** 展示 Ahmad applicant profile，状态"Application Submitted"
3. **[00:10]** admission 登录 → New Admission → 4 步向导 → 提交 → 接受 → Student ID 2026001 生成 → Dashboard +1
4. **[00:18]** teacher01 → Mobile（Chrome 模拟）→ Grade 7A → 标记 Ahmad Absent → parent01 收到通知
5. **[00:23]** teacher01 PC → Grade Management → 录入 Maths 78 / Science 65 → 切换 student001 → 看到成绩
6. **[00:27]** principal → EMS → Ms. Aminah profile → CPD 18h 告警 → Performance Evaluation → 提交审批
7. **[00:33]** admin → SMS → Timetable → Generate → 0 冲突 → 添加约束 → Re-generate → 仍 0 冲突
8. **[00:38]** Mobile：安装 PWA → 飞行模式看课表 → 联网 → 收到通知
9. **[00:43]** student001 → AI Chatbot → 2 个演示问题 → 流式回答
10. **[00:47]** principal → At-Risk → Ahmad HIGH RISK 82% → 时间轴图表

---

## 文件变更预估（完成后）

```
backend/prisma/schema.prisma          +80 行（新增 CPD/Performance/Timetable/Notification 表）
backend/prisma/seed.ts                +200 行（Ahmad 故事数据 + 多年级学生）
backend/src/routes/timetable.ts       新增 ~200 行
backend/src/routes/performance.ts     新增 ~150 行
backend/src/routes/ai.ts              新增 ~100 行
backend/src/services/timetableService.ts  新增 ~150 行
backend/src/services/aiService.ts     从 unissa 复用 ~400 行，改 ~50 行
backend/src/services/notificationService.ts  新增 ~80 行
pc/src/pages/sms/TimetablePage.tsx    新增 ~300 行
pc/src/pages/sms/SchoolCalendarPage.tsx  新增 ~150 行
pc/src/pages/ems/CpdAlertsPage.tsx    新增 ~150 行
pc/src/pages/ems/PerformancePage.tsx  新增 ~250 行
pc/src/pages/sis/AdmissionWizardPage.tsx  重写 ~300 行
pc/src/pages/dashboard/RiskDashboardPage.tsx  新增 ~250 行
pc/src/components/ChatWidget.tsx      新增 ~200 行
mobile/vite.config.ts                 +30 行（PWA 配置）
mobile/src/                           通知 + Chat Tab ~100 行
```

---

## 风险与应对

| 风险 | 应对 |
|------|------|
| Anthropic API key 未配置 | Stage G 开始前确认 key；有 demo 模式 fallback |
| 课表算法死循环（约束过多）| 添加最大迭代次数 = 10000，超出返回"无法满足约束" |
| iOS Safari PWA 通知不支持 | 演示用 Android Chrome 或电脑 Chrome 演示 |
| 演示时网络不稳定 | AI chatbot 预缓存答案；离线模式已验证 |
