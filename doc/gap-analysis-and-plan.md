# MOE SERPS — Gap Analysis & 实施计划（6/10 演示）

> 分析基准：`doc/MOE_SERPS_POC_Demo_v2_EN.xlsx`（v2 版 55 分钟演示脚本）  
> 当前日期：2026-05-25 | 演示日期：2026-06-10 | 剩余：16 天

---

## 一、55 分钟演示脚本 → 现状映射

| # | 演示段 | 时长 | 当前状态 | 差距 |
|---|--------|------|----------|------|
| 1 | Command Center Dashboard | 8 min | ⚠️ 部分 | 缺 Staff Status widget、Timetable Conflicts widget |
| 2 | Ahmad 故事引入 | 2 min | ❌ 无数据 | 需要 Ahmad 完整种子数据 |
| 3 | SIS — 录取 → 入学（4步向导）| 8 min | ⚠️ 部分 | 现在只有状态列表，缺 4 步 Wizard、邮件通知 |
| 4 | SIS — 教师 PWA 考勤打卡 | 5 min | ⚠️ 部分 | 有考勤页，缺卡片式交互、缺家长缺勤通知 |
| 5 | SIS — 成绩录入 + 学生视图 | 4 min | ✅ 基本完成 | 数据需对齐 Ahmad |
| 6 | EMS — 教师档案 + CPD + 绩效评估 | 6 min | ❌ 缺核心 | 缺 CPD 小时数、自动告警、绩效评估审批工作流 |
| 7 | SMS — 课表自动生成 + 设施预约 | 5 min | ❌ 完全缺失 | 课表生成、约束更新、学校日历 |
| 8 | Mobile PWA（离线 + 推送通知）| 5 min | ⚠️ 部分 | 有 H5，缺 Service Worker 离线、Push Notification |
| 9 | AI — 聊天机器人 + 风险预测 | 7 min | ❌ 完全缺失 | AI Chatbot（Claude API）、At-Risk 仪表板 |
| 10 | Q&A Wrap-up | 5 min | ✅ — | — |

**未实现演示时长合计：约 26 分钟（47%）**

---

## 二、账号体系差距（需修正）

| 演示文档要求 | 密码 | 当前系统 | 操作 |
|-------------|------|----------|------|
| admin | admin123 | admin / Demo@2026 | 改密码 or 快速登录按钮更新 |
| **principal**（新增）| principal123 | 无此角色（有 manager）| 新增角色 |
| teacher01 | teacher123 | drsiti / Demo@2026 | 新增 teacher01 账号 |
| student001 | student123 | adam / Demo@2026 | 新增 student001（即 Ahmad）|
| parent01 | parent123 | fatimah / Demo@2026 | 新增 parent01（Ahmad 的家长）|
| admission | admission123 | admissions / Demo@2026 | 改账号名/密码 |
| **hod01**（Head of Department，新增）| hod123 | 无此角色 | 新增角色 |

---

## 三、优先级排序与工作量估算

### 🔴 P0 — 演示能跑通的基础（必须，约 5 天）

| 任务 | 说明 | 估算 |
|------|------|------|
| 种子数据：Ahmad 全链路 | Ahmad 学生 + 家长账号 + 多年级数据（Year 7-11，每级 5 人）| 0.5 天 |
| 账号体系对齐 | principal / hod01 新角色，账号名/密码与演示文档一致 | 0.5 天 |
| Dashboard 补全 | Staff Status widget（在职/请假/培训中）+ Timetable Conflicts widget | 1 天 |
| SMS 课表模块 | 自动生成页面（可用预计算结果展示）+ 约束更新 + 设施预约 | 1.5 天 |
| EMS CPD + 绩效评估 | CPD 小时数跟踪 + <20h 告警 + 绩效评估表单 + HOD→Principal 审批工作流 | 1.5 天 |

### 🟡 P1 — 演示关键场景（重要，约 5 天）

| 任务 | 说明 | 估算 |
|------|------|------|
| AI Chatbot | Claude API + RAG（ERP 数据检索）+ 学生 Portal 嵌入 + Mobile 同步 | 2 天 |
| AI At-Risk 仪表板 | 规则引擎计算风险分（出勤率 + 成绩趋势）+ 仪表板 + 辅导员通知 | 1.5 天 |
| SIS 录取 4 步向导 | 升级当前录取页为 Wizard（表单 + 年龄-年级校验 + 学生 ID 自动生成）| 1.5 天 |

### 🟢 P2 — 提升完成度（如果时间允许，约 4 天）

| 任务 | 说明 | 估算 |
|------|------|------|
| Mobile PWA 化 | 添加 manifest.json + Service Worker + 离线缓存（课表、成绩）| 1.5 天 |
| 应用内通知系统 | 缺勤→家长通知 + 录取通过通知 + CPD 告警（站内信/弹窗）| 1.5 天 |
| 学校日历 | 学期日历管理页面（School Calendar）+ 事件广播 | 1 天 |

---

## 四、16 天排期建议

```
Week 1 (5/26 - 6/1)：地基 + 核心模块
  5/26（一）种子数据 + 账号体系重构
  5/27（二）Dashboard 补全（Staff Status + Timetable Conflicts）
  5/28（三）SMS 课表模块（自动生成 UI + 约束更新 + 设施预约）
  5/29（四）EMS 补全（CPD 追踪 + 告警 + 绩效评估工作流）
  5/30（五）SIS 录取 4 步 Wizard
  5/31（六）全链路第一次贯穿测试 + Bug 修复

Week 2 (6/2 - 6/9)：AI + PWA + 收尾
  6/2（一） AI Chatbot（Claude API + RAG）
  6/3（二） AI At-Risk 仪表板
  6/4（三） Mobile PWA 化 + Push Notification
  6/5（四） 应用内通知系统
  6/6（五） 学校日历 + 演示数据精调
  6/7（六） 完整 55 分钟演示预演（按演示脚本逐项走）
  6/8（日） Bug 修复 + 数据打磨
  6/9（一） 终版封存 + 部署测试 + 备选截图兜底准备
```

---

## 五、技术实现方案说明

### SMS 课表自动生成
- 后端实现约束满足（教师不重复 + 教室容量 + 科目分布），纯 JS 可完成
- 前端：拖拽可调整的周视图（antd Table / 自定义 Grid）
- 演示时：预先生成 Grade 7A 课表，实时展示"添加约束→重新生成"

### AI Chatbot
- 使用 Claude API（claude-sonnet-4-6）
- RAG 数据源：后端提供 `/ai/context` 接口（学生成绩、课程、截止日期）
- 前端：嵌入学生 Portal 侧边悬浮 Chat 窗口，Mobile 同步

### AI At-Risk 分析
- 后端：规则引擎（出勤率 <60% AND 近 4 周成绩下降 → HIGH RISK）
- 不需要真实 ML 模型，规则计算 + 可信度百分比可以满足演示
- 前端：Principal 专属 Dashboard Tab，红/黄/绿三级标注，时间轴图表

### Mobile PWA
- `vite-plugin-pwa` + Workbox 自动生成 Service Worker
- 离线缓存：课表 + 成绩（IndexedDB via idb-keyval）
- Push：Web Push API（VAPID keys，后端发送）

---

## 六、风险点

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| AI API 超时（演示网络差）| 中 | 高 | 本地缓存预热 + 超时显示"数据加载中" |
| 课表生成算法复杂度（数据量大时慢）| 中 | 中 | 预计算 + 演示时限制班级数量 |
| PWA push notification iOS 限制 | 高 | 中 | 用浏览器通知 API 兜底，或演示时用 Android |
| 6/9 后无法修改 | — | 高 | 6/7 完成封存，6/8-9 只做 hotfix |

---

## 七、下一步确认

在开始开发前，请确认以下几点：

1. **账号密码**：演示文档用的是 `admin123` 这类简单密码，还是沿用当前 `Demo@2026`？
2. **AI 功能**：是否有 Claude API Key 可以集成到项目里？
3. **Mobile 端**：演示时用手机真机还是 Chrome 模拟？（影响 PWA push notification 的实现方式）
4. **课表算法**：是否需要真正的约束求解（可能有 bug），还是"看起来像"就够？
5. **开发节奏**：是否按上面的排期，每天由 AI 自主开发，你每天晚上验收？
