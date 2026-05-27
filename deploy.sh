#!/usr/bin/env bash
# TradeOps AI — Linux / macOS Deployment Script v3.14.0
#
# Usage:
#   ./deploy.sh                # First-time setup and start
#   ./deploy.sh --stop         # Stop all services
#   ./deploy.sh --update       # Rebuild images and restart (keep secrets)
#   ./deploy.sh --reset        # Wipe secrets and regenerate everything
#   ./deploy.sh --monitoring   # Also start Prometheus + Grafana
#
# Requirements (Linux):  Docker Engine 24+, docker compose v2, openssl, curl
# Requirements (macOS):  Docker Desktop 24+, Homebrew (optional), openssl, curl
#
# Run from the repository root directory.

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}  ✔  ${RESET}$*"; }
info() { echo -e "${CYAN}  ℹ  ${RESET}$*"; }
warn() { echo -e "${YELLOW}  ⚠  ${RESET}$*"; }
fail() { echo -e "${RED}  ✖  ${RESET}$*" >&2; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}▸ $*${RESET}"; }

# ── Constants ─────────────────────────────────────────────────────────────────
MIN_DISK_GB=15
MIN_RAM_GB=6
COMPOSE_FILE="infra/docker-compose.yml"
MONITORING_COMPOSE="infra/docker-compose.monitoring.yml"
ENV_FILE="backend/.env"
ENV_EXAMPLE="backend/.env.example"

# ── Parse flags ───────────────────────────────────────────────────────────────
MODE="start"
for arg in "$@"; do
  case "$arg" in
    --stop)       MODE="stop" ;;
    --update)     MODE="update" ;;
    --reset)      MODE="reset" ;;
    --monitoring) MODE="monitoring" ;;
    -h|--help)
      grep '^#' "$0" | head -20 | sed 's/^# \?//'
      exit 0
      ;;
    *) fail "Unknown option: $arg. Use --help for usage." ;;
  esac
done

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║          T r a d e O p s   A I                      ║"
echo "  ║          AI  —  Deployment Script v3.14.0            ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Utility: check a command exists ──────────────────────────────────────────
require_cmd() {
  command -v "$1" &>/dev/null || fail "'$1' is not installed or not in PATH. $2"
}

# ── STOP mode ─────────────────────────────────────────────────────────────────
if [[ "$MODE" == "stop" ]]; then
  step "Stopping all services"
  docker compose -f "$COMPOSE_FILE" down
  ok "All services stopped."
  exit 0
fi

# ── RESET mode ────────────────────────────────────────────────────────────────
if [[ "$MODE" == "reset" ]]; then
  step "Resetting: stopping services and removing generated secrets"
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
  if [[ -f "$ENV_FILE" ]]; then
    rm "$ENV_FILE"
    ok "Removed $ENV_FILE"
  fi
  info "Re-run ./deploy.sh to regenerate secrets and start fresh."
  exit 0
fi

# ── System checks ─────────────────────────────────────────────────────────────
step "Checking system requirements"

require_cmd docker  "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ or run: sudo apt-get install docker.io docker-compose-plugin"
require_cmd openssl "Install openssl: sudo apt-get install openssl  (or: brew install openssl on macOS)"

# Docker running?
if ! docker info &>/dev/null; then
  fail "Docker is installed but not running. Start Docker Desktop and try again."
fi

# docker compose v2?
if ! docker compose version &>/dev/null; then
  fail "docker compose v2 plugin not found. Update Docker Desktop or install the plugin: https://docs.docker.com/compose/install/"
fi
ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# Disk space
AVAILABLE_GB=$(df -BG . 2>/dev/null | awk 'NR==2 {gsub("G",""); print $4}' || echo 999)
if [[ "$AVAILABLE_GB" -lt "$MIN_DISK_GB" ]]; then
  fail "Only ${AVAILABLE_GB}GB free. ${MIN_DISK_GB}GB required."
fi
ok "Disk space: ${AVAILABLE_GB}GB available"

# RAM (Linux: /proc/meminfo; macOS: sysctl)
if [[ "$(uname)" == "Darwin" ]]; then
  TOTAL_RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
else
  TOTAL_RAM_GB=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1048576 ))
fi
if [[ "$TOTAL_RAM_GB" -lt "$MIN_RAM_GB" ]]; then
  warn "Only ${TOTAL_RAM_GB}GB RAM detected. ${MIN_RAM_GB}GB recommended for smooth operation."
else
  ok "RAM: ${TOTAL_RAM_GB}GB"
fi

# ── Compose file exists? ──────────────────────────────────────────────────────
[[ -f "$COMPOSE_FILE" ]] || fail "Could not find $COMPOSE_FILE. Run this script from the repository root."

# ── Secret generation ─────────────────────────────────────────────────────────
step "Configuring secrets"

if [[ -f "$ENV_FILE" && "$MODE" != "reset" ]]; then
  info "Found existing $ENV_FILE — skipping secret generation."
  info "Use --reset to wipe and regenerate."
else
  [[ -f "$ENV_EXAMPLE" ]] || fail "Missing $ENV_EXAMPLE. Is your repository intact?"
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -hex 16)
  REDIS_PASSWORD=$(openssl rand -hex 16)

  # Portable sed -i: macOS needs '' after -i
  SED_INPLACE=(-i)
  [[ "$(uname)" == "Darwin" ]] && SED_INPLACE=(-i '')

  sed "${SED_INPLACE[@]}" "s|JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" "$ENV_FILE"
  sed "${SED_INPLACE[@]}" "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASSWORD}|" "$ENV_FILE"
  sed "${SED_INPLACE[@]}" "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASSWORD}|" "$ENV_FILE"

  ok "Generated JWT secret, DB password, Redis password"
fi

# ── Anthropic API key ─────────────────────────────────────────────────────────
CURRENT_KEY=$(grep -E '^ANTHROPIC_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || true)
if [[ -z "$CURRENT_KEY" || "$CURRENT_KEY" == "sk-ant-your-key-here" || "$CURRENT_KEY" == "your-key-here" ]]; then
  echo ""
  echo -e "${YELLOW}  Anthropic API key required for AI features (optional).${RESET}"
  echo -e "  Get your key at: ${BOLD}https://console.anthropic.com/settings/keys${RESET}"
  echo -e "  Press Enter to skip (AI features will be disabled)."
  echo ""
  read -rp "  ANTHROPIC_API_KEY: " USER_API_KEY
  if [[ -n "$USER_API_KEY" ]]; then
    SED_INPLACE=(-i)
    [[ "$(uname)" == "Darwin" ]] && SED_INPLACE=(-i '')
    sed "${SED_INPLACE[@]}" "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${USER_API_KEY}|" "$ENV_FILE"
    ok "API key saved."
  else
    info "Skipped — AI features will be unavailable."
  fi
else
  ok "Anthropic API key already configured."
fi

# ── Build & start ─────────────────────────────────────────────────────────────
step "Building Docker images (this may take a few minutes on first run)"

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [[ "$MODE" == "monitoring" ]] && [[ -f "$MONITORING_COMPOSE" ]]; then
  COMPOSE_ARGS+=(-f "$MONITORING_COMPOSE")
  info "Monitoring stack (Prometheus + Grafana) will also start."
fi

if [[ "$MODE" == "update" ]]; then
  info "Update mode: rebuilding images, restarting services."
  docker compose "${COMPOSE_ARGS[@]}" pull --ignore-pull-failures 2>/dev/null || true
  docker compose "${COMPOSE_ARGS[@]}" build --pull
  docker compose "${COMPOSE_ARGS[@]}" up -d --force-recreate
else
  docker compose "${COMPOSE_ARGS[@]}" build
  docker compose "${COMPOSE_ARGS[@]}" up -d
fi

ok "Docker containers started."

# ── Health checks ─────────────────────────────────────────────────────────────
step "Waiting for services to be ready"

MAX_WAIT=120
INTERVAL=5
ELAPSED=0

wait_for_url() {
  local url="$1"
  local label="$2"
  local waited=0
  while ! curl -sf --max-time 3 "$url" &>/dev/null; do
    if [[ $waited -ge $MAX_WAIT ]]; then
      warn "$label did not respond within ${MAX_WAIT}s. Check: docker compose -f $COMPOSE_FILE logs"
      return 1
    fi
    sleep "$INTERVAL"
    waited=$(( waited + INTERVAL ))
    echo -ne "  Waiting for $label... (${waited}s)\r"
  done
  echo ""
  ok "$label is ready"
}

wait_for_url "http://localhost:8000/health" "Backend API"
wait_for_url "http://localhost:3000"        "Frontend"

if [[ "$MODE" == "monitoring" ]]; then
  wait_for_url "http://localhost:9090"  "Prometheus"
  wait_for_url "http://localhost:3001"  "Grafana"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  ══════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}    TradeOps AI is running!${RESET}"
echo -e "${BOLD}${GREEN}  ══════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}App${RESET}         →  ${CYAN}http://localhost:3000${RESET}"
echo -e "  ${BOLD}API docs${RESET}    →  ${CYAN}http://localhost:8000/docs${RESET}"
if [[ "$MODE" == "monitoring" ]]; then
  echo -e "  ${BOLD}Grafana${RESET}     →  ${CYAN}http://localhost:3001${RESET}  (admin / admin)"
  echo -e "  ${BOLD}Prometheus${RESET}  →  ${CYAN}http://localhost:9090${RESET}"
fi
echo ""
echo -e "  ${DIM}Stop:    ./deploy.sh --stop${RESET}"
echo -e "  ${DIM}Update:  ./deploy.sh --update${RESET}"
echo -e "  ${DIM}Reset:   ./deploy.sh --reset${RESET}"
echo -e "  ${DIM}Logs:    docker compose -f $COMPOSE_FILE logs -f${RESET}"
echo ""
