#!/usr/bin/env bash
set -euo pipefail

APP_NAME="rotz"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${REPO_DIR}/docker-compose.yaml"
DATA_DIR="${REPO_DIR}/data"
DEFAULT_PORT=3000
PROJECT_NAME=""

info(){ echo -e "[INFO] $*"; }
warn(){ echo -e "[WARN] $*"; }
err(){ echo -e "[ERROR] $*" 1>&2; }

require_cmd(){ command -v "$1" >/dev/null 2>&1 || return 1; }

pick_free_port(){
  local start=${1:-3000}
  local port=$start
  while true; do
    if ! lsof -iTCP -sTCP:LISTEN -P | awk '{print $9}' | grep -q ":${port}$"; then
      echo "$port"; return 0
    fi
    port=$((port+1))
  done
}

install_docker(){
  info "Installing Docker Engine..."
  if require_cmd apt-get; then
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER" || true
    info "Docker installed. You may need to log out/in for group changes to take effect."
  else
    err "Unsupported package manager. Please install Docker manually."; exit 1
  fi
}

ensure_docker(){
  if ! require_cmd docker; then install_docker; fi
  if ! sudo systemctl is-active --quiet docker; then
    info "Starting docker service"; sudo systemctl start docker || true
  fi
  sudo systemctl enable docker >/dev/null 2>&1 || true
}

ensure_compose(){
  if docker compose version >/dev/null 2>&1; then
    return
  fi
  warn "docker compose plugin not found; attempting to install docker-compose v2 binary"
  sudo curl -L "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
}

ensure_data_dir(){
  mkdir -p "$DATA_DIR"
  chmod 700 "$DATA_DIR" || true
}

ensure_env_file(){
  # Create an env file to silence compose warnings and provide placeholders
  local env_file="${REPO_DIR}/.env.local"
  if [[ ! -f "$env_file" ]]; then
    cat > "$env_file" <<EOF
# Provider keys (optional). Leave blank or fill as needed.
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
OPEN_ROUTER_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
HuggingFace_API_KEY=
TOGETHER_API_KEY=
XAI_API_KEY=
TOGETHER_API_BASE_URL=
OLLAMA_API_BASE_URL=
AWS_BEDROCK_CONFIG=
# App tuning (optional)
VITE_LOG_LEVEL=debug
DEFAULT_NUM_CTX=32768
EOF
  fi
}

check_container_conflicts(){
  local in_use
  in_use=$(docker ps --format '{{.Names}}' | grep -E "^${APP_NAME}(-prod)?$" || true)
  if [[ -n "$in_use" ]]; then
    warn "Found running container named $in_use. It will be recreated."
  fi
}

# Discover other docker-compose.yml files (informational) and ensure we don't collide
detect_existing_compose_stacks(){
  info "Scanning for existing docker-compose projects (this may take a moment)..."
  # List running compose projects by networks and container names
  docker ps --format '{{.Names}}\t{{.Ports}}' | while IFS=$'\t' read -r name ports; do
    if [[ -n "$ports" ]]; then
      echo "$name -> $ports" | sed 's/^/[RUNNING] /'
    fi
  done || true
}

choose_project_name(){
  # Base name from repo dir
  local base
  base=$(basename "$REPO_DIR")
  # Generate a short hash from absolute path for uniqueness
  local short
  short=$(echo -n "$REPO_DIR" | md5sum 2>/dev/null | cut -c1-6 || echo $RANDOM)
  local candidate="${APP_NAME}-${base}-${short}"
  # Ensure network name doesn't collide
  local net="${candidate}_default"
  local n=0
  while docker network ls --format '{{.Name}}' | grep -qx "$net"; do
    n=$((n+1))
    candidate="${APP_NAME}-${base}-${short}-${n}"
    net="${candidate}_default"
  done
  PROJECT_NAME="$candidate"
  info "Using Docker Compose project name: ${PROJECT_NAME}"
}

choose_port(){
  local desired=${APP_PORT:-$DEFAULT_PORT}
  if lsof -iTCP -sTCP:LISTEN -P | awk '{print $9}' | grep -q ":${desired}$"; then
    local free_port
    free_port=$(pick_free_port "$desired")
    warn "Port ${desired} is in use. Using free port ${free_port}."
    export APP_PORT="$free_port"
  else
    export APP_PORT="$desired"
  fi
}

build_and_start(){
  info "Building image and starting containers..."
  (cd "$REPO_DIR" && COMPOSE_PROJECT_NAME="$PROJECT_NAME" APP_PORT="$APP_PORT" docker compose --profile production up -d --build)
}

enable_autostart(){
  # Docker containers with restart policy 'unless-stopped' auto start after reboot
  info "Ensuring restart policy set (unless-stopped)"
  docker update --restart unless-stopped $(COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose ps -q app-prod) >/dev/null 2>&1 || true
}

print_summary(){
  echo ""
  info "Installation complete"
  info "URL: http://$(hostname -I | awk '{print $1}'):${APP_PORT:-$DEFAULT_PORT}"
  info "Local: http://localhost:${APP_PORT:-$DEFAULT_PORT}"
  info "Data persisted at: ${DATA_DIR}"
  echo ""
  info "Bootstrap admin (only if users table is empty):"
  echo "  curl -X POST http://localhost:${APP_PORT:-$DEFAULT_PORT}/api/auth/local/bootstrap -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"ChangeMe!\"}'"
}

# -----------------------------
# Local (bare-metal) installation
# -----------------------------
install_node(){
  if require_cmd node && require_cmd npm; then return; fi
  info "Installing Node.js (LTS) via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
}

install_pnpm(){
  if require_cmd pnpm; then return; fi
  info "Installing pnpm..."; sudo npm i -g pnpm
}

ensure_build_tools(){
  info "Installing build tools for native modules..."
  sudo apt-get update -y
  sudo apt-get install -y build-essential python3 make g++ git curl
}

local_data_dir(){
  # Use /var/lib/rotz for system install
  echo "/var/lib/rotz"
}

setup_local_service(){
  local svc="rotz.service"
  local port=${APP_PORT:-$DEFAULT_PORT}
  local state_dir=$(local_data_dir)
  sudo mkdir -p "$state_dir"
  sudo chown "$USER":"$USER" "$state_dir"

  info "Installing dependencies and building app..."
  (cd "$REPO_DIR" && pnpm install && pnpm run build)

  info "Creating systemd service at /etc/systemd/system/${svc}"
  sudo bash -c "cat > /etc/systemd/system/${svc}" <<EOF
[Unit]
Description=ROTZ AI Builder
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${REPO_DIR}
Environment=PORT=${port}
Environment=DB_DIR=${state_dir}
ExecStart=/usr/bin/env bash -lc 'pnpm run start:node'
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable --now "$svc"
}

print_summary_local(){
  echo ""
  info "Local installation complete"
  info "URL: http://$(hostname -I | awk '{print $1}'):${APP_PORT:-$DEFAULT_PORT}"
  info "Local: http://localhost:${APP_PORT:-$DEFAULT_PORT}"
  info "Data persisted at: $(local_data_dir)"
  echo ""
  info "Bootstrap admin (only if users table is empty):"
  echo "  curl -X POST http://localhost:${APP_PORT:-$DEFAULT_PORT}/api/auth/local/bootstrap -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"ChangeMe!\"}'"
}

prompt_mode(){
  # Priority: CLI flag > ENV var > interactive prompt > default docker
  local arg_mode="${1:-}"
  if [[ "$arg_mode" == "--docker" || "$arg_mode" == "-d" ]]; then echo "docker"; return; fi
  if [[ "$arg_mode" == "--local" || "$arg_mode" == "-l" ]]; then echo "local"; return; fi
  if [[ -n "${INSTALL_MODE:-}" ]]; then
    case "${INSTALL_MODE,,}" in
      docker) echo "docker"; return ;;
      local) echo "local"; return ;;
    esac
  fi
  # Non-interactive shells: default to docker
  if [[ ! -t 0 ]]; then echo "docker"; return; fi
  echo -n "Install using Docker (recommended) or Local? [D/l]: "
  read -r choice || true
  case "${choice,,}" in
    l|local) echo "local" ;;
    d|docker|"") echo "docker" ;;
    *) echo "docker" ;;
  esac
}

main(){
  info "Starting ROTZ installer"
  mode=$(prompt_mode "${1:-}")
  ensure_data_dir
  choose_port

  if [[ "$mode" == "docker" ]]; then
    ensure_docker
    ensure_compose
    detect_existing_compose_stacks
    check_container_conflicts
    choose_project_name
    ensure_env_file
    build_and_start
    enable_autostart
    print_summary
  else
    ensure_build_tools
    install_node
    install_pnpm
    setup_local_service
    print_summary_local
  fi
}

main "$@"
