# MOE SERPS POC 落地方案

> 基于 UNISSA-POC 改造，借助 AI Coding 在 6月10日前完成系统演示

## 一、项目分析

### 1.1 现状评估

| 维度 | UNISSA-POC（基线） | MOE-POC（目标） | 差距 |
|------|-------------------|-----------------|------|
| 用户群体 | 大学（高等教育） | 中小学（K-12） | 字段/流程需适配 |
| 核心模块 | 招生、学生、财务、HR、LMS、采购、科研 | SIS、EMS、SMS + 移动端 | 模块裁剪+新增 |
| 前端架构 | React18+Vite+TS+AntDesign，响应式 | 同技术栈，PC/移动分离 | 需拆分 |
| 后端架构 | Express+Prisma+SQLite+JWT | 同方案复用 | 小改 |
| 多语言 | 英文、中文、马来语 | 同 | 直接复用 |
| 政府集成 | 无 | EGNC 5个服务（Mock） | 新增 |
| 移动端 | PWA（响应式） | 独立移动端 | 新建 |

### 1.2 UNISSA 踩坑复盘

| 问题 | 根因 | 本次对策 |
|------|------|---------|
| 本地正常，部署报TS错误 | `tsconfig`宽松+`any`泛滥 | 开发阶段开启严格模式，CI构建验证 |
| 部分日期用了原生控件 | 赶工遗漏 | 统一使用 AntDesign DatePicker |
| 多语言覆盖不全 | 手工维护遗漏 | AI批量生成翻译，grep检查硬编码文本 |
| 看板数据不真实 | 直接写死 | Mock数据统一管理，看板数据从Mock API拿 |

---

## 二、技术方案

### 2.1 整体架构

```
moe-poc-claude/
├── pc/                    # PC端（React + Vite + AntDesign）
│   ├── src/
│   │   ├── components/    # 通用组件
│   │   ├── pages/         # 页面模块（按演示场景组织）
│   │   │   ├── auth/      # 登录/认证
│   │   │   ├── dashboard/ # 看板
│   │   │   ├── sis/       # 学生信息系统
│   │   │   ├── ems/       # 教师管理系统
│   │   │   ├── sms/       # 学校管理系统
│   │   │   └── egnc/      # 政府服务集成
│   │   ├── layouts/       # 布局组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Zustand状态管理
│   │   ├── locales/       # i18n翻译文件（en/zh/ms）
│   │   ├── mock/          # Mock数据和API
│   │   ├── styles/        # 全局样式（CSS变量主题）
│   │   └── utils/         # 工具函数
│   ├── package.json
│   └── vite.config.ts
│
├── mobile/                # 移动端（React Native + Expo 或 H5方案）
│   ├── src/
│   │   ├── screens/       # 页面
│   │   │   ├── parent/    # 家长端
│   │   │   ├── student/   # 学生端
│   │   │   └── teacher/   # 教师端
│   │   ├── components/    # 通用组件
│   │   ├── locales/       # 多语言
│   │   └── mock/          # Mock数据
│   └── package.json
│
├── backend/               # 后端API（Express + Prisma）
│   ├── src/
│   │   ├── routes/        # API路由
│   │   ├── services/      # 业务逻辑
│   │   ├── mock/          # EGNC Mock服务
│   │   └── prisma/        # 数据模型
│   └── package.json
│
├── prompt/                # AI开发指令和项目文档
└── CLAUDE.md              # AI开发规范
```

### 2.2 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| PC前端 | React 18 + Vite + TypeScript | 与UNISSA一致，便于代码复用 |
| UI组件 | Ant Design 5.x | 统一组件库，不混用原生控件 |
| 状态管理 | Zustand | 轻量级，UNISSA已验证 |
| 图标 | Lucide React | 字体图标库，丰富且统一 |
| 图表 | Recharts | UNISSA已用，直接复用 |
| 样式 | CSS Modules + CSS变量 | 易修改、支持主题切换、避免SCSS嵌套过深 |
| 多语言 | i18next + react-i18next | UNISSA已用，直接复用翻译框架 |
| 移动端 | H5（Vite + Ant Design Mobile） | POC演示足够，开发速度快 |
| 后端 | Express + Prisma + SQLite | UNISSA方案复用 |
| 部署 | Docker Compose + Nginx | UNISSA方案复用 |

### 2.3 样式方案改进

放弃 UNISSA 的 SCSS+变量方案，改用更易维护的方式：

```typescript
// theme.ts - 集中管理主题变量
export const theme = {
  token: {
    colorPrimary: '#165DFF',
    colorSuccess: '#00B42A',
    colorWarning: '#FF7D00',
    colorError: '#F53F3F',
    borderRadius: 8,
    fontSize: 14,
  }
}

// 通过 AntDesign ConfigProvider 全局注入
// 自定义样式用 CSS Modules，引用 CSS 变量
```

### 2.4 移动端方案

**推荐 H5 方案**而非 React Native，理由：
1. 开发速度快 —— 复用 PC 端的 React + TS 技术栈
2. POC 演示足够 —— 浏览器全屏即可模拟原生体验
3. 工作量可控 —— 2人天可完成三端核心页面
4. 不需要额外学习 Expo/RN 调试环境

```
mobile/（H5方案）
├── src/
│   ├── App.tsx            # 路由入口，按角色切换
│   ├── screens/
│   │   ├── parent/        # 家长端：子女成绩、考勤、通知
│   │   ├── student/       # 学生端：个人信息、成绩、课表
│   │   └── teacher/       # 教师端：教学任务、成绩录入、考勤
│   └── components/        # Ant Design Mobile 组件
├── package.json           # antd-mobile, vite, react
└── vite.config.ts
```

---

## 三、代码复用策略

### 3.1 直接复用（核心代码）

| UNISSA 模块 | 复用到 MOE | 改造点 |
|-------------|-----------|--------|
| `auth/` 登录认证 | 直接复用 | 改logo/文案 |
| `stores/` 状态管理 | 直接复用 | 微调store结构 |
| `lib/i18n.ts` 多语言框架 | 直接复用 | 更新翻译key |
| `layouts/AppLayout` | 直接复用 | 调整菜单项 |
| `components/ui/` 基础组件 | 直接复用 | 无需修改 |
| `router/` 路由框架 | 复用模式 | 替换路由配置 |

### 3.2 改造复用（需适配）

| UNISSA 模块 | MOE 对应 | 主要改造 |
|-------------|---------|---------|
| `admissions/` 招生 | SIS-招生管理 | 适配中小学流程，简化字段 |
| `student/` 学生管理 | SIS-学生档案 | 增加家长信息、年级班级 |
| `courses/` 课程管理 | SMS-课程管理 | 适配中小学课程体系 |
| `finance/` 财务 | SMS-财务报表 | 简化为收支报表 |
| `hr/` 人力资源 | EMS-教师管理 | 改造为教师档案、资格认证 |
| `lms/` 学习管理 | SIS-成绩/考勤 | 提取成绩和考勤功能 |
| `dashboard/` 看板 | Dashboard | 替换为K-12数据 |

### 3.3 不复用（新建）

| 模块 | 说明 |
|------|------|
| EGNC集成页面 | 全新的政府服务集成展示 |
| 移动端 | 全新H5应用 |
| Mock数据层 | 统一管理，贴近真实场景 |

---

## 四、开发计划

### 4.1 三阶段计划（5.24 - 6.10，共18天）

#### 第一阶段：基础搭建（5.24 - 5.28，5天）

**AI 自主完成：**
- [x] 项目初始化（Vite + React + TS + AntDesign）
- [ ] 从 UNISSA 迁移核心框架代码（路由、布局、状态管理、i18n）
- [ ] 搭建 Mock 数据层
- [ ] 搭建后端基础框架
- [ ] 完成登录/认证/权限模块
- [ ] 完成整体布局和导航菜单

**人工验收（0.5人天）：**
- 项目能跑起来
- 登录流程正常
- 菜单导航正确

#### 第二阶段：核心功能（5.29 - 6.4，7天）

**AI 自主完成：**
- [ ] SIS - 学生档案管理（列表/详情/编辑）
- [ ] SIS - 招生管理（申请/审核/录取流程）
- [ ] SIS - 成绩管理（录入/查看/报表）
- [ ] SIS - 考勤跟踪（记录/统计）
- [ ] EMS - 教师档案管理
- [ ] EMS - 资格认证跟踪
- [ ] EMS - 教学负载分配
- [ ] SMS - 课程管理
- [ ] SMS - 学校资源管理
- [ ] SMS - 财务报表
- [ ] EGNC - Mock服务接口
- [ ] EGNC - 集成展示页面
- [ ] Dashboard - 各角色看板

**人工验收（1人天）：**
- 按演示路径走一遍
- 检查各角色视图
- 反馈UI/交互问题

#### 第三阶段：移动端+打磨（6.5 - 6.10，6天）

**AI 自主完成：**
- [ ] 移动端 - 家长端核心页面
- [ ] 移动端 - 学生端核心页面
- [ ] 移动端 - 教师端核心页面
- [ ] 多语言补全（中/英/马来）
- [ ] Mock 数据完善（贴近真实）
- [ ] UI 打磨和一致性检查
- [ ] 演示数据准备

**人工验收（0.5人天）：**
- 按6个演示场景完整走一遍
- 准备演示环境

### 4.2 人力分配

| 角色 | 投入 | 职责 |
|------|------|------|
| AI Coding（Claude） | 全程 | 代码开发、翻译、Mock数据生成 |
| 前端开发（你） | 2人天 | 关键决策、代码审查、验收、演示 |
| 售前 | 按需 | 需求确认、演示路径细化 |

---

## 五、AI Coding 协作模式

### 5.1 开发流程

```
售前提供演示路径/需求 
  → 前端拆解为开发任务（prompt）
    → AI 自主开发（Claude Code）
      → 前端验收/反馈
        → AI 修正
          → 提交代码
```

### 5.2 高效利用 AI 的策略

1. **Prompt 驱动开发**
   - 每个功能模块写一个清晰的 prompt 文件放 `prompt/` 目录
   - prompt 中明确：功能描述、页面结构、数据字段、演示流程
   - AI 读取 prompt + 参考 UNISSA 代码 → 生成完整功能

2. **批量生成**
   - 多语言翻译：AI 一次性生成三语 JSON
   - Mock 数据：AI 根据字段定义批量生成贴近真实的数据
   - 页面模版：AI 基于一个模块的模式复制到其他模块

3. **质量保障**
   - AI 每次提交前自动执行 `tsc --noEmit` 检查 TS 错误
   - AI 检查是否有硬编码文本（未走 i18n）
   - AI 检查是否有非 AntDesign 的原生控件

### 5.3 CLAUDE.md 规范

项目根目录放一个 `CLAUDE.md`，让 AI 每次对话都遵循统一规范：

```markdown
# MOE SERPS POC 开发规范

## 技术约束
- 所有 UI 组件必须使用 Ant Design，禁止原生 HTML 控件
- 图标统一使用 Lucide React，禁止 emoji
- 所有用户可见文本必须走 i18n（useTranslation）
- TypeScript strict 模式，禁止 @ts-ignore
- 样式使用 CSS Modules，主题变量通过 CSS 变量

## 代码风格
- 参考 .prettierrc 和 .eslintrc.cjs
- 组件使用函数式 + hooks
- 文件命名：组件 PascalCase，工具函数 camelCase

## Mock 数据
- 统一在 src/mock/ 目录管理
- 数据要贴近真实（文莱学校名称、马来人名等）
- API 使用 MSW 或简单的 mock 函数

## 复用原则
- 基线项目路径：../OVERSEABU/unissa-poc（与 moe-poc-claude 同级目录）
- 核心代码复用，但需适配 K-12 场景
- 不要照搬 UNISSA 的 SCSS 方案
```

---

## 六、GitHub 推送方案

### 6.1 .gitignore 增强

```gitignore
node_modules
dist
.env
.env.*
*.key
*.pem
*.mp4
*.mov
*.DS_Store
```

### 6.2 Git Hook（pre-push 检查）

通过 `husky` + 自定义脚本实现：

```bash
# .husky/pre-push
#!/bin/sh

# 检查是否包含敏感文件
if git diff --cached --name-only | grep -E '\.(key|pem|env)$'; then
  echo "❌ 检测到敏感文件，禁止推送"
  exit 1
fi

# 检查是否包含 mp4
if git diff --cached --name-only | grep -E '\.mp4$'; then
  echo "❌ 检测到 mp4 文件，禁止推送"
  exit 1
fi
```

### 6.3 双远程同步

```bash
# 添加 GitHub 远程
git remote add github https://github.com/kennyzang/MOE-POC.git

# 推送钩子 - post-commit 自动同步
# .husky/post-commit
#!/bin/sh
git push github HEAD 2>/dev/null || echo "⚠️ GitHub 同步失败，请手动推送"
```

---

## 七、演示场景对应开发优先级

| 场景 | 时长 | 对应模块 | 优先级 | 复用度 |
|------|------|---------|--------|--------|
| SC-01 学生招生与注册 | 15min | SIS | P0 | 高（改造UNISSA） |
| SC-02 日常教学管理 | 20min | SIS+SMS | P0 | 中（需新建成绩/考勤） |
| SC-03 教师管理 | 15min | EMS | P0 | 中（改造HR模块） |
| SC-04 学校运营管理 | 15min | SMS | P1 | 高（改造财务+课程） |
| SC-05 移动应用演示 | 15min | Mobile | P0 | 低（新建） |
| SC-06 EGNC集成 | 10min | EGNC | P1 | 低（新建，但Mock即可） |

---

## 八、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| AI 生成代码质量不稳定 | 中 | 中 | CLAUDE.md 约束 + 每阶段验收 |
| 移动端工作量超期 | 高 | 高 | H5方案降低工作量；最坏情况只做家长端 |
| 多语言翻译不准 | 中 | 低 | AI生成后人工抽检马来语 |
| 部署环境问题 | 低 | 高 | Docker统一环境；提前1天部署测试 |
| 演示中系统崩溃 | 低 | 极高 | 准备演示视频备份；Mock数据固定不走网络 |

---

## 九、下一步行动

### 立即开始（今天）
1. **确认本方案** — 你看完有任何想法可以直接告诉我
2. **初始化项目** — 我来创建项目骨架（Vite + React + TS + AntDesign）
3. **创建 CLAUDE.md** — 统一 AI 开发规范
4. **配置 GitHub** — 添加远程仓库 + 推送钩子

### 下一个 prompt 建议
写一个 `prompt/init.md` 告诉我"初始化项目"，我会：
- 创建 PC 端项目骨架
- 从 UNISSA 迁移核心框架代码
- 完成登录页面
- 配置好 i18n 和主题
