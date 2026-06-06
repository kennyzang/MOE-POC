# 开发日志规则（每次会话结束后执行）

## 日志文件位置
- 日志文件: `doc/dev-logs/YYMMDD-HHmm.md`
- 日志索引: `doc/dev-logs/README.md`

## 日志内容要求
每次开发会话结束后，必须更新开发日志：

1. **创建/更新当日日志文件** (`doc/dev-logs/YYMMDD-HHmm.md`)
   - 对话时间（精确到分钟）
   - Token 估算
   - 完成工作摘要
   - 修改的文件列表

2. **更新日志索引** (`doc/dev-logs/README.md`)
   - 在索引表中添加新条目

3. **提交并推送日志更新**
   ```bash
   git add doc/dev-logs/
   git commit -m "dev-log: <简短描述>"
   git push origin master && git push github master
   ```

## 日志格式模板
```markdown
# Dev Log - YYYY-MM-DD HH:MM

**Duration**: X minutes
**Tokens**: ~X,XXX

## Summary
简要描述本次会话完成的工作

## Changes
- xxx.md (新增/修改) - 描述
- xxx.tsx (新增/修改) - 描述
```

## 日志用途
- AI 理解项目开发进度
- 顶部摘要供人类快速审阅
- 追踪功能开发的时间线
