# MOE SERPS POC — 演示验收清单

> 最后更新：2026-05-25  
> 演示目标日期：2026-06-10  
> 启动命令：根目录 `./start.sh`（或手动：backend `npm run dev`，pc `npm run dev`，mobile `npm run dev`）

---

## 当前完成状态总览

| 模块 | 端 | 状态 | 账号 |
|------|----|------|------|
| 登录 / 认证 | PC + Mobile | ✅ 完成 | 所有角色 |
| **PC: Command Center**（管理员仪表盘）| PC | ✅ 完成 | admin / manager |
| **PC: Student Information** | PC | ✅ 完成 | admin / manager / admissions |
| **PC: Educator Management** | PC | ✅ 完成 | admin / manager |
| **PC: School Management** | PC | ✅ 完成 | admin / manager / finance |
| **PC: EGNC Integration** | PC | ✅ 完成 | admin / manager |
| **PC: 学生门户**（My Courses / Grades / Profile）| PC | ✅ 完成 | adam / nurul |
| **PC: 家长门户**（My Children / Grades / Attendance）| PC | ✅ 完成 | fatimah |
| **Mobile: 学生端**（Home / Courses / Grades / Profile）| Mobile H5 | ✅ 完成 | adam / nurul |
| **Mobile: 家长端**（Home / Grades / Attendance）| Mobile H5 | ✅ 完成 | fatimah |
| **Mobile: 教师端**（Home / Classes / Attendance）| Mobile H5 | ✅ 完成 | drsiti / faizal |
| 多语言（EN / 中文 / Melayu）| PC + Mobile | ✅ 完成 | — |
| 演示数据丰富度（多年级学生）| — | ⚠️ 待完善 | — |
| 端到端演示剧本 | — | ⚠️ 待准备 | — |

---

## 手工验收步骤

### 前置：启动服务

```bash
# 后端（端口 4000）
cd backend && npm run dev

# PC 前端（端口 3000）
cd pc && npm run dev

# Mobile（端口 5173，手机或 Chrome DevTools 移动模拟）
cd mobile && npm run dev
```

---

### 模块 1：PC 登录

**账号**：任意角色均可

1. 打开 `http://localhost:3000`
2. 验证快速登录按钮（Admin / Manager / Teacher / Student / Parent / Finance）存在
3. 点击 **Admin** 快速登录 → 应跳转到 `/dashboard`
4. 右上角显示 "System Admin"，侧边栏显示全部菜单项
5. 点击右上角语言切换 → 切换为 **Melayu** → 所有文字应变为马来语
6. 切回 **English**
7. 点击右上角用户名 → 选择 Logout → 回到登录页

**判断标准**：无白屏、无控制台 error（F12 → Console）

---

### 模块 2：PC Command Center（Dashboard）

**账号**：admin 或 manager

1. 登录后默认进入 Dashboard
2. 检查 5 张 KPI 卡片数字不为 0（Total Students / Teachers / Courses / Attendance Rate / Pending Admissions）
3. **Enrollment by Grade** 柱状图有柱子显示，鼠标悬停 tooltip 显示年级和人数
4. **Attendance Trend** 显示百分比数字（颜色：>80% 绿色 / 60-80% 黄色 / <60% 红色）
5. **Recent Admissions** 列表显示至少 1 条，状态 Tag 颜色正确（Pending=橙 / Accepted=绿 / Rejected=红）
6. **Finance Summary** 三张卡：Total Fees / Collected（绿）/ Outstanding（红）

**判断标准**：无崩溃，所有数据来自 DB（非硬编码 0）

---

### 模块 3：PC Student Information

#### 3a. Student Directory

**账号**：admin / manager

1. 侧边栏 → Student Information → Student Directory
2. 表格显示学生列表，包含姓名、年级、班级、状态
3. 搜索框输入 "Adam" → 筛选出 Adam Bin Haris
4. 点击某行 → 详情 Modal 弹出，显示个人信息
5. 关闭 Modal

#### 3b. Admissions

**账号**：admin / manager / admissions

1. 侧边栏 → Admissions
2. 顶部统计卡片显示各状态数量
3. Tabs 切换（All / Pending / Under Review / Accepted / Rejected）
4. 选择一条 **Pending** 申请 → 点击 **Accept** → 状态变为 Accepted，统计数字更新
5. 选择一条 **Under Review** 申请 → 点击 **Reject** → 状态变为 Rejected

#### 3c. Grade Management

**账号**：admin / manager / teacher

1. 侧边栏 → Grade Management
2. 选择课程下拉 → 选择任意课程
3. 成绩表格显示学生列表，可在输入框填入分数
4. 点击 **Save Grades** → 保存成功提示

#### 3d. Attendance Tracking

**账号**：admin / manager / teacher

1. 侧边栏 → Attendance Tracking
2. 点击 **Create Session** → 选择课程和日期 → 提交
3. 新 Session 出现在列表中，点击 **Mark Attendance**
4. Modal 中批量标记学生出勤状态（Present / Late / Absent）
5. 点击 **Submit**

---

### 模块 4：PC Educator Management

#### 4a. Teacher Directory

**账号**：admin / manager

1. 侧边栏 → Teacher Directory
2. 表格显示教师列表，搜索 "Siti" → 找到 Dr. Siti Nurhaliza
3. 点击某行 → 详情 Modal，切换三个 Tabs（Personal Info / Certifications / Schedule）

#### 4b. Certifications

1. 侧边栏 → Certifications
2. 证书列表显示，状态 Tag（Valid / Expiring Soon / Expired）颜色正确

#### 4c. Teaching Workload

1. 侧边栏 → Teaching Workload
2. 每位教师的课程数、学生数统计显示

---

### 模块 5：PC School Management

#### 5a. Course Management

**账号**：admin / manager

1. 侧边栏 → Course Management
2. 点击 **Add Course** → 填写课程代码、名称、学分 → 提交 → 新课程出现在表格
3. 点击编辑图标 → 修改名称 → 保存
4. 点击删除图标 → 确认 → 课程消失

#### 5b. School Resources

1. 侧边栏 → School Resources
2. 设施列表，状态 Tag（Available / In Use / Under Maintenance）

#### 5c. Financial Reports

**账号**：admin / manager / finance

1. 侧边栏 → Financial Reports
2. **Fee Invoices** Tab：表格显示账单，顶部 3 张统计卡片（Total / Collected / Outstanding）
3. **Expenses** Tab：支出列表，右上角汇总金额

---

### 模块 6：PC EGNC Integration

**账号**：admin / manager

1. 侧边栏 → Government Services → EGNC Integration
2. 5 张服务卡片显示：
   - Student Registry Sync → **Connected**（绿）
   - Teacher Certification Verification → **Connected**（绿）
   - Curriculum Standards API → **Connected**（绿）
   - National Assessment Portal → **Disconnected**（红）
   - School Infrastructure Database → **Under Maintenance**（橙）
3. 每张卡显示 Last Sync 时间和描述文字

---

### 模块 7：PC 学生门户

**账号**：adam（或 nurul）

1. 登录 → 跳转到 `/student/dashboard`
2. **Student Dashboard**：GPA、出勤率、选课数 KPI 卡片；Upcoming Assessments 列表
3. 侧边栏 → **My Profile**：个人信息（姓名、年级、班级、Email）
4. 侧边栏 → **My Courses**：课程表格（5 门课：ICT / MIB / SCI / MATH / ENG），显示学分、状态
5. 侧边栏 → **My Grades**：
   - 顶部 Overall GPA + 选课数卡片
   - 按课程分组展开，每门课加权均分 + 各考核项进度条

---

### 模块 8：PC 家长门户

**账号**：fatimah

1. 登录 → 跳转到 `/parent/children`
2. **My Children**：显示 Adam Bin Haris 卡片，含年级、班级、GPA、出勤率
3. 侧边栏 → **Child Grades**：子女成绩概览（均分百分比）
4. 侧边栏 → **Attendance**：出勤记录表格，状态（Present / Late / Absent）

---

### 模块 9：Mobile 学生端

> 用 Chrome DevTools → 手机模式（375px 宽），或扫码用真机

**地址**：`http://localhost:5173`  
**账号**：adam

1. 登录页 → 点击 **Student** 快速登录按钮
2. **Home**：GPA、出勤率、选课数 卡片；最近成绩列表
3. 底部导航 → **Courses**：选课列表
4. 底部导航 → **Grades**：成绩列表（按课程）
5. 底部导航 → **Profile**：个人信息

---

### 模块 10：Mobile 家长端

**账号**：fatimah（Mobile 登录）

1. 登录 → Home：子女列表卡片
2. 底部导航 → **Grades**：子女成绩
3. 底部导航 → **Attendance**：出勤明细

---

### 模块 11：Mobile 教师端

**账号**：drsiti（或 faizal）

1. 登录 → Home：课程数、学生数统计
2. 底部导航 → **Classes**：我的课程列表
3. 底部导航 → **Attendance**：考勤 Session 列表

---

### 模块 12：多语言切换

**在 PC 和 Mobile 各验证一次**

1. 切换语言为 **中文** → 所有菜单、标题、表头变为中文
2. 切换为 **Melayu** → 变为马来语
3. 切回 **English**
4. 验证页面刷新后语言设置保持（localStorage 持久化）

---

## 待完善项（演示前）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 高 | 演示数据丰富化 | 目前只有 2 名学生，均在 Year 7。需增加多年级学生（Year 7-11），让 Dashboard 柱状图有 5 根柱子 |
| 🔴 高 | 端到端演示剧本 | 准备 10-15 分钟的演示流程脚本，角色切换路径明确 |
| 🟡 中 | Mobile 页面验收 | Mobile H5 经自动化生成，需手工逐页截图确认布局正常 |
| 🟡 中 | Finance 角色验收 | finance 账号登录后的完整流程未专项验证 |
| 🟡 中 | admissions 角色验收 | admissions 账号的权限隔离验证（不应看到 Educator/Finance 菜单）|
| 🟢 低 | 教师角色 Dashboard | 教师登录后 Dashboard 显示其课程/学生数据（后端已有，前端未做角色分支渲染）|
| 🟢 低 | 错误边界页面 | 404 / 无权限 页面样式优化 |

---

## 演示账号速查

| 角色 | 用户名 | 密码 | 适合演示场景 |
|------|--------|------|-------------|
| admin | admin | admin123 | 全功能管理视角 |
| principal | principal | principal123 | 校长视角 |
| hod | hod01 | hod123 | HOD 部门管理视角 |
| manager | manager | Demo@2026 | 学校领导视角（同 admin 权限） |
| teacher | drsiti | Demo@2026 | 教师出勤/成绩录入 |
| student (Ahmad) | student001 | student123 | 学生查成绩/课程（高风险案例） |
| student | adam | Demo@2026 | 学生查成绩/课程 |
| parent | fatimah | Demo@2026 | 家长查子女信息 |
| finance | finance | finance123 | 财务报表视角 |
| admissions | admissions | Demo@2026 | 招生流程视角 |
