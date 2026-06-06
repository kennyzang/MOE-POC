# 规则同步机制

## 设计原则

本项目同时支持 **Claude Code** 和 **CodeBuddy** 两种 AI 开发工具，规则体系保持双轨同步。

## 规则映射关系

| CLAUDE.md 章节 | CodeBuddy 规则文件 | 说明 |
|:---|:---|:---|
| Project Overview + Demo Accounts | `.codebuddy/rules/project-overview.md` | 项目定位和技术栈 |
| Hard Rules (1-8) + 常见类型错误 | `.codebuddy/rules/hard-rules.md` | 必须遵守的硬性规则 |
| Code Style + 目录约定 | `.codebuddy/rules/code-style.md` | 命名和结构约定 |
| Git Rules + 构建一致性 + 密钥安全 | `.codebuddy/rules/git-and-build.md` | 版本控制和构建规则 |
| Quality Checklist | `.codebuddy/rules/quality-checklist.md` | 功能完成前的检查步骤 |
| Dev Log 规则 | `.codebuddy/rules/dev-log.md` | 每次会话结束后的日志规范 |

## 同步策略

### 修改规则时
1. **源头文件**: `CLAUDE.md` 是规则的单一事实来源
2. **修改 CLAUDE.md 后**: 运行 `node scripts/sync-rules.mjs` 自动同步到 CodeBuddy 规则文件
3. **仅修改 CodeBuddy 规则**: 同时反哺更新 `CLAUDE.md` 对应章节

### CodeBuddy 自动加载机制
- CodeBuddy 会自动加载 `.codebuddy/rules/` 目录下的所有 `.md` 文件
- 每次新会话启动时，规则文件作为系统上下文注入
- 无需手动操作

### 验证同步状态
```bash
# 检查规则文件是否最新
node scripts/sync-rules.mjs --check
```
