# 硬性规则（必须遵守）

## UI 组件
1. **所有 UI 组件必须使用 Ant Design**（PC: antd, Mobile: antd-mobile）。禁止原生 HTML date picker、select 等
2. **图标必须使用 Lucide React**。禁止 emoji 图标、禁止其他图标库

## 国际化
3. **所有用户可见文本必须走 i18n**（`useTranslation` / `t()`）。禁止硬编码字符串。支持三语：en / zh / ms

## TypeScript
4. **TypeScript 严格模式**。禁止 `@ts-ignore`，尽量减少 `any` 使用

## 数据
5. **仪表盘/统计数字必须来自后端 DB 查询**。禁止硬编码假数据

## 项目分离
6. **PC 和 Mobile 是独立项目**。不做响应式混合，各自独立开发和构建

## 样式
7. **样式必须易于修改**。使用 CSS Modules + CSS 变量，避免深层 SCSS 嵌套

## 构建
8. **每次 commit 前必须运行 `npm run build`**。开发服务器不做类型检查，Docker CI 会做

## 常见类型错误模式（避免踩坑）
- **Recharts Tooltip formatter**：参数类型是 `ValueType | undefined`，不是 `number`。用 `(v) => [(v as number).toFixed(1), 'label']`
- **Lucide React 图标**：只接受 `size` 和 `className`，不接受 `style` 或 `color`。着色用 `<span style={{ color: '...' }}><Icon /></span>`
- **AxiosHeaders**：`response.headers['content-type']` 类型宽，需 `as string` 转型
