# Git 和构建规则

## 依赖安装
```bash
npm ci        # ✅ 严格按 lock 文件，和 Docker 一致
npm install   # ❌ 可能更新 lock、装到新版本
```
PC 端 `.npmrc` 已设置 `save-exact=true`，新增依赖自动写入精确版本。

## 构建检查（每次 commit 前必须）
```bash
cd pc && npm run build    # PC 端完整构建
cd mobile && npm run build # Mobile 端完整构建
```
**不要用 `--no-verify` 绕过 pre-push hook**。

## Git 提交规则
- **禁止提交**: `.env`, `*.key`, `*.pem`, `*.mp4`, `node_modules/`, `*.db`, `screenshots/`
- **双远端推送**: 优先确保 github（公网），origin（内网）可后补
  ```bash
  git push github master              # 公网 GitHub，始终可用
  git push origin master              # 内网 git.landray.com.cn，需 VPN
  ```
  - `origin`（git.landray.com.cn）为公司内网，需要 VPN 才能推送
  - 在家无 VPN 时：先推 github，回公司补推 origin
  - 两个远端内容应保持一致

## 密钥和凭证安全（关键）
**绝对禁止将以下内容写入 git**:
- 密码、授权码、API Key、Token、Secret
- 邮箱账号 + 密码组合
- 第三方服务连接串（数据库 URL、SMTP、OAuth Secret）

**正确做法**:
1. 敏感配置只放 `.env`（已在 `.gitignore`，永远不提交）
2. 需要在系统中管理的配置存入数据库 `SystemConfig` 表
3. 文档中出现配置示例必须用占位符:
   ```
   SMTP_PASS=<your-smtp-password>      ✅
   SMTP_PASS=actual_password_here      ❌
   ```

**commit 前扫描**:
```bash
git diff --cached | grep -iE "(password|secret|api.?key|token|auth)\s*[=:]\s*\S{8,}"
```
有输出则停止提交，改用占位符或移入 `.env`。

**泄露应急**:
1. 立即修改泄露的密码/Key
2. `git filter-branch` 重写历史
3. `git push --force` 覆盖远端
4. 通知相关服务提供商

## 截图规则
- Playwright 截图保存到 `screenshots/` 目录（项目根目录）
- 该目录已 `.gitignore`，永不提交
- 禁止截图直接保存到项目根目录或源码目录
