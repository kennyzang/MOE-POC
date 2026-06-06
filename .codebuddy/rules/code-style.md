# 代码风格

## 命名规范
- **组件**: 函数组件 + Hooks，PascalCase 文件名（如 `StudentHomePage.tsx`）
- **工具/辅助函数**: camelCase 文件名
- **页面**: 每个页面组件放在 `pages/` 下独立目录

## 项目入口
- PC: `pc/src/main.tsx` → `App.tsx`（路由配置）
- Mobile: `mobile/src/main.tsx` → `App.tsx`（路由配置）

## 目录约定

### PC 端
```
pc/src/
├── main.tsx          # 应用入口
├── pages/            # 页面组件（按模块分组）
├── components/       # 共享组件
├── layouts/          # 布局组件
├── stores/           # Zustand stores
├── hooks/            # 自定义 hooks
├── lib/              # 工具库 (api, i18n, queryClient)
├── types/            # TypeScript 类型
├── locales/          # 国际化翻译文件
├── router/           # 路由配置
└── styles/           # 全局样式
```

### Mobile 端
```
mobile/src/
├── main.tsx          # 应用入口
├── pages/            # 页面组件（按角色分组: auth/parent/student/teacher）
├── components/       # 共享组件 (AppLayout, NavHeader, RoleTabBar)
├── stores/           # Zustand stores
├── hooks/            # 自定义 hooks
├── lib/              # 工具库 (api, i18n)
├── types/            # TypeScript 类型
├── locales/          # 国际化翻译文件
└── styles/           # 全局样式
```

## 状态管理
- 客户端状态: Zustand（带 persist 中间件持久化到 localStorage）
- 服务端状态: TanStack React Query（staleTime: 30s, retry: 1）

## 编码风格
- 遵循项目中的 `.prettierrc` 和 `.eslintrc` 配置
- 优先使用函数式组件 + React Hooks
- 类型定义集中在 `types/index.ts`
