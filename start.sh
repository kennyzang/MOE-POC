#!/bin/bash
# MOE SERPS — 一键启动脚本
# 启动：后端 (4000) + PC前端 (3000) + 移动端 (3001)
# 用法：
#   ./start.sh          # 启动全部（后端 + PC + 移动端）
#   ./start.sh backend  # 仅后端
#   ./start.sh mobile   # 后端 + 移动端
#   ./start.sh pc       # 后端 + PC前端

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-all}"

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log() { echo -e "${GREEN}[MOE]${NC} $1"; }
warn() { echo -e "${YELLOW}[MOE]${NC} $1"; }

# 检查端口占用并杀掉旧进程
free_port() {
  local port=$1
  local pid
  pid=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    warn "端口 $port 被占用，正在释放..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 1
  fi
}

# 启动后端
start_backend() {
  free_port 4000
  log "启动后端 → http://localhost:4000"
  cd "$ROOT/backend"
  npm run dev > /tmp/moe-backend.log 2>&1 &
  echo $! > /tmp/moe-backend.pid
  sleep 3
  if curl -sf http://localhost:4000/api/v1/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"Demo@2026"}' > /dev/null 2>&1; then
    log "后端已就绪 ✓"
  else
    warn "后端启动中，稍候..."
  fi
}

# 启动PC前端
start_pc() {
  free_port 3000
  log "启动PC前端 → http://localhost:3000"
  cd "$ROOT/pc"
  npm run dev > /tmp/moe-pc.log 2>&1 &
  echo $! > /tmp/moe-pc.pid
}

# 启动移动端
start_mobile() {
  free_port 3001
  log "启动移动端 → http://localhost:3001"
  cd "$ROOT/mobile"
  npm run dev > /tmp/moe-mobile.log 2>&1 &
  echo $! > /tmp/moe-mobile.pid
}

# 停止所有服务
stop_all() {
  log "停止所有服务..."
  for f in /tmp/moe-backend.pid /tmp/moe-pc.pid /tmp/moe-mobile.pid; do
    [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null && rm "$f" || true
  done
  lsof -ti:4000,3000,3001 | xargs kill -9 2>/dev/null || true
  log "已停止"
}

trap stop_all EXIT INT TERM

case "$MODE" in
  backend)
    start_backend
    ;;
  pc)
    start_backend
    start_pc
    ;;
  mobile)
    start_backend
    start_mobile
    ;;
  all|*)
    start_backend
    start_pc
    start_mobile
    ;;
esac

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  MOE SERPS 已启动${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
[ "$MODE" = "all" ] || [ "$MODE" = "pc" ]     && echo -e "  PC 前端   → ${BLUE}http://localhost:3000${NC}"
[ "$MODE" = "all" ] || [ "$MODE" = "mobile" ] && echo -e "  移动端    → ${BLUE}http://localhost:3001${NC}"
echo -e "  后端 API  → ${BLUE}http://localhost:4000${NC}"
echo ""
echo -e "  ${YELLOW}演示账号（密码均为 Demo@2026）${NC}"
echo -e "  家长: fatimah   学生: adam   教师: drsiti"
echo -e "  管理: admin     校长: manager"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  按 ${RED}Ctrl+C${NC} 停止所有服务"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 保持脚本运行，捕获 Ctrl+C
wait
