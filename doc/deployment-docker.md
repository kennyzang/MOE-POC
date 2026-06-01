# Docker 部署指南 — 阿里云

## 架构概览

```
互联网
  ├── :3000  → nginx (pc)    → /api/* → backend:4000
  ├── :3001  → nginx (mobile)→ /api/* → backend:4000
  └── :4000  → Express backend (可选对外，也可不暴露)
```

- **pc** / **mobile**：Nginx 静态服务 + 反向代理 `/api` 到 backend
- **backend**：Express + Prisma，SQLite 数据库存于 Docker volume `db_data`
- 首次启动自动执行 `prisma db push` + 数据库初始化 seed

---

## 服务器准备

```bash
# 安装 Docker（ECS Ubuntu/Debian）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 安装 Docker Compose plugin（已含在新版 docker 中，如需单独安装）
sudo apt-get install docker-compose-plugin
```

---

## 部署步骤

### 1. 拉取代码

```bash
git clone <你的仓库地址> /opt/moe-serps
cd /opt/moe-serps
```

### 2. 创建环境变量文件

```bash
cp .env.example .env
# 编辑 .env，至少修改 JWT_SECRET
nano .env
```

生成随机 JWT_SECRET：
```bash
openssl rand -hex 32
```

### 3. 构建并启动

```bash
# 首次构建（需要几分钟）
docker compose up -d --build

# 查看启动日志
docker compose logs -f

# 查看各服务状态
docker compose ps
```

### 4. 验证服务

```bash
# 后端健康检查
curl http://localhost:4000/

# 前端
curl -I http://localhost:3000
curl -I http://localhost:3001
```

---

## 常用运维命令

```bash
# 停止所有服务
docker compose down

# 停止并删除数据库（危险！会清除所有数据）
docker compose down -v

# 重新 seed 数据库（重置演示数据）
docker compose exec backend npm run db:reset

# 查看后端实时日志
docker compose logs -f backend

# 进入后端容器
docker compose exec backend sh

# 更新代码后重新部署
git pull
docker compose up -d --build
```

---

## 端口说明

| 端口 | 服务 | 备注 |
|------|------|------|
| 3000 | PC 前端 | 对外开放 |
| 3001 | 移动端 | 对外开放 |
| 4000 | 后端 API | 可选：仅内部访问 |

> 建议在阿里云安全组只开放 3000/3001，后端 4000 设为仅内网访问。

---

## 数据持久化

SQLite 数据库存储在 Docker named volume `moe-serps_db_data`，容器重启不会丢失数据。

```bash
# 查看 volume 位置
docker volume inspect moe-serps_db_data

# 备份数据库
docker compose exec backend sh -c "cp /app/data/db.sqlite /tmp/backup.sqlite"
docker cp $(docker compose ps -q backend):/tmp/backup.sqlite ./backup-$(date +%Y%m%d).sqlite
```

---

## 阿里云安全组配置

在 ECS 控制台 → 安全组 → 入方向，开放：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 3000 | 0.0.0.0/0 | PC 前端 |
| TCP | 3001 | 0.0.0.0/0 | 移动端 |
| TCP | 22 | 你的 IP | SSH（建议限制 IP） |
