# 项目概述

## 项目定位
文莱教育部 (MOE Brunei) 学校企业资源规划系统 POC 演示项目。

## 技术栈
- **PC 前端**: React + Vite + TypeScript + Ant Design (antd)
- **Mobile**: H5 PWA (Vite + antd-mobile)，独立项目
- **后端**: Express + Prisma + SQLite + JWT
- **状态管理**: Zustand
- **图标**: Lucide React（禁止 emoji 图标）
- **图表**: Recharts
- **国际化**: i18next + react-i18next (英文/中文/马来语)
- **样式**: CSS Modules + CSS 变量

## 项目结构
```
moe-poc-claude/
├── pc/           # PC 前端
├── mobile/       # 移动端 H5
├── backend/      # Express + Prisma API
├── doc/          # 开发文档和日志
├── docs/         # 规格和计划文档
└── prompt/       # AI 开发提示词
```

## 参考项目
基于 UNISSA-POC (`/Users/xiex/Documents/GIT/OVERSEABU/unissa-poc`)，适配 K-12 学校场景。

## Demo 账号

| 角色 | 用户名 | 显示名 | 密码 |
|------|--------|--------|------|
| admin | admin | System Admin | admin123 |
| principal | principal | Hjh Rashidah | principal123 |
| hod | hod01 | Dr. Azman | hod123 |
| manager | manager | Hj Kamaruddin | Demo@2026 |
| finance | finance | Finance Officer | finance123 |
| admissions | admission | Admission Officer | admission123 |
| teacher | drsiti | Dr. Siti Nurhaliza | Demo@2026 |
| teacher | faizal | Mohd Faizal Bin Aziz | Demo@2026 |
| student | student001 | Ahmad Bin Abdullah | student123 |
| student | adam | Adam Bin Haris | Demo@2026 |
| parent | parent01 | Hj Abdullah | parent123 |
| parent | fatimah | Fatimah Binti Yusof | Demo@2026 |
