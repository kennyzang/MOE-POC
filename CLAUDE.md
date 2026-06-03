# MOE SERPS POC Development Guidelines

## Project Overview
Ministry of Education (Brunei) School Enterprise Resource Planning System POC.
Based on UNISSA-POC (`/Users/xiex/Documents/GIT/OVERSEABU/unissa-poc`), adapted for K-12 schools.

## Tech Stack
- **PC Frontend**: React 18 + Vite + TypeScript + Ant Design 5.x
- **Mobile**: H5 (Vite + Ant Design Mobile), separate project
- **Backend**: Express + Prisma + SQLite + JWT
- **State**: Zustand
- **Icons**: Lucide React (NO emoji icons)
- **Charts**: Recharts
- **i18n**: i18next + react-i18next (English, Chinese, Malay)
- **Styling**: CSS Modules + CSS variables for theming

## Project Structure
```
moe-poc-claude/
├── pc/           # PC frontend (Vite + React)
├── mobile/       # Mobile H5 (Vite + Ant Design Mobile)
├── backend/      # Express + Prisma API server
└── prompt/       # AI development prompts & docs
```

## User Roles & Demo Accounts

> 密码已在 seed.ts 更新（2026-05-26）。重置数据库后以下密码生效。

| Role | Username | Display Name | Password |
|------|----------|-------------|----------|
| admin | admin | System Admin | admin123 |
| principal | principal | Hjh Rashidah Binti Mohamad | principal123 |
| hod | hod01 | Dr. Azman Bin Ishak | hod123 |
| manager | manager | Hj Kamaruddin | Demo@2026 |
| finance | finance | Finance Officer | finance123 |
| admissions | admission | Admission Officer | admission123 |
| admissions | admissions | Admissions Officer | Demo@2026 |
| teacher | drsiti | Dr. Siti Nurhaliza | Demo@2026 |
| teacher | faizal | Mohd Faizal Bin Aziz | Demo@2026 |
| teacher | teacher01 | Ms. Aminah Binti Hassan | teacher123 |
| student | student001 | Ahmad Bin Abdullah | student123 |
| student | adam | Adam Bin Haris | Demo@2026 |
| student | nurul | Nurul Binti Rahman | Demo@2026 |
| parent | parent01 | Hj Abdullah Bin Mahmud | parent123 |
| parent | fatimah | Fatimah Binti Yusof | Demo@2026 |

## Hard Rules
1. **All UI components MUST use Ant Design** — no native HTML date pickers, selects, etc.
2. **Icons MUST use Lucide React** — no emoji, no other icon libraries
3. **All user-visible text MUST go through i18n** (`useTranslation` / `t()`) — no hardcoded strings
4. **TypeScript strict mode** — no `@ts-ignore`, minimize `any`
5. **Dashboard/statistics numbers MUST come from DB queries** — no hardcoded fake data
6. **PC and mobile are separate projects** — no responsive design mixing
7. **Styles must be easy to modify** — use CSS Modules + CSS variables, not deep SCSS nesting
8. **Always run `npm run build` before committing** — dev server skips type checking; Docker CI does not (see Build Consistency Rules below)

## Code Style
- Follow `.prettierrc` and `.eslintrc.cjs`
- Components: functional + hooks, PascalCase filenames
- Utils/helpers: camelCase filenames
- Each page component in its own directory under `pages/`

## Mock Data Rules
- Centralized in `src/mock/` directory
- Data must be realistic (Brunei school names, Malay names, BND currency)
- All dashboard/stats numbers derive from mock data, not separate hardcoded values
- API responses via mock functions or MSW

## Quality Checklist (per feature)
Before marking any feature as complete:
1. Write "Demo Verification Steps" and walk through them
2. Switch between at least 2 different role accounts to verify data isolation
3. Verify form validations show inline error messages
4. Check all text goes through i18n (grep for hardcoded strings)
5. Run `cd pc && npm run build` to catch TypeScript + bundler errors (NOT just `tsc --noEmit` — build includes vite which catches more issues)
6. For workflow features: verify the full state machine (every status transition)
7. For dashboards: add/remove data in another module, verify numbers update

## Playwright / Dev Screenshots
- **Always** save Playwright screenshots to `screenshots/` in the project root
- This directory is `.gitignore`d — never commit screenshots
- Command example: `browser_take_screenshot` → path `screenshots/<feature>-<yyyymmdd>.png`
- Never save screenshots directly to the project root or any source directory

## Secrets & Credentials Rules (CRITICAL — 血的教训)

**绝对禁止将以下内容写入任何提交到 git 的文件：**
- 密码、授权码、API Key、Token、Secret
- 邮箱账号 + 密码的组合（即使邮箱地址本身无害，和密码一起就是凭证）
- 任何第三方服务的连接串（数据库 URL、SMTP、OAuth Secret 等）

**正确做法：**
1. 敏感配置只放 `.env`（已在 `.gitignore`，永远不提交）
2. 需要在系统中管理的配置（如 SMTP）存入数据库 `SystemConfig` 表，通过系统设置页面维护
3. 文档、计划文档、dev log 中出现配置示例时，**必须用占位符**：
   ```
   SMTP_PASS=<your-smtp-password>      ✅
   SMTP_PASS=actual_password_here      ❌
   ```
4. AI 在编写实现计划（`docs/superpowers/plans/`）时，**严禁将用户提供的真实凭证写入计划文档**

**写入 git 前的检查（每次 commit 前）：**
```bash
# 扫描是否有可疑内容（密码/key 等关键词后跟真实值）
git diff --cached | grep -iE "(password|secret|api.?key|token|auth)\s*[=:]\s*\S{8,}"
```
如果有输出，停止提交，改用占位符或移入 `.env`。

**发生泄露时的应急步骤：**
1. **立即修改**泄露的密码/Key（最紧急）
2. `git filter-branch` 重写历史清除敏感内容
3. `git push --force` 覆盖两个远端
4. 通知相关服务提供商（如 GitGuardian 告警）

## Build Consistency Rules (血的教训 — Docker vs 本地环境不一致)

**根本原因**：`npm run dev` 不做完整类型检查，Docker 构建用 `tsc -b && vite build` 会报错。

### 安装依赖
```bash
npm ci        # ✅ 严格按 lock 文件，和 Docker 一致
npm install   # ❌ 可能更新 lock、装到新版本
```

### 每次 commit 前必须
```bash
cd pc && npm run build   # 完整构建，等同于 Docker 里的行为
```
已配置 pre-push hook（`.git/hooks/pre-push`）自动执行，**不要用 `--no-verify` 绕过**。

### 新增/升级依赖时
- `pc/.npmrc` 已设置 `save-exact=true`，`npm install <pkg>` 会自动写入精确版本（无 `^`）
- 升级后必须在本地跑 `npm run build` 验证无类型错误，再提交 lock 文件

### 常见类型错误模式（已踩过的坑）
- **Recharts `Tooltip formatter`**：参数类型是 `ValueType | undefined`，不是 `number`。用 `(v) => [(v as number).toFixed(1), 'label']`
- **Lucide React 图标**：此版本只接受 `size` 和 `className`，不接受 `style` 或 `color`。需要着色时用 `<span style={{ color: '...' }}><Icon /></span>` 包裹
- **AxiosHeaders**：`response.headers['content-type']` 类型宽，需 `as string` 转型

## Git Rules
- Never commit: `.env`, `*.key`, `*.pem`, `*.mp4`, `node_modules/`, `*.db`, `screenshots/`
- Two remotes, push both every time:
  ```bash
  git push origin master
  git push github master
  ```

## End-of-Conversation Checklist (MUST DO)
Before ending each conversation, you MUST complete these steps in order:
1. **Commit** all changes with a meaningful commit message
2. **Push** to both remotes (`origin` + `github`)
3. **Update dev log** in `doc/dev-logs/`:
   - Create or update the log file for this session (`YYMMDD-HHmm.md`)
   - Update `doc/dev-logs/README.md` index table
   - Log must include: conversation time (minute precision), token estimate, summary of completed work, files changed
   - The log is primarily for AI to understand development progress; the summary section at the top is for human review
4. **Commit + Push** the dev log update
