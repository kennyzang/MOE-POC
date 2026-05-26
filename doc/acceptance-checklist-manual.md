# MOE SERPS POC — 人工验收清单（详细版）

> 版本：2026-05-26  
> 演示日期：2026-06-10  
> 本清单适合不熟悉系统的验收人员，按步骤逐项核查即可

---

## 一、环境准备

### 1.1 启动服务（三个终端窗口）

```bash
# 终端 1 — 后端 API（端口 4000）
cd /path/to/moe-poc-claude/backend
npm run dev

# 终端 2 — PC 前端（端口 3000）
cd /path/to/moe-poc-claude/pc
npm run dev

# 终端 3 — Mobile H5（端口 5173）
cd /path/to/moe-poc-claude/mobile
npm run dev
```

也可以用根目录的一键启动脚本：
```bash
cd /path/to/moe-poc-claude
./start.sh
```

### 1.2 验证服务是否正常

| 服务 | 地址 | 验证方式 |
|------|------|---------|
| 后端 API | http://localhost:4000 | 浏览器打开应显示 JSON `{"status":"ok"}` |
| PC 前端 | http://localhost:3000 | 浏览器打开应显示登录页 |
| Mobile H5 | http://localhost:5173 | 浏览器打开应显示移动端登录页 |

### 1.3 演示账号速查表

| 角色 | 用户名 | 密码 | 中文说明 |
|------|--------|------|---------|
| 系统管理员 | admin | admin123 | 全功能管理员 |
| 校长 | principal | principal123 | 审批绩效评估；查看 At-Risk 仪表板 |
| 部门主任 | hod01 | hod123 | 提交绩效评估 |
| 学校经理 | manager | Demo@2026 | 学校领导视角（同 admin 权限） |
| 老师（理科）| drsiti | Demo@2026 | Dr. Siti，CPD 达标（25h） |
| 老师（文科）| faizal | Demo@2026 | CPD 不足（12h），状态：请假 |
| 老师（数学）| teacher01 | teacher123 | Ms. Aminah，CPD 18h（即将达标警告） |
| 学生（主角）| student001 | student123 | Ahmad — 出勤率 60%，成绩下降（高风险） |
| 学生 | adam | Demo@2026 | Adam，正常成绩和出勤 |
| 学生 | nurul | Demo@2026 | Nurul，正常成绩和出勤 |
| 家长（Ahmad）| parent01 | parent123 | Hj Abdullah，Ahmad 的家长 |
| 家长（Adam）| fatimah | Demo@2026 | Fatimah，Adam 的妈妈 |
| 财务 | finance | finance123 | 财务报表视角 |
| 招生（新）| admission | admission123 | 招生流程视角 |
| 招生（旧）| admissions | Demo@2026 | 同上（向后兼容） |

---

## 二、PC 端验收（http://localhost:3000）

### 模块 A：登录与权限基础

#### A-1：快速登录

**操作步骤：**
1. 打开浏览器，访问 `http://localhost:3000`
2. 应看到蓝色系登录页，左侧有学校图示，右侧有登录表单
3. 查看登录表单下方是否有多个**快速登录按钮**（Quick Login）
4. 点击 **Admin** 快速登录按钮

**预期结果：**
- 无需手动输入账号密码，自动跳转到 `/dashboard`
- 右上角显示用户名 "System Admin"
- 左侧边栏显示完整菜单（所有模块可见）

**手动登录验证：**
1. 先点右上角用户名 → Logout 退出
2. 在用户名输入框输入 `admin`，密码输入 `admin123`
3. 点击 Login 按钮
4. 预期：正常登录，跳转到 Dashboard

**失败判断：** 白屏、控制台报 Error（F12 → Console）、无法跳转

---

#### A-2：语言切换

**账号：** admin（已登录状态）

**操作步骤：**
1. 点击右上角**地球图标**或语言选择器
2. 切换为 **中文**

**预期结果：**
- 所有菜单名称、页面标题、表头文字变为中文
- 示例：侧边栏 "Student Information" → "学生信息"

3. 切换为 **Melayu（马来语）**

**预期结果：**
- 所有文字变为马来语
- 示例：侧边栏 "Student Information" → "Maklumat Pelajar"（或类似）

4. 刷新浏览器页面

**预期结果：**
- 语言设置保持不变（说明已保存到 localStorage）

5. 切回 **English** 继续后续测试

---

#### A-3：角色权限隔离

验证不同角色看到的菜单不同。

**测试：以 student（adam）登录**
1. Logout → 用 adam / Demo@2026 登录
2. 预期：跳转到 `/student/dashboard`，侧边栏只显示 My Profile、My Courses、My Grades 等学生菜单
3. 尝试手动在浏览器地址栏输入 `http://localhost:3000/admin`
4. 预期：被重定向到登录页或显示"无权限"，不能访问管理页面

**测试：以 finance 登录**
1. 用 finance / finance123 登录
2. 预期：能看到 Financial Reports 菜单
3. 侧边栏不应出现 Student Directory、Teacher Directory 等无关模块（财务角色不需要看学生档案详情）

---

### 模块 B：Command Center 仪表盘

**账号：** admin 或 manager  
**路径：** 登录后自动进入，或侧边栏 → Dashboard

#### B-1：KPI 卡片验证

**操作步骤：**
1. 登录后查看顶部 KPI 卡片区域

**预期结果（数字来自数据库，不应全为 0）：**
- **Total Students**：应显示约 25+（系统有 25 名学生）
- **Total Teachers**：应显示 3
- **Total Courses**：应显示 5
- **Attendance Rate**：应显示百分比数字（如 78%）
- **Pending Admissions**：应显示 1~2（默认种子数据有 2 条 pending）
- **Finance Summary**：显示已收/待收金额（BND 货币格式）

---

#### B-2：图表验证

**Enrollment by Grade 柱状图：**
- 应显示 5 根柱子（Year 7、Year 8、Year 9、Year 10、Year 11）
- 每根柱子代表该年级学生人数（Year 7 最多约 7 人，Year 8-11 各 5 人）
- 鼠标悬停在柱子上应弹出 Tooltip 显示年级和人数

**Attendance Trend 图表：**
- 显示出勤率百分比数据
- 出勤率 >80% 应为绿色，60-80% 黄色，<60% 红色（颜色编码）

**Recent Admissions 列表：**
- 应显示至少 3 条录取申请记录
- 状态 Tag 颜色：Pending=橙色、Under Review=蓝色、Accepted=绿色、Rejected=红色

**Finance Summary 卡片：**
- 应显示 Total Fees（总金额）、Collected（已收，绿色）、Outstanding（未收，红色/橙色）

---

### 模块 C：学生信息管理（SIS）

**账号：** admin 或 manager

#### C-1：Student Directory（学生名录）

**路径：** 侧边栏 → Student Information → Student Directory

**操作步骤：**
1. 进入页面，确认学生列表显示（应有 25+ 条记录）
2. 在搜索框输入 `Ahmad`
3. 预期：筛选出 Ahmad Bin Abdullah（student001）
4. 点击 Ahmad 所在行
5. 预期：弹出详情 Modal，显示：
   - 姓名：Ahmad Bin Abdullah
   - 年级：Year 7，班级：7A
   - 学号：STU2026001
   - 出生日期：2010-03-12
   - IC 号码：BN20100312
   - 国籍：Bruneian
6. 关闭 Modal，重新搜索 `Adam`，找到 Adam Bin Haris
7. 搜索 `nurul`，找到 Nurul Binti Rahman
8. 清空搜索，查看所有年级是否都有学生（Year 7-11）

**失败判断：** 列表为空、搜索无结果、Modal 不弹出、数据为空白

---

#### C-2：Admissions（录取管理）

**路径：** 侧边栏 → Student Information → Admissions

**步骤 1：查看统计数字**
1. 页面顶部应显示各状态数量卡片（Pending、Under Review、Accepted、Rejected、Total）
2. 数字应大于 0

**步骤 2：Tab 切换**
1. 点击 **All** Tab → 显示所有申请（5 条）
2. 点击 **Pending** Tab → 只显示 Pending 状态申请（2 条）
3. 点击 **Under Review** Tab → 只显示 Under Review 状态申请（1 条）
4. 点击 **Accepted** Tab → 只显示已接受（1 条：Muhammad Haziq Bin Rosli）
5. 点击 **Rejected** Tab → 只显示已拒绝（1 条：Siti Aminah Binti Latif）

**步骤 3：快速录取操作**
1. 切换到 **Pending** Tab
2. 找到 "Aiman Bin Yusuf" 申请
3. 点击该行的 **Accept** 按钮
4. 预期：
   - 状态变为 Accepted（绿色 Tag）
   - 该条目从 Pending Tab 消失，移到 Accepted Tab
   - 页面顶部 Pending 数字减 1，Accepted 数字加 1

**失败判断：** Tab 切换无效果、状态更新后数字不变、点击 Accept 没有反应

---

#### C-3：Admissions Wizard（4步入学向导）

**路径：** 侧边栏 → Student Information → Admissions → 点击 "New Application" 按钮

> 此功能演示"如何为一个新学生提交入学申请"

**步骤 1：基本信息（Basic Information）**
1. 点击 **New Application** 按钮，弹出 4 步向导 Modal
2. 填写：
   - Full Name: `Test Student Demo`
   - Date of Birth: 选择 `2012-01-15`（应自动计算年级为 Year 7）
   - IC/Passport: `BN20120115`
   - Gender: Male
   - Nationality: Bruneian
3. 验证：出生日期填写后，Grade Applied 字段应**自动填写为 Year 7**（系统根据年龄计算）
4. 点击 **Next** 按钮进入步骤 2

**步骤 2：监护人信息（Guardian Information）**
1. 填写：
   - Guardian Name: `Demo Parent`
   - Relationship: Father
   - Phone: `+673-8999888`（验证：必须以 +673 开头，否则应显示错误）
   - Email: `demo@test.com`
2. Previous School: `Sekolah Rendah Demo`
3. 点击 **Next** 进入步骤 3

**表单校验测试：**
- 清空 Phone 字段，点击 Next → 应显示"Phone number required"
- 输入非 +673 开头的电话 → 应显示格式错误提示

**步骤 3：文件上传（Document Upload）**
1. 上传一个 PDF 或 JPG 文件（点击上传区域选择文件）
2. 验证文件大小限制（超过限制应有错误提示）
3. 点击 **Next** 进入步骤 4

**步骤 4：预览与提交（Preview & Submit）**
1. 确认显示步骤 1-3 填写的所有信息
2. 检查无误后点击 **Submit**
3. 预期：
   - 成功提示弹出
   - 回到 Admissions 列表，Total 数量加 1
   - 新申请状态为 **Pending**

**失败判断：** 步骤无法切换、年级不自动计算、表单校验不出现、提交失败

---

#### C-4：Grade Management（成绩录入）

**账号：** drsiti（老师角色）或 admin  
**路径：** 侧边栏 → Student Information → Grade Management

**操作步骤：**
1. 选择课程下拉框，选择 **Mathematics Year 7**
2. 学生列表应显示（Ahmad、Adam、Nurul 等 Year 7 学生）
3. 在 Ahmad 的某个成绩输入框填入 `72`
4. 在 Adam 的成绩输入框填入 `85`
5. 点击 **Save Grades** 按钮
6. 预期：显示成功保存提示（Success notification）

**验证成绩显示：**
1. 以 student001（Ahmad）登录
2. 侧边栏 → My Grades
3. 预期：看到刚才录入的成绩已更新

---

#### C-5：Attendance Tracking（考勤管理）

**账号：** drsiti 或 admin  
**路径：** 侧边栏 → Student Information → Attendance Tracking

**步骤 1：创建考勤会话**
1. 点击 **Create Session** 按钮
2. 选择课程：Mathematics Year 7
3. 选择日期：今天（或任意日期）
4. 填写主题：`Algebra Review`
5. 点击提交
6. 预期：新 Session 出现在列表中，状态为 Active

**步骤 2：标记考勤**
1. 点击刚创建的 Session 的 **Mark Attendance** 按钮
2. Modal 中显示该课程的学生列表
3. 将 Ahmad 标记为 **Absent**
4. 将 Adam 标记为 **Present**
5. 将 Nurul 标记为 **Late**
6. 点击 **Submit**
7. 预期：考勤记录保存成功

**验证通知（如 SMTP 已配置）：**
- 标记 Ahmad 为 Absent 后，系统应向 Ahmad 和 parent01（Hj Abdullah）发送缺勤通知

---

### 模块 D：教师管理（EMS）

**账号：** admin 或 manager

#### D-1：Teacher Directory（教师名录）

**路径：** 侧边栏 → Educator Management → Teacher Directory

**操作步骤：**
1. 查看教师列表（应显示 3 名：Dr. Siti、Mohd Faizal、Ms. Aminah）
2. 在搜索框输入 `Siti`，找到 Dr. Siti Nurhaliza
3. 点击 Dr. Siti 所在行，弹出详情 Modal
4. Modal 有 3 个 Tab：
   - **Personal Info**：显示 Staff ID T2026001、部门、资格、入职日期
   - **Certifications**：显示 2 张证书（Teaching License、Cambridge Certificate）
   - **Schedule**：显示课程安排

---

#### D-2：Certifications（证书管理）

**路径：** 侧边栏 → Educator Management → Certifications

**操作步骤：**
1. 查看证书列表
2. 验证状态 Tag 颜色：
   - **Valid**：绿色（有效期 > 90 天）
   - **Expiring Soon**：橙色（有效期 ≤ 90 天）
   - **Expired**：红色（已过期）
3. Dr. Siti 的 Cambridge Certificate 到期日为 2026-03-01（已过期）→ 应显示红色 Expired

---

#### D-3：CPD Tracking（专业发展学时追踪）

**路径：** 侧边栏 → Educator Management → CPD Tracking

**操作步骤：**
1. 查看教师 CPD 状态列表
2. 验证以下情况：
   - **Dr. Siti**：CPD 25/20 小时 → 进度条满格绿色，无警告
   - **Ms. Aminah (teacher01)**：CPD 18/20 小时 → 进度条约 90%，应显示橙色警告（"Near target, 2 hours remaining"）
   - **Mohd Faizal**：CPD 12/20 小时 → 进度条约 60%，应显示红色或橙色警告（"Below target"）
3. 点击某位教师查看 CPD 详情（时间线或记录列表）

---

#### D-4：Performance Evaluation（绩效评估工作流）

**路径：** 侧边栏 → Educator Management → Performance Evaluation

> 工作流：HOD 提交 → Principal 审批

**步骤 1：以 hod01 查看待提交评估**
1. Logout，以 hod01 / hod123 登录
2. 侧边栏 → Performance Evaluation
3. 应看到 Ms. Aminah 的评估（状态 Submitted）
4. 以及 Dr. Siti 的评估（状态 Approved）

**步骤 2：以 hod01 创建新绩效评估**
1. 点击 **New Evaluation** 按钮
2. 选择教师：Mohd Faizal Bin Aziz
3. 填写评分（三项标准）：
   - Teaching Quality（教学质量）：75
   - Professional Development（专业发展）：60
   - Conduct & Attendance（行为考勤）：80
4. Feedback/Comments：`CPD hours significantly below target. Needs improvement.`
5. 点击 **Submit for Review**
6. 预期：评估状态变为 "Submitted"，出现在列表中

**步骤 3：以 principal 审批**
1. Logout，以 principal / principal123 登录
2. 侧边栏 → Performance Evaluation
3. 应看到 Ms. Aminah 和 Mohd Faizal 的评估（状态 Submitted）
4. 点击 Ms. Aminah 的评估
5. 查看评分详情（82/78/85）和 HOD 评语
6. 点击 **Approve** 按钮
7. 预期：状态变为 "Approved"

**步骤 4：拒绝测试**
1. 点击 Mohd Faizal 的评估
2. 点击 **Reject** 按钮
3. 输入拒绝原因：`Assessment criteria not met, please review`
4. 预期：状态变为 "Rejected"

**失败判断：** HOD 无法提交、Principal 看不到待审批评估、状态不更新

---

### 模块 E：学校管理（SMS）

#### E-1：Course Management（课程管理）

**账号：** admin 或 manager  
**路径：** 侧边栏 → School Management → Course Management

**操作步骤：**
1. 查看课程列表（应有 5 门 Year 7 课程）
2. 点击 **Add Course** 按钮
3. 填写：
   - Course Code: `PE701`
   - Course Name: `Physical Education Year 7`
   - Grade Level: Year 7
   - Credit Hours: 2
   - Description: `Physical fitness and sports`
4. 点击 **Save/Submit**
5. 预期：新课程出现在列表中

**编辑测试：**
1. 找到刚创建的课程，点击**编辑图标（铅笔）**
2. 修改 Course Name 为 `PE & Sports Year 7`
3. 保存 → 预期：名称更新

**删除测试：**
1. 点击该课程的**删除图标（垃圾桶）**
2. 弹出确认框 → 点击确认
3. 预期：课程从列表消失

---

#### E-2：School Resources（学校资源与设施）

**路径：** 侧边栏 → School Management → School Resources

**步骤 1：查看设施列表**
1. 查看设施列表（应有 7 个设施）
2. 验证状态 Tag：
   - Hall A → Available（绿）
   - Classroom 7A → Occupied（橙/蓝）
   - 其他 → Available（绿）

**步骤 2：设施预约**
1. 切换到 **Facility Booking** Tab（或点击设施旁的 Book 按钮）
2. 查看现有预约记录（应有 4 条）
3. 点击 **New Booking**（或"预约"按钮）
4. 填写：
   - Facility: Science Lab 1
   - Date: 2026-06-10
   - Start Time: 10:00
   - End Time: 12:00
   - Purpose: `Year 7 Science Demo`
5. 提交 → 预期：新预约记录出现，状态为 Pending

---

#### E-3：Timetable（课表管理）

**路径：** 侧边栏 → School Management → Timetable

**步骤 1：查看已生成课表**
1. 选择班级：7A，学期：2026-S1
2. 应显示 Week View 周视图（5 天 × 多时段的网格）
3. 网格中应有课程卡片（Math/Science/English/MIB/ICT）
4. 鼠标悬停卡片应显示教师名称

**步骤 2：添加约束**
1. 点击 **Add Constraint** 按钮
2. 填写约束（如：Dr. Siti 周一 08:00-09:30 不可用）
3. 提交约束

**步骤 3：自动生成课表**
1. 点击 **Generate Timetable** 按钮
2. 等待约 1-2 秒
3. 预期：课表重新生成，冲突检测通过（或显示已解决的冲突数）
4. 新课表显示在周视图中

---

#### E-4：Financial Reports（财务报表）

**账号：** admin、manager 或 finance  
**路径：** 侧边栏 → School Management → Financial Reports

**Fee Invoices Tab：**
1. 查看账单列表（应有 17 条）
2. 顶部统计卡片显示：Total / Collected / Outstanding 金额
3. 金额单位为 BND，数字不为 0
4. 账单状态有 paid（绿）/ unpaid（橙）/ overdue（红）

**Expenses Tab：**
1. 切换到 Expenses Tab
2. 查看支出列表（应有 6 条）
3. 支出状态：approved（绿）/ pending（橙）
4. 右上角显示支出汇总金额

---

### 模块 F：EGNC 政府服务集成

**账号：** admin 或 manager  
**路径：** 侧边栏 → Government Services → EGNC Integration

**操作步骤：**
1. 查看 5 张服务状态卡片

**预期结果（逐一核查）：**
| 服务名称 | 预期状态 | 标签颜色 |
|---------|---------|---------|
| Student Registry Sync | Connected | 绿色 |
| Teacher Certification Verification | Connected | 绿色 |
| Curriculum Standards API | Connected | 绿色 |
| National Assessment Portal | Disconnected | 红色 |
| School Infrastructure Database | Under Maintenance | 橙色 |

每张卡片应显示 Last Sync 时间戳和服务描述文字。

---

### 模块 G：通知系统（Notifications）

**账号：** 任意账号登录

**操作步骤：**
1. 登录后，查看右上角**铃铛图标**（Bell）
2. 铃铛应显示数字徽章（红点，表示未读通知数）

**步骤：以 student001（Ahmad）登录测试**
1. 用 student001 / student123 登录
2. 右上角铃铛应显示徽章（有未读通知）
3. 点击铃铛图标 → 弹出通知下拉列表
4. 应显示至少 2 条通知：
   - "Grade Published: Your Mathematics Week 4 Quiz grade has been published."
   - "Attendance Warning: Your attendance rate has dropped below 70%."
5. 点击某条通知 → 标记为已读（徽章数字减少）
6. 点击 "Mark All as Read" → 铃铛徽章消失（0 未读）

**步骤：以 parent01（Ahmad 家长）测试**
1. Logout，以 parent01 / parent123 登录
2. 铃铛应有通知：
   - "Attendance Alert: Ahmad attendance rate is at 60%."
3. 通知内容应明确指出是 Ahmad 的问题

---

### 模块 H：At-Risk 学生仪表板（Principal 专属）

**账号：** principal / principal123  
**路径：** 侧边栏 → At-Risk Students（或 Principal Dashboard）

**操作步骤：**
1. 以 principal 登录
2. 侧边栏应有 **At-Risk Students** 菜单项（其他角色不可见）
3. 进入页面，查看风险学生列表

**预期结果：**
- Ahmad Bin Abdullah 应在列表中，标记为 **HIGH RISK**（红色）
- 显示风险评分（如 82%）和置信度
- 显示风险原因：出勤率 60%（低于阈值）+ 成绩持续下降

**趋势图验证：**
1. 点击 Ahmad 的行或查看详情
2. 应显示 8 周趋势图（Recharts 折线图）
3. 图表显示两条线：出勤率趋势 + 成绩趋势
4. 两条线均呈下降趋势（与种子数据对应）

**风险等级颜色：**
- HIGH RISK → 红色标签
- MONITOR → 橙色标签
- OK → 绿色标签

---

### 模块 I：AI 聊天机器人（AI Chatbot）

**账号：** adam（学生）或 student001  
**路径：** 学生 Portal → 右侧悬浮 Chat 按钮

**操作步骤：**
1. 以 adam / Demo@2026 登录
2. 在页面右下角或右侧边栏应有浮动 **Chat** 图标（聊天气泡或机器人图标）
3. 点击打开聊天窗口
4. 聊天框显示欢迎语

**预定义问题测试：**
1. 输入或点击问题：`What are my upcoming assignments?`
2. 预期：AI 回复关于即将到期的作业信息（基于数据库中的作业/成绩项）

3. 输入或点击问题：`How is my attendance this semester?`
4. 预期：AI 回复出勤率相关信息（Adam 约 80%+）

**自由问答（如 API Key 已配置）：**
1. 输入：`Can you explain algebra to me?`
2. 预期：Claude AI 流式回复（文字逐字出现）

**API 失效兜底测试：**
- 如果 Claude API Key 未配置，输入任何问题
- 预期：显示预设的 fallback 回答（不应白屏或崩溃）

---

### 模块 J：系统设置（Settings）

**账号：** admin  
**路径：** 侧边栏 → Settings → SMTP Configuration

**操作步骤：**
1. 进入 SMTP 配置页面
2. 查看表单字段：
   - SMTP Host（服务器地址）
   - Port（端口，如 587）
   - Username（邮箱账号）
   - Password（已输入内容显示为 ●●●●，不明文显示）
   - From Address
3. 点击密码字段旁的**眼睛图标** → 可切换显示/隐藏密码

**保存测试：**
1. 修改某个字段的值
2. 点击 **Save** 按钮
3. 预期：显示保存成功提示

**测试邮件功能（需真实 SMTP 配置）：**
1. 点击 **Send Test Email** 按钮
2. 如配置正确：显示"Test email sent successfully"
3. 如配置错误：显示具体错误信息（Connection refused / Auth failed 等）

---

## 三、PC 学生门户验收

**账号：** adam / Demo@2026  
**路径：** http://localhost:3000 → 学生登录后自动进入

#### K-1：Student Dashboard（学生仪表盘）

1. 登录后进入 `/student/dashboard`
2. 查看顶部 3 张 KPI 卡片：
   - **GPA**：显示 Adam 的加权平均绩点（如 3.2）
   - **Attendance Rate**：显示出勤率百分比（Adam 应 ≥ 80%）
   - **Enrolled Courses**：显示 5
3. 查看 **Upcoming Assessments** 列表
4. 预期：显示即将到期的作业/考试

---

#### K-2：My Profile（我的档案）

1. 侧边栏 → My Profile
2. 查看个人信息：姓名、年级（Year 7）、班级（7A）、学号、邮箱
3. 信息应与种子数据一致

---

#### K-3：My Courses（我的课程）

1. 侧边栏 → My Courses
2. 应显示 5 门课程：
   - Mathematics Year 7（学分 4）
   - English Language Year 7（学分 4）
   - Science Year 7（学分 3）
   - Melayu Islam Beraja Year 7（学分 2）
   - ICT Year 7（学分 2）
3. 每门课程显示教师名称和上课时间

---

#### K-4：My Grades（我的成绩）

1. 侧边栏 → My Grades
2. 页面顶部显示 Overall GPA 和已选课数
3. 按课程分组展开，每门课显示：
   - 各考核项（Quiz 1、Midterm、Assignment、Final）及分数
   - 加权平均分
4. Adam 的 Midterm 约 78 分，Final 约 82 分（成绩中等偏上）

---

## 四、PC 家长门户验收

**账号：** fatimah / Demo@2026

#### L-1：My Children（我的孩子）

1. 登录 → 跳转到 `/parent/children`
2. 显示 Adam Bin Haris 的卡片
3. 卡片显示：年级 Year 7、班级 7A、GPA、出勤率

---

#### L-2：Child Grades（孩子成绩）

1. 侧边栏 → Child Grades
2. 显示 Adam 的各科成绩概览
3. 数据应与学生端看到的一致（同一数据库）

---

#### L-3：Attendance（出勤记录）

1. 侧边栏 → Attendance
2. 显示 Adam 的出勤记录表格
3. 状态：Present（绿）/ Late（橙）/ Absent（红）/ Excused（蓝）
4. 至少有 6-8 条记录

---

**测试 Ahmad 家长视图：**
1. 改用 parent01 / parent123 登录
2. 应看到 Ahmad Bin Abdullah 的卡片（而非 Adam）
3. GPA 应较低（成绩下降）
4. 出勤率应显示约 60%

---

## 五、Mobile H5 验收（http://localhost:5173）

> 测试方式：Chrome 浏览器 → F12 → 切换为手机模式（375px 宽），或用真机访问

### M-1：Mobile 学生端（adam）

**账号：** adam / Demo@2026

1. 打开 `http://localhost:5173`
2. 点击 Student 快速登录按钮（或手动输入账号密码）
3. 进入 **Home** 页：
   - 顶部欢迎卡片显示 "Welcome, Adam Bin Haris"
   - 3 张统计卡：Courses（5）、Attendance（%）、GPA
   - 下方显示近期成绩列表

4. 底部导航栏点击 **Courses**：
   - 显示 5 门课程卡片，含教师名、上课时间

5. 底部导航点击 **Grades**：
   - 显示各科成绩（按课程分组）

6. 底部导航点击 **Profile**：
   - 显示个人信息、学号、年级

7. 底部导航点击 **Chat**（如有）：
   - 打开 AI 聊天界面（Mobile 版）

---

### M-2：Mobile 家长端（fatimah）

**账号：** fatimah / Demo@2026

1. Logout → 以 fatimah 登录
2. **Home** 页：显示 Adam 的卡片（GPA + 出勤率）
3. 底部导航 → **Grades**：Adam 的成绩
4. 底部导航 → **Attendance**：Adam 的出勤记录（有 Present/Late/Absent 记录）

---

### M-3：Mobile 教师端（drsiti）

**账号：** drsiti / Demo@2026

1. 以 drsiti 登录
2. **Home** 页：显示课程数（3 门）、学生数统计
3. 底部导航 → **Classes**：显示 Dr. Siti 的课程列表（Math 7B、Science 7B、ICT）
4. 底部导航 → **Attendance**：考勤 Session 列表

---

### M-4：Mobile 多语言切换

1. 进入任意 Mobile 页面（已登录状态）
2. 找到语言切换按钮（通常在右上角或设置中）
3. 切换为 **中文** → 所有底部导航标签、页面标题变为中文
4. 切换为 **Melayu** → 变为马来语
5. 切回 **English**

---

## 六、端到端演示场景验证

以下是演示时最重要的完整业务链路，需整体走一遍。

### 场景 1：新生入学全流程（15 分钟）

1. **admin 登录** → Dashboard → 查看 Pending Admissions 数字
2. 侧边栏 → Admissions → 点击 **New Application**
3. 走完 4 步向导，提交申请
4. 回到 Admissions 列表，找到刚提交的申请（状态 Pending）
5. 点击 **Accept** → 状态变为 Accepted
6. 验证 Dashboard 的 Pending Admissions 数字减 1

---

### 场景 2：出勤 → 家长通知链路（5 分钟）

1. **teacher01 登录** → Attendance Tracking → Create Session（Math Year 7，今天）
2. Mark Attendance：将 Ahmad 标记为 Absent
3. Submit
4. 切换到 **parent01 账号** → 铃铛通知应有新通知（Ahmad 缺勤）
5. 切换到 **student001 账号** → 铃铛通知也应有缺勤警告

---

### 场景 3：Ahmad 高风险预警（5 分钟）

1. **principal 登录** → At-Risk Students 页面
2. 找到 Ahmad Bin Abdullah → HIGH RISK，82% 置信度
3. 点击查看趋势图（8 周出勤率下降 + 成绩下降）
4. 切换到 **student001** 登录 → My Grades → 查看 Week 1-4 成绩下降趋势
   - Week 1 Math: 78 → Week 4 Math: 65（显著下降）

---

### 场景 4：教师绩效评审（5 分钟）

1. **hod01 登录** → Performance Evaluation → New Evaluation
2. 选择 Mohd Faizal → 填写评分 → Submit for Review
3. **principal 登录** → Performance Evaluation → 看到 Mohd Faizal 待审批
4. 查看详情 → Approve（或 Reject）
5. 验证状态更新

---

## 七、常见问题排查

| 现象 | 可能原因 | 解决方法 |
|------|---------|---------|
| 登录页白屏 | PC 前端未启动 | `cd pc && npm run dev` |
| 登录失败，401 错误 | 后端未启动 | `cd backend && npm run dev` |
| 数据库无数据（列表为空）| 未执行 seed | `cd backend && npx prisma db seed` |
| Dashboard 数字全为 0 | 数据库未 seed 或 API 报错 | 检查终端 backend 日志 |
| 铃铛通知不出现 | 后端通知 API 未正常工作 | F12 → Network → 查看 `/api/notifications` 请求 |
| AI 聊天无响应 | Claude API Key 未配置 | 检查 `backend/.env` 中 CLAUDE_API_KEY |
| 发送测试邮件失败 | SMTP 未配置真实账号 | 在 Settings 页面填入真实 SMTP 信息 |
| Mobile 页面布局错误 | 未开启手机模拟 | Chrome F12 → 手机图标 → 选 375px 宽度 |

---

## 八、验收通过标准

| 检查项 | 标准 |
|--------|------|
| 所有角色均可正常登录 | 无 401/500 错误 |
| Dashboard KPI 数字来自 DB | 不全为 0，不是硬编码 |
| 4 步入学向导可提交 | 提交后列表更新 |
| 考勤标记可保存 | 状态持久化 |
| 成绩录入可保存 | 学生端可看到更新 |
| 绩效评估工作流完整 | HOD 提交 → Principal 审批 |
| At-Risk 仪表板显示 Ahmad 高风险 | 红色 HIGH RISK 标签 |
| 通知铃铛有未读数 | 徽章数字 > 0 |
| Mobile H5 三端正常 | 学生/家长/教师各端可用 |
| 多语言切换 | EN/中/MS 均可切换 |
| TypeScript 无编译错误 | `npx tsc --noEmit` 输出空 |
| 浏览器控制台无 Error | F12 → Console 无红色 Error |
