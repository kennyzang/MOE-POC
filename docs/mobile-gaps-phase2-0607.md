# Mobile 端功能补全计划 (Phase 2)

> **日期**: 2026-06-07
> **基于**: PC vs Mobile 功能对比分析
> **目标**: 补齐演示相关的高/中优先级功能缺口
> **前置完成**: Phase 1 — Teacher Messages/Profile/Announcements Tab (260607-1530)

---

## Gap 清单

### P2-1: Announcements Tab 入口 (Parent + Student) — 高优先级

**问题**: 路由 `/student/announcements` 和 `/parent/announcements` 已存在，但 RoleTabBar 无入口
**改动**:
- [ ] `RoleTabBar.tsx`: parent tabs +1 (Announcements), student tabs +1 (Announcements)
- [ ] i18n: 已有 `announcements.title` 键，无需新增
- [ ] 验证: 构建通过

**文件变更**: 1 文件修改

---

### P2-2: Parent Fees 页面 — 高优先级

**PC 参考**: `pc/src/pages/parent/ParentFeesPage.tsx`
**移动端文件**: `mobile/src/pages/parent/ParentFeesPage.tsx` (新建)
**路由**: `/parent/fees`
**功能点**:
- [ ] 孩子选择器（多子女场景）
- [ ] 费用概览卡片：总应缴 / 已付 / 欠费
- [ ] 费用明细列表（学期、类型、金额、状态）
- [ ] 支付状态 Tag（Paid / Pending / Overdue）
- [ ] Loading 骨架屏 + 空状态
- [ ] AppLayout 包裹，showLogout
- [ ] 路由注册到 `App.tsx`

**API 依赖**:
- `GET /fees?studentId=xxx` 或 `GET /parent/fees-summary`

**i18n 新键**:
```
parent.fees = 'Fees'
parent.totalDue = 'Total Due'
parent.paid = 'Paid'
parent.outstanding = 'Outstanding'
parent.feeType = 'Type'
parent.amount = 'Amount'
parent.status = 'Status'
parent.semester = 'Semester'
parent.noFees = 'No fee records'
parent.feeSummary = 'Fee Summary'
```

**文件变更**: 3 文件 (新建页面 + App.tsx + i18n×3)

---

### P2-3: Teacher Assignments 页面 — 中优先级

**PC 参考**: `pc/src/pages/teacher/AssignmentsPage.tsx`
**移动端文件**: `mobile/src/pages/teacher/TeacherAssignmentsPage.tsx` (新建)
**路由**: `/teacher/assignments`
**功能点**:
- [ ] 课程选择器（切换查看不同课程作业）
- [ ] 作业列表：标题、截止日期、提交状态、已交/总数
- [ ] 作业详情入口（点击展开或跳转）
- [ ] 创建新作业按钮（FAB 或顶部按钮）
- [ ] 下拉刷新 + Loading
- [ ] 空状态提示
- [ ] AppLayout 包裹
- [ ] 路由注册

**API 依赖**:
- `GET /assignments?courseId=xxx`
- `POST /assignments` (创建)

**i18n 新键**:
```
teacher.assignments = 'Assignments'
teacher.createAssignment = 'Create Assignment'
teacher.dueDate = 'Due Date'
teacher.submitted = 'Submitted'
teacher.submissions = 'Submissions'
teacher.noAssignments = 'No assignments yet'
teacher.assignmentTitle = 'Title'
teacher.newAssignment = 'New Assignment'
```

**文件变更**: 4 文件 (新建页面 + App.tsx + 可能 TabBar + i18n×3)

---

### P2-4: Student Assignments 页面 — 中优先级

**PC 参考**: `pc/src/pages/student/StudentAssignmentsPage.tsx`
**移动端文件**: `mobile/src/pages/student/StudentAssignmentsPage.tsx` (新建)
**路由**: `/student/assignments`
**功能点**:
- [ ] 作业列表（按课程分组或平铺）
- [ ] 标题、课程名、截止日期、状态（Pending / Submitted / Overdue）
- [ ] 状态颜色区分
- [ ] 点击进入详情/提交
- [ ] 下拉刷新 + Loading + 空状态
- [ ] AppLayout 包裹
- [ ] 路由注册

**i18n 新键**:
```
student.assignments = 'Assignments'
student.dueDate = 'Due Date'
student.submit = 'Submit'
student.pending = 'Pending'
student.submitted = 'Submitted'
student.overdue = 'Overdue'
student.noAssignments = 'No assignments assigned'
```

**文件变更**: 3 文件 (新建页面 + App.tsx + i18n×3)

---

## 完成情况追踪

| # | 功能 | 优先级 | 状态 | 完成时间 |
|---|------|:------:|:----:|:--------:|
| P2-1 | Announcements Tab (Parent+Student) | 🔴 高 | ⬜ 待开发 | — |
| P2-2 | Parent Fees 页面 | 🔴 高 | ⬜ 待开发 | — |
| P2-3 | Teacher Assignments 页面 | 🟡 中 | ⬜ 待开发 | — |
| P2-4 | Student Assignments 页面 | 🟡 中 | ⬜ 待开发 | — |
| V1 | 构建验证 | 必须 | ⬜ 待验证 | — |

---

## 文件变更汇总

| 操作 | 文件路径 | 所属任务 |
|------|---------|---------|
| **修改** | `mobile/src/components/RoleTabBar.tsx` | P2-1 |
| **新建** | `mobile/src/pages/parent/ParentFeesPage.tsx` | P2-2 |
| **新建** | `mobile/src/pages/teacher/TeacherAssignmentsPage.tsx` | P2-3 |
| **新建** | `mobile/src/pages/student/StudentAssignmentsPage.tsx` | P2-4 |
| **修改** | `mobile/src/App.tsx` | P2-1~P2-4 |
| **修改** | `mobile/src/locales/en.ts` | P2-2~P2-4 |
| **修改** | `mobile/src/locales/zh.ts` | P2-2~P2-4 |
| **修改** | `mobile/src/locales/ms.ts` | P2-2~P2-4 |
