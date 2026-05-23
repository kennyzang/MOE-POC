# MOE-POC 项目落地方案

**生成日期**: 2026年5月23日  
**演示日期**: 2026年6月10日  
**剩余时间**: 18 天  
**项目类型**: 校园管理系统POC（基于UNISSA-POC改造）  
**文档版本**: v1.0  

---

## 📋 目录

1. [项目背景分析](#一项目背景分析)
2. [核心问题诊断](#二核心问题诊断)
3. [技术选型与架构设计](#三技术选型与架构设计)
4. [项目落地策略](#四项目落地策略)
5. [AI Coding实施计划](#五ai-coding实施计划)
6. [开发时间线](#六开发时间线)
7. [GitHub推送方案](#七github推送方案)
8. [风险评估与缓解](#八风险评估与缓解)

---

## 一、项目背景分析

### 1.1 项目定位

**MOE-POC** 是文莱教育部（Ministry of Education）的学校ERP系统POC项目，用于在6月10日进行演示，以争取正式项目合同。

**核心特点**：
- 🎯 **目标明确**：演示导向，非生产系统
- ⏰ **时间紧迫**：仅18天开发时间（5月23日-6月10日）
- 🔄 **代码复用**：基于UNISSA-POC（大学系统）改造为中小学系统
- 🌐 **多语言支持**：中文、马来文、英文三种语言
- 📱 **多端分离**：PC端和移动端分开开发，不使用响应式

### 1.2 与UNISSA-POC的对比

| 对比维度 | UNISSA-POC（大学） | MOE-POC（中小学） | 改造策略 |
|---------|-------------------|------------------|---------|
| **用户角色** | 大学生、讲师、教职工 | 中小学生、家长、教师 | 调整数据模型，新增家长角色 |
| **核心业务** | 课程注册、成绩管理、考勤 | 招生、成绩、考勤、家校互动 | 保留核心模块，新增家长门户 |
| **技术栈** | Vite + React + Antd + TypeScript | 同左，但需优化 | 修复UNISSA的TS错误，统一Antd组件 |
| **移动端** | React Native（未完善） | 需要完善的移动端 | 优先开发家长端，舍弃部分功能 |
| **多语言** | 英文 + 中文（覆盖不全） | 英文 + 中文 + 马来文 | 完善i18n，确保三种语言完整覆盖 |

### 1.3 成功标准

**POC演示成功的关键指标**：
1. ✅ **功能完整性**：覆盖MOE招标要求的四大核心模块（SIS、EMS、SMS、移动应用）
2. ✅ **技术可行性**：系统稳定运行，无TS错误，部署成功
3. ✅ **政府集成能力**：演示EGNC服务集成架构（用Mock服务）
4. ✅ **多语言支持**：中文、马来文、英文无缝切换
5. ✅ **用户体验**：界面美观，交互流畅，符合政府系统审美

---

## 二、核心问题诊断

### 2.1 UNISSA-POC存在的核心问题

根据需求文档，UNISSA-POC存在以下核心问题：

| 问题编号 | 问题描述 | 严重程度 | 影响 | 解决方案 |
|---------|---------|---------|------|---------|
| **P-01** | 本地运行正常，部署时报TS错误 | 🔴 高 | 无法演示，影响评审结果 | 修复所有TS错误，统一类型定义 |
| **P-02** | 组件未全部用Antd，部分用原生日期控件 | 🟡 中 | UI不一致，用户体验差 | 统一使用Antd组件，替换原生控件 |
| **P-03** | 多语言修改覆盖不全 | 🟡 中 | 演示时部分界面显示英文 | 完善i18n，确保三种语言完整覆盖 |
| **P-04** | 看板数据不够真实，数据来源不对 | 🟡 中 | 演示效果差，缺乏说服力 | 使用真实的Mock数据，或连接测试数据库 |

### 2.2 问题根因分析

**P-01（TS错误）根因分析**：

1. **类型定义不完整**：Prisma生成的类型与前端使用的不一致
2. **缺少类型检查**：`tsconfig.json`配置不严格，未启用`strict`模式
3. **任意类型使用**：大量使用`any`类型，导致类型检查失效
4. **构建流程问题**：本地开发使用`ts-node`，部署时使用`tsc`编译，两者行为不一致

**解决方案**：
```bash
# 1. 启用严格模式
# tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

# 2. 修复所有TS错误
# 运行 TypeScript 编译器检查
npx tsc --noEmit

# 3. 统一类型定义
# 使用 Prisma 生成的类型，避免手动编写类型
import { Prisma } from '@prisma/client';
type Student = Prisma.StudentGetPayload<{}>;
```

**P-02（组件不统一）根因分析**：

1. **历史遗留问题**：早期开发时未强制使用Antd组件
2. **开发者习惯**：部分开发者习惯使用原生HTML控件
3. **Antd版本问题**：Antd 5.x的日期控件与4.x有差异，导致部分页面未升级

**解决方案**：
```tsx
// ❌ 错误做法：使用原生日期控件
<input type="date" onChange={handleDateChange} />

// ✅ 正确做法：使用Antd日期控件
import { DatePicker } from 'antd';
<DatePicker onChange={handleDateChange} />
```

**P-03（多语言覆盖不全）根因分析**：

1. **i18n配置不完整**：部分页面未使用`useTranslation`钩子
2. **硬编码文本**：部分文本直接写在代码中，未提取到i18n配置文件
3. **语言包缺失**：马来文语言包未完整翻译

**解决方案**：
```tsx
// ❌ 错误做法：硬编码文本
<Button>提交</Button>

// ✅ 正确做法：使用i18n
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<Button>{t('common.submit')}</Button>
```

---

## 三、技术选型与架构设计

### 3.1 技术栈选型

**前端技术栈**（基于UNISSA-POC优化）：

| 技术 | 版本 | 用途 | 说明 |
|------|------|------|------|
| **Vite** | 5.4+ | 构建工具 | 快速热更新，提升开发体验 |
| **React** | 18.3+ | 前端框架 | 函数组件 + Hooks |
| **TypeScript** | 5.5+ | 类型检查 | 启用`strict`模式，修复所有TS错误 |
| **Ant Design** | 6.3+ | UI组件库 | 统一使用Antd组件，替换原生控件 |
| **Tailwind CSS** | 3.4+ | 样式框架 | 样式易修改，放弃原来的模式 |
| **React Router** | 6.26+ | 路由管理 | 前端路由 |
| **React Query** | 5.56+ | 数据请求 | 缓存、重试、加载状态 |
| **React Hook Form** | 7.53+ | 表单管理 | 高性能表单，与Zod集成 |
| **Zod** | 3.23+ | 表单验证 | 类型安全的表单验证 |
| **i18next** | 25.10+ | 多语言 | 支持中文、马来文、英文 |
| **Recharts** | 2.12+ | 图表 | 看板数据可视化 |
| **Lucide React** | 0.447+ | 字体图标 | 替换emoji，使用字体图标 |
| **Zustand** | 4.5+ | 状态管理 | 轻量级状态管理 |

**后端技术栈**（复用UNISSA-POC）：

| 技术 | 版本 | 用途 | 说明 |
|------|------|------|------|
| **Node.js** | 20+ | 运行环境 | 后端运行环境 |
| **Express** | 4.21+ | Web框架 | RESTful API |
| **Prisma** | 6.2+ | ORM | 数据库操作 |
| **SQLite** | 3.x | 数据库 | POC阶段使用SQLite，生产环境可切换MySQL |
| **JWT** | 9.0+ | 身份认证 | 用户登录认证 |
| **bcrypt** | 5.1+ | 密码加密 | 用户密码加密存储 |

**移动端技术栈**（优先开发家长端）：

| 技术 | 版本 | 用途 | 说明 |
|------|------|------|------|
| **React Native** | 0.76+ | 移动端框架 | iOS + Android 跨平台 |
| **Expo** | 52+ | 开发工具 | 快速开发，热更新 |
| **Ant Design Mobile** | 5.38+ | 移动端UI库 | 统一UI风格 |

### 3.2 架构设计

**整体架构**：

```
┌─────────────────────────────────────────────────────────────┐
│                       用户层                                │
│  PC端（React + Antd）          移动端（React Native + Expo） │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       API层                                 │
│  Express RESTful API（/api/v1）                            │
│  - /auth（认证）                                           │
│  - /students（学生管理）                                     │
│  - /teachers（教师管理）                                     │
│  - /courses（课程管理）                                      │
│  - /grades（成绩管理）                                       │
│  - /attendance（考勤管理）                                   │
│  - /finance（财务报表）                                      │
│  - /egnd（EGNC集成Mock）                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     业务逻辑层                               │
│  - StudentService            - TeacherService                │
│  - GradeService              - AttendanceService             │
│  - FinanceService            - EGNCService（Mock）           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      数据访问层                              │
│  Prisma Client（ORM）                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      数据库层                                │
│  SQLite（POC阶段） → MySQL（生产环境）                       │
└─────────────────────────────────────────────────────────────┘
```

**PC端架构**：

```
frontend/
├── src/
│   ├── components/          # 通用组件
│   │   ├── ui/            # 基础UI组件（Button、Input、Card等）
│   │   ├── layout/        # 布局组件（Header、Sidebar、Footer）
│   │   └── features/      # 功能组件（StudentForm、GradeTable等）
│   ├── pages/             # 页面组件
│   │   ├── auth/         # 认证页面（Login、Register）
│   │   ├── dashboard/    # 仪表板页面
│   │   ├── students/     # 学生管理页面
│   │   ├── teachers/     # 教师管理页面
│   │   ├── courses/      # 课程管理页面
│   │   ├── grades/       # 成绩管理页面
│   │   ├── attendance/   # 考勤管理页面
│   │   └── finance/     # 财务管理页面
│   ├── hooks/            # 自定义Hooks
│   ├── services/         # API服务
│   ├── stores/           # Zustand状态管理
│   ├── utils/            # 工具函数
│   ├── i18n/            # 多语言配置
│   │   ├── en.json      # 英文
│   │   ├── zh.json      # 中文
│   │   └── ms.json      # 马来文
│   ├── types/            # TypeScript类型定义
│   ├── App.tsx           # 根组件
│   └── main.tsx          # 入口文件
├── public/               # 静态资源
├── index.html            # HTML模板
├── package.json         # 依赖配置
├── tsconfig.json        # TypeScript配置（启用strict模式）
├── vite.config.ts       # Vite配置
└── tailwind.config.js   # Tailwind CSS配置
```

**移动端架构**：

```
mobile/
├── app/
│   ├── (tabs)/           # Tab导航页面
│   │   ├── index.tsx    # 首页
│   │   ├── grades.tsx   # 成绩页面
│   │   ├── attendance.tsx # 考勤页面
│   │   └── profile.tsx # 个人资料页面
│   ├── auth/            # 认证页面
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── _layout.tsx      # 根布局
├── components/          # 通用组件
├── services/           # API服务
├── stores/             # 状态管理
├── i18n/              # 多语言配置
├── assets/             # 静态资源
├── app.json           # Expo配置
└── package.json       # 依赖配置
```

### 3.3 数据库设计

**核心数据模型**（基于UNISSA-POC调整）：

```prisma
// prisma/schema.prisma

model Student {
  id          String   @id @default(cuid())
  studentId   String   @unique // 学号
  name        String   // 姓名
  nationalId  String   @unique // 身份证号
  dateOfBirth DateTime // 出生日期
  gender      String   // 性别
  grade       String   // 年级（如：Grade 1、Grade 2）
  class       String   // 班级（如：Class A、Class B）
  parentName  String   // 家长姓名
  parentContact String   // 家长联系方式
  address     String   // 地址
  enrollmentDate DateTime @default(now()) // 入学日期
  status      String   @default("active") // 状态（active、inactive）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 关联关系
  grades      Grade[]    // 成绩
  attendances Attendance[] // 考勤记录

  @@map("students")
}

model Teacher {
  id          String   @id @default(cuid())
  teacherId   String   @unique // 教师编号
  name        String   // 姓名
  nationalId  String   @unique // 身份证号
  dateOfBirth DateTime // 出生日期
  gender      String   // 性别
  subject     String   // 教授科目
  qualification String  // 资格认证
  certificationExpiry DateTime // 认证到期日期
  phone       String   // 联系电话
  email       String   @unique // 邮箱
  hireDate    DateTime @default(now()) // 入职日期
  status      String   @default("active") // 状态
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 关联关系
  courses     Course[]   // 教授的课程
  grades      Grade[]    // 录入的成绩

  @@map("teachers")
}

model Course {
  id          String   @id @default(cuid())
  courseCode  String   @unique // 课程代码
  name        String   // 课程名称
  description String   // 课程描述
  credits     Int      // 学分
  grade       String   // 适用年级
  status      String   @default("active") // 状态
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 关联关系
  teacherId   String
  teacher     Teacher  @relation(fields: [teacherId], references: [id])
  grades      Grade[]  // 课程成绩

  @@map("courses")
}

model Grade {
  id          String   @id @default(cuid())
  studentId   String
  courseId    String
  teacherId   String
  score       Float    // 分数（0-100）
  grade       String   // 等级（A/B/C/D）
  type        String   // 成绩类型（midterm、final、assignment）
  semester    String   // 学期（2025-2026-S1）
  academicYear String   // 学年（2025-2026）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 关联关系
  student     Student  @relation(fields: [studentId], references: [id])
  course      Course   @relation(fields: [courseId], references: [id])
  teacher     Teacher  @relation(fields: [teacherId], references: [id])

  @@unique([studentId, courseId, type, semester])
  @@map("grades")
}

model Attendance {
  id          String   @id @default(cuid())
  studentId   String
  courseId    String
  date        DateTime // 考勤日期
  status      String   // 状态（present、absent、late）
  remark      String?  // 备注
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 关联关系
  student     Student  @relation(fields: [studentId], references: [id])
  course      Course   @relation(fields: [courseId], references: [id])

  @@unique([studentId, courseId, date])
  @@map("attendances")
}

model User {
  id          String   @id @default(cuid())
  username    String   @unique
  password    String   // 加密存储
  role        String   // 角色（admin、teacher、parent、student）
  relatedId   String?  // 关联ID（如：studentId、teacherId）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("users")
}
```

---

## 四、项目落地策略

### 4.1 核心策略

**策略1：代码复用与优化**
- ✅ 复用UNISSA-POC的核心业务逻辑代码（如：学生管理、成绩管理）
- ✅ 修复所有TypeScript错误，启用`strict`模式
- ✅ 统一使用Antd组件，替换原生控件
- ✅ 完善多语言支持，确保中文、马来文、英文完整覆盖

**策略2：PC端与移动端分离**
- ✅ PC端：使用React + Antd + Tailwind CSS
- ✅ 移动端：使用React Native + Expo + Ant Design Mobile
- ✅ 不使用响应式，两端独立开发
- ✅ 移动端优先开发家长端，舍弃学生端和教师端（POC阶段）

**策略3：样式易修改**
- ✅ 放弃UNISSA-POC的样式模式（CSS Modules + SCSS混合）
- ✅ 统一使用Tailwind CSS，便于快速修改样式
- ✅ 定义设计规范（颜色、字体、间距），确保一致性

**策略4：AI Coding加速开发**
- ✅ 使用Claude Code、GitHub Copilot等AI工具辅助开发
- ✅ 基于UNISSA-POC现有代码进行改造，而不是从零开发
- ✅ 重点关注业务逻辑调整，而不是基础架构

### 4.2 功能模块规划

**PC端功能模块**（优先实现）：

| 模块编号 | 模块名称 | 优先级 | 工作量估算（人天） | 实现说明 |
|---------|---------|-------|-------------------|---------|
| **M-01** | 登录认证 | P0 | 0.5 | 基于UNISSA-POC改造，支持EGNC Mock登录 |
| **M-02** | 仪表板 | P0 | 1 | 使用Recharts生成真实看板数据 |
| **M-03** | 学生管理 | P0 | 1.5 | 调整数据模型，添加家长信息 |
| **M-04** | 教师管理 | P0 | 1 | 调整数据模型，添加资格认证 |
| **M-05** | 课程管理 | P0 | 1 | 基于UNISSA LMS模块改造 |
| **M-06** | 成绩管理 | P0 | 1.5 | 基于UNISSA LMS模块改造 |
| **M-07** | 考勤跟踪 | P0 | 1 | 全新开发，简化版 |
| **M-08** | 财务报表 | P1 | 1 | 基于UNISSA财务模块改造 |
| **M-09** | EGNC集成Mock | P0 | 0.5 | 开发Mock服务，演示政府集成能力 |
| **M-10** | 多语言切换 | P0 | 0.5 | 完善i18n，支持三种语言 |

**移动端功能模块**（仅家长端）：

| 模块编号 | 模块名称 | 优先级 | 工作量估算（人天） | 实现说明 |
|---------|---------|-------|-------------------|---------|
| **MB-01** | 登录认证 | P0 | 0.5 | 基于PC端API，支持家长登录 |
| **MB-02** | 子女成绩查询 | P0 | 1 | 查看子女成绩详情 |
| **MB-03** | 子女考勤查询 | P0 | 1 | 查看子女考勤记录 |
| **MB-04** | 通知接收 | P1 | 0.5 | 接收学校通知（Mock） |
| **MB-05** | 个人资料 | P1 | 0.5 | 查看和修改个人资料 |

### 4.3 开发优先级排序

**第一阶段（Week 1 - 5.23-5.29）**：基础准备与核心功能
1. 修复UNISSA-POC的TypeScript错误
2. 统一Antd组件，替换原生控件
3. 调整数据模型（Student、Teacher）
4. 实现登录认证模块
5. 实现学生管理模块

**第二阶段（Week 2 - 5.30-6.5）**：核心功能开发
1. 实现教师管理模块
2. 实现课程管理模块
3. 实现成绩管理模块
4. 实现考勤跟踪模块
5. 完善多语言支持

**第三阶段（Week 3 - 6.6-6.10）**：移动端与演示准备
1. 开发移动端家长端
2. 实现EGNC集成Mock服务
3. 系统测试与Bug修复
4. 准备演示材料（PPT、演示脚本）
5. 6月10日演示

---

## 五、AI Coding实施计划

### 5.1 AI Coding工具选择

| 工具 | 用途 | 优势 | 使用场景 |
|-----|------|------|---------|
| **Claude Code** | 生成代码、解释代码、重构代码 | 理解上下文能力强，适合复杂逻辑 | 改造UNISSA-POC代码，修复TS错误 |
| **GitHub Copilot** | 代码补全、生成代码片段 | 集成VS Code，适合快速编码 | 日常开发，快速生成代码片段 |
| **Cursor** | 代码编辑、重构、解释 | AI原生编辑器，适合大规模改造 | 重构整个模块，批量修改代码 |

### 5.2 AI Coding工作流程

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: 理解需求                                          │
│ - 深入分析MOE招标文档                                      │
│ - 分析UNISSA-POC代码库                                    │
│ - 明确改造点和优先级                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: 提取UNISSA-POC相关代码                            │
│ - 使用Agent工具分析代码库                                  │
│ - 提取可复用的业务逻辑代码                                  │
│ - 识别需要修改的模块                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: 使用AI Coding工具生成改造方案                       │
│ - 输入：现有代码 + 改造需求                                │
│ - 输出：改造方案 + 代码示例                                │
│ - 工具：Claude Code / Cursor                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: 人工审核AI生成的代码                               │
│ - 检查代码逻辑是否正确                                      │
│ - 检查类型定义是否完整                                      │
│ - 检查是否符合最佳实践                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: 测试与迭代                                         │
│ - 单元测试：测试核心业务逻辑                                │
│ - 集成测试：测试API接口                                     │
│ - 端到端测试：测试完整流程                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: 提交代码                                           │
│ - 使用Git钩子自动检查代码质量                               │
│ - 推送到GitHub仓库                                         │
│ - 自动部署到测试环境                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 AI Coding提示词模板

**模板1：修复TypeScript错误**

```
我正在修复一个React + TypeScript项目的TypeScript错误。
项目使用Vite + React + TypeScript + Ant Design技术栈。

当前错误：
[粘贴TypeScript错误信息]

相关代码：
[粘贴相关代码]

请帮我：
1. 分析错误原因
2. 给出修复方案
3. 提供修复后的完整代码
```

**模板2：改造现有功能模块**

```
我正在将大学管理系统（UNISSA-POC）改造为中小学管理系统（MOE-POC）。
现有代码（学生管理模块）如下：
[粘贴现有代码]

需要调整为中小学场景：
- 添加家长信息字段（parentName、parentContact）
- 添加年级和班级字段（currentGrade、currentClass）
- 修改招生流程，适配中小学招生

请生成改造方案，并给出具体代码修改建议。
```

**模板3：生成新功能模块**

```
我正在开发一个中小学考勤跟踪模块。
需要以下功能：
1. 标记学生出勤/缺席/迟到
2. 生成每日考勤报告
3. 通知家长（邮件或短信）

技术栈：React + TypeScript + Ant Design + Tailwind CSS
请生成前端页面代码（React components）和API接口代码（Express routes）。
```

**模板4：统一UI组件**

```
我正在统一一个React项目的UI组件，将原生HTML控件替换为Ant Design组件。
现有代码（日期选择）如下：
[粘贴现有代码]

需要改造为使用Ant Design的DatePicker组件。
请生成改造后的代码，并确保类型定义完整。
```

---

## 六、开发时间线

### 6.1 时间线总览

| 周次 | 日期 | 主要任务 | 交付物 | 审核节点 |
|-----|------|---------|-------|---------|
| **Week 1** | 5.23-5.29 | 基础准备、修复TS错误、统一Antd组件、调整数据模型 | 修复后的代码、调整后的数据模型 | **节点1**：审核技术方案（5.25） |
| **Week 2** | 5.30-6.5 | 核心功能开发（学生管理、教师管理、课程管理、成绩管理、考勤跟踪） | 核心功能模块 | **节点2**：验收核心功能（6.5） |
| **Week 3** | 6.6-6.10 | 移动端开发、EGNC集成、测试、演示准备 | 移动端应用、完整系统、演示材料 | **节点3**：验收演示（6.9） |

### 6.2 详细开发计划

**Week 1（5.23-5.29）- 基础准备**

| 日期 | 任务 | 负责人 | 工作量（人天） | 备注 |
|-----|------|-------|--------------|------|
| 5.23（周五） | 修复TypeScript错误 | 前端 | 1 | 启用strict模式，修复所有TS错误 |
| 5.24（周六） | 统一Antd组件 | 前端 | 1 | 替换原生控件，统一使用Antd |
| 5.25（周日） | 调整数据模型（Student、Teacher） | 后端 | 0.5 | 添加家长信息、年级班级字段 |
| 5.25（周日） | 审核技术方案 | 全员 | 0.5 | **节点1**：审核数据模型、技术方案 |
| 5.26（周一） | 实现登录认证模块 | 前端+后端 | 0.5 | 基于UNISSA改造，支持EGNC Mock |
| 5.27（周二） | 实现学生管理模块（前端） | 前端 | 0.5 | 调整UI，适配中小学场景 |
| 5.27（周二） | 实现学生管理模块（后端） | 后端 | 0.5 | 调整API，适配新的数据模型 |
| 5.28（周三） | 完善多语言支持（中英马） | 前端 | 0.5 | 完善i18n配置，确保三种语言完整覆盖 |
| 5.29（周四） | 自测学生管理模块 | 测试 | 0.5 | 编写测试用例，执行测试 |

**Week 2（5.30-6.5）- 核心功能开发**

| 日期 | 任务 | 负责人 | 工作量（人天） | 备注 |
|-----|------|-------|--------------|------|
| 5.30（周五） | 实现教师管理模块 | 前端+后端 | 1 | 调整UI和API，添加资格认证 |
| 5.31（周六） | 实现课程管理模块 | 前端+后端 | 1 | 基于UNISSA LMS模块改造 |
| 6.1（周日） | 实现成绩管理模块（前端） | 前端 | 0.5 | 基于UNISSA LMS模块改造 |
| 6.1（周日） | 实现成绩管理模块（后端） | 后端 | 0.5 | 调整API，支持分数制和等级制 |
| 6.2（周一） | 实现考勤跟踪模块 | 前端+后端 | 1 | 全新开发，简化版 |
| 6.3（周二） | 实现财务报表模块 | 前端+后端 | 0.5 | 基于UNISSA财务模块改造 |
| 6.4（周三） | 生成真实看板数据 | 前端+后端 | 0.5 | 使用Recharts，连接测试数据库 |
| 6.5（周四） | 验收核心功能 | 全员 | 0.5 | **节点2**：验收核心功能模块 |
| 6.5（周四） | 修复Bug | 前端+后端 | 0.5 | 修复测试中发现的问题 |

**Week 3（6.6-6.10）- 移动端与演示准备**

| 日期 | 任务 | 负责人 | 工作量（人天） | 备注 |
|-----|------|-------|--------------|------|
| 6.6（周五） | 搭建React Native项目 | 移动端 | 0.5 | 使用Expo快速搭建 |
| 6.7（周六） | 开发移动端家长端（登录、成绩查询） | 移动端 | 1 | 优先开发核心功能 |
| 6.8（周日） | 开发移动端家长端（考勤查询、通知） | 移动端 | 1 | 完善家长端功能 |
| 6.9（周一） | 实现EGNC集成Mock服务 | 后端 | 0.5 | 开发Mock服务，演示政府集成能力 |
| 6.9（周一） | 准备演示材料（PPT、演示脚本） | 全员 | 0.5 | 编写演示脚本，制作PPT |
| 6.10（周二） | **POC演示** | 全员 | - | 正式演示 |
| 6.10（周二） | 修复演示中发现的Bug | 前端+后端 | 0.5 | 演示后修复问题 |

### 6.3 人力资源配置

**团队配置**（基于2人×2天 = 4人天）：

| 角色 | 人数 | 主要职责 | 工作量（人天） | 备注 |
|-----|------|---------|--------------|------|
| **前端开发** | 1 | PC端前端开发、UI实现 | 2 | 修复TS错误、统一Antd、实现前端页面 |
| **后端开发** | 1 | 后端API开发、数据库设计 | 1.5 | 调整数据模型、实现后端API |
| **移动端开发** | 0.5 | 移动端开发（家长端） | 1 | 使用React Native开发 |
| **测试/文档** | 0.5 | 测试、文档编写、演示准备 | 0.5 | 编写测试用例、准备演示材料 |
| **总计** | **2人** | - | **4 人天** | 符合人力投入要求 |

**关键说明**：
- ✅ 2人×2天 = 4人天，符合需求文档中的"人力投入：2*2人天"
- ✅ AI Coding工具可以加速开发，减少实际人力投入
- ✅ 人类（你们）只需承担关键节点的审核和验收工作

---

## 七、GitHub推送方案

### 7.1 GitHub推送规则

**规则1：禁止推送敏感信息**
- ❌ 禁止推送包含API Key、密码、密钥的文件
- ❌ 禁止推送`.env`文件（使用`.env.example`作为模板）
- ✅ 使用`.gitignore`排除敏感文件

**.gitignore配置**：

```gitignore
# 敏感信息
.env
.env.local
.env.development
.env.production
*.key
*.pem
*.p12

# 依赖
node_modules/
pnpm-lock.yaml

# 构建产物
dist/
build/
.next/
out/

# 媒体文件
*.mp4
*.avi
*.mov
*.wmv
*.flv
*.mkv

# 日志
logs/
*.log
npm-debug.log*

# 系统文件
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# 测试覆盖率
coverage/
```

**规则2：禁止推送大文件**
- ❌ 禁止推送超过100MB的文件
- ❌ 禁止推送视频文件（.mp4、.avi等）
- ✅ 使用Git LFS管理大文件（如需要）

**规则3：提交信息规范**
- ✅ 使用约定式提交（Conventional Commits）
- ✅ 提交信息格式：`type(scope): description`

**提交信息示例**：

```bash
feat(student): 添加学生管理模块
fix(auth): 修复登录认证Bug
refactor(ui): 统一使用Antd组件
docs(readme): 更新README文档
test(student): 添加学生管理模块测试用例
```

### 7.2 GitHub钩子配置

**钩子1：预提交钩子（pre-commit）**

用途：在提交前自动检查代码质量

**.husky/pre-commit**：

```bash
#!/bin/sh
# 预提交钩子：在提交前自动检查代码质量

echo "正在执行预提交检查..."

# 1. 运行TypeScript类型检查
echo "1. 运行TypeScript类型检查..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript类型检查失败，提交已中止"
  exit 1
fi

# 2. 运行ESLint检查
echo "2. 运行ESLint检查..."
npx eslint src --ext .ts,.tsx --max-warnings 0
if [ $? -ne 0 ]; then
  echo "❌ ESLint检查失败，提交已中止"
  exit 1
fi

# 3. 运行Prettier格式化检查
echo "3. 运行Prettier格式化检查..."
npx prettier --check src
if [ $? -ne 0 ]; then
  echo "❌ Prettier格式化检查失败，提交已中止"
  exit 1
fi

# 4. 检查是否提交了敏感信息
echo "4. 检查敏感信息..."
if git diff --cached --name-only | xargs grep -l "API_KEY\|SECRET\|PASSWORD\|PRIVATE_KEY"; then
  echo "❌ 检测到敏感信息，提交已中止"
  exit 1
fi

echo "✅ 预提交检查通过，正在提交..."
```

**钩子2：提交消息钩子（commit-msg）**

用途：检查提交信息是否符合规范

**.husky/commit-msg**：

```bash
#!/bin/sh
# 提交消息钩子：检查提交信息是否符合规范

echo "正在检查提交信息..."

# 使用commitlint检查提交信息
npx commitlint --edit $1
if [ $? -ne 0 ]; then
  echo "❌ 提交信息不符合规范，提交已中止"
  exit 1
fi

echo "✅ 提交信息检查通过..."
```

**钩子3：后提交钩子（post-commit）**

用途：提交后自动推送到GitHub

**.husky/post-commit**：

```bash
#!/bin/sh
# 后提交钩子：提交后自动推送到GitHub

echo "正在推送到GitHub..."

# 获取当前分支名
BRANCH=$(git branch --show-current)

# 推送到GitHub
git push origin $BRANCH
if [ $? -ne 0 ]; then
  echo "❌ 推送到GitHub失败"
  exit 1
fi

echo "✅ 已成功推送到GitHub"
```

### 7.3 自动推送配置

**步骤1：安装Husky**（Git钩子管理工具）

```bash
# 安装Husky
pnpm install -D husky

# 初始化Husky
npx husky init
```

**步骤2：安装commitlint**（提交信息检查工具）

```bash
# 安装commitlint
pnpm install -D @commitlint/cli @commitlint/config-conventional

# 创建commitlint配置文件
cat > commitlint.config.js << EOF
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug修复
        'docs',     // 文档
        'style',    // 样式
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试
        'build',    // 构建
        'ci',       // 持续集成
        'chore',    // 其他更改
        'revert',   // 回滚
      ],
    ],
  },
};
EOF
```

**步骤3：配置package.json**

```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint src --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write src",
    "type-check": "tsc --noEmit"
  }
}
```

**步骤4：测试钩子**

```bash
# 测试预提交钩子
echo "console.log('test');" >> src/test.ts
git add src/test.ts
git commit -m "test: 测试钩子"
# 应该看到预提交钩子执行的输出

# 测试提交信息钩子
git commit -m "添加新功能"
# 应该看到错误，因为提交信息不符合规范

git commit -m "feat(test): 添加新功能"
# 应该成功提交
```

---

## 八、风险评估与缓解

### 8.1 风险清单

| 风险编号 | 风险描述 | 影响程度 | 发生概率 | 缓解措施 |
|---------|---------|---------|---------|---------|
| **R-01** | 时间延误（18天无法完成） | 高 | 中 | 聚焦MVP，舍弃非核心功能；使用AI Coding加速开发 |
| **R-02** | AI Coding生成代码质量差 | 中 | 中 | 人工审核AI生成的代码；编写测试用例 |
| **R-03** | TypeScript错误无法完全修复 | 高 | 低 | 启用strict模式，逐步修复；使用AI工具辅助修复 |
| **R-04** | 多语言覆盖不全 | 中 | 中 | 完善i18n配置；使用AI工具翻译 |
| **R-05** | 移动端开发工作量超出预期 | 高 | 中 | 优先完成家长端；舍弃学生端和教师端（POC阶段） |
| **R-06** | 演示时系统崩溃 | 高 | 低 | 提前进行压力测试；准备演示视频作为备份 |
| **R-07** | GitHub推送失败 | 中 | 低 | 配置Git钩子，自动检查；准备手动推送方案 |
| **R-08** | 团队资源不足 | 高 | 中 | 明确团队配置；考虑使用AI Coding减少人力投入 |

### 8.2 风险缓解计划

| 风险编号 | 缓解措施 | 负责人 | 截止日期 |
|---------|---------|-------|---------|
| **R-01** | 重新评估功能清单，舍弃P2功能 | 项目经理 | 5.24 |
| **R-02** | 制定代码审核流程，确保代码质量 | 技术架构师 | 5.25 |
| **R-03** | 使用AI工具辅助修复TS错误 | 前端开发 | 5.26 |
| **R-04** | 完善i18n配置，使用AI工具翻译 | 前端开发 | 5.28 |
| **R-05** | 制定移动端开发计划，明确优先级 | 移动端开发 | 6.6 |
| **R-06** | 进行系统测试，确保演示稳定性 | 测试/文档 | 6.9 |
| **R-07** | 配置Git钩子，测试推送流程 | 后端开发 | 5.27 |
| **R-08** | 确认团队资源配置，必要时申请额外资源 | 项目经理 | 5.24 |

---

## 九、总结与下一步行动

### 9.1 核心结论

1. ✅ **项目可行**：基于UNISSA-POC改造，18天内可以完成MVP开发
2. ✅ **技术可行**：使用AI Coding工具可以加速开发，减少人力投入
3. ✅ **风险可控**：主要风险都有相应的缓解措施

### 9.2 下一步行动

**立即行动（5.23-5.24）**：

1. ✅ **修复TypeScript错误**：启用strict模式，修复所有TS错误
2. ✅ **统一Antd组件**：替换原生控件，统一使用Antd
3. ✅ **调整数据模型**：添加家长信息、年级班级字段
4. ✅ **配置GitHub钩子**：配置预提交钩子、提交消息钩子、后提交钩子

**近期行动（5.25-5.31）**：

1. ✅ **实现核心功能**：学生管理、教师管理、课程管理、成绩管理、考勤跟踪
2. ✅ **完善多语言支持**：确保中文、马来文、英文完整覆盖
3. ✅ **生成真实看板数据**：使用Recharts，连接测试数据库

**远期行动（6.1-6.10）**：

1. ✅ **开发移动端家长端**：使用React Native + Expo
2. ✅ **实现EGNC集成Mock服务**：演示政府集成能力
3. ✅ **准备演示材料**：PPT、演示脚本、演示视频
4. ✅ **6月10日演示**：正式演示

---

**文档版本**: v1.0  
**生成工具**: WorkBuddy AI Assistant  
**最后更新**: 2026年5月23日
