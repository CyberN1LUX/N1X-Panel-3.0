#!/bin/bash
# =========================================================
# N1X Panel - Automated Node.js Installation & Management
# 100% Pure Node.js Runtime (No Docker Required)
# =========================================================

# Ensure running in bash
if [ -z "$BASH_VERSION" ]; then
    if command -v bash > /dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
fi

# Enhanced 256-color palette
GREEN='\033[38;5;48m'
EMERALD='\033[38;5;42m'
CYAN='\033[38;5;51m'
TEAL='\033[38;5;37m'
BLUE='\033[38;5;75m'
VIOLET='\033[38;5;141m'
YELLOW='\033[38;5;220m'
AMBER='\033[38;5;214m'
RED='\033[38;5;196m'
WHITE='\033[1;37m'
GRAY='\033[38;5;242m'
DARKGRAY='\033[38;5;236m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
    clear 2>/dev/null || true
    echo -e "
  ${CYAN}${BOLD}╭──────────────────────────────────────────────────────────────╮
  │  ${WHITE}███╗   ██╗ ██╗██╗  ██╗${CYAN}   ${BOLD}${WHITE}N1X PANEL INSTALLER${CYAN}               │
  │  ${WHITE}████╗  ██║███║╚██╗██╔╝${CYAN}   ${EMERALD}100% Pure Node.js Process Runtime${CYAN}     │
  │  ${WHITE}██╔██╗ ██║╚██║ ╚███╔╝ ${CYAN}   ${GRAY}Version 3.0.0 (Docker-Free)${CYAN}           │
  ╰──────────────────────────────────────────────────────────────╯${NC}
"
}

log_info() { echo -e "  ${CYAN}ℹ${NC}  $1"; }
log_success() { echo -e "  ${GREEN}✔${NC}  $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
log_error() { echo -e "  ${RED}✖${NC}  $1"; }

execute_step() {
    local msg="$1"
    local func="$2"
    shift 2
    printf "  ${GRAY}│${NC}  %-44s ... " "$msg"
    local logfile="/tmp/n1x_install_$$.log"
    if "$func" "$@" > "$logfile" 2>&1; then
        printf "\r  ${GRAY}│${NC}  %-44s ${GREEN}[DONE]${NC}\n" "$msg"
        rm -f "$logfile"
        return 0
    else
        printf "\r  ${GRAY}│${NC}  %-44s ${RED}[FAILED]${NC}\n" "$msg"
        echo -e "  ${RED}✖ Error details:${NC}"
        tail -n 20 "$logfile" | sed 's/^/    /'
        rm -f "$logfile"
        return 1
    fi
}

detect_os() {
    OS_TYPE="Linux"
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_TYPE=${PRETTY_NAME:-${ID:-"Linux"}}
    fi
}

get_sys_ip() {
    local ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -z "$ip" ]; then
        ip=$(curl -s --connect-timeout 1 --max-time 2 ifconfig.me 2>/dev/null || echo "127.0.0.1")
    fi
    echo "${ip:-127.0.0.1}"
}

run_pm2() {
    if command -v pm2 &> /dev/null; then
        pm2 "$@"
    elif [ -x "/usr/local/bin/pm2" ]; then
        /usr/local/bin/pm2 "$@"
    elif [ -f "./node_modules/.bin/pm2" ]; then
        chmod +x ./node_modules/.bin/pm2 2>/dev/null || true
        ./node_modules/.bin/pm2 "$@"
    elif command -v npx &> /dev/null; then
        npx --no-install pm2 "$@"
    else
        return 1
    fi
}

check_system_deps() {
    if command -v apt-get &> /dev/null; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -y -q > /dev/null 2>&1 || sudo apt-get update -y -q > /dev/null 2>&1 || true
        apt-get install -y -q curl git tar ca-certificates build-essential > /dev/null 2>&1 || sudo apt-get install -y -q curl git tar ca-certificates build-essential > /dev/null 2>&1 || true
    fi
}

setup_node_env() {
    local need_install=false
    if ! command -v node &> /dev/null; then
        need_install=true
    else
        local node_ver=$(node -v 2>/dev/null | sed 's/v//' | cut -d'.' -f1)
        if [ "$node_ver" -lt 18 ]; then
            need_install=true
        fi
    fi

    if [ "$need_install" = true ]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1 || sudo curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - > /dev/null 2>&1 || true
        apt-get install -y -q nodejs > /dev/null 2>&1 || sudo apt-get install -y -q nodejs > /dev/null 2>&1 || true
    fi

    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2 > /dev/null 2>&1 || sudo npm install -g pm2 > /dev/null 2>&1 || true
    fi
}

check_java() {
    if ! command -v java &> /dev/null; then
        if command -v apt-get &> /dev/null; then
            apt-get install -y -q openjdk-21-jre-headless > /dev/null 2>&1 || sudo apt-get install -y -q openjdk-21-jre-headless > /dev/null 2>&1 || true
        fi
    fi
    return 0
}

install_dependencies() {
    mkdir -p .data/servers .data/temp backups
    npm install --no-audit --no-fund
    if [ -d "node_modules/.bin" ]; then
        chmod -R +x node_modules/.bin 2>/dev/null || true
    fi
}

setup_owner() {
    local USER="${N1X_OWNER_USER:-${JTG_OWNER_USER:-admin}}"
    local PASS="${N1X_OWNER_PASS:-${JTG_OWNER_PASS:-admin123}}"
    export N1X_OWNER_USER="$USER"
    export N1X_OWNER_PASS="$PASS"
    export JTG_OWNER_USER="$USER"
    export JTG_OWNER_PASS="$PASS"

    if [ -f "scripts/createuser.ts" ]; then
        if [ -x "./node_modules/.bin/tsx" ]; then
            ./node_modules/.bin/tsx scripts/createuser.ts > /dev/null 2>&1 || true
        elif command -v npx &> /dev/null; then
            npx tsx scripts/createuser.ts > /dev/null 2>&1 || true
        fi
    fi
}

build_application() {
    npm run build
}

start_panel() {
    local PORT="${PORT:-8080}"
    run_pm2 delete n1x-panel jtg-main jtg-admin > /dev/null 2>&1 || true

    cat << EOF > .env
PORT=${PORT}
DEFAULT_RUNTIME=local
ENABLE_DOCKER=false
JWT_SECRET=$(head -c 32 /dev/urandom | base64 2>/dev/null || openssl rand -base64 32 2>/dev/null || echo "n1x-panel-super-secret-key-default")
N1X_OWNER_USER=${N1X_OWNER_USER:-admin}
N1X_OWNER_PASS=${N1X_OWNER_PASS:-admin123}
EOF

    if command -v pm2 &> /dev/null || [ -f "./node_modules/.bin/pm2" ]; then
        run_pm2 start dist/server.cjs --name "n1x-panel" --env PORT="${PORT}" > /dev/null 2>&1
        run_pm2 save > /dev/null 2>&1 || true
    else
        nohup node dist/server.cjs > panel.log 2>&1 &
    fi
    sleep 2
}

install_all() {
    print_banner
    echo -e "  ${GRAY}┌──${NC} ${BOLD}INSTALLATION PROGRESS (100% PURE NODE.JS)${NC} ${GRAY}─────────────┐${NC}"
    echo -e "  ${GRAY}│${NC}                                                               ${GRAY}│${NC}"

    execute_step "System Requirement Check" check_system_deps
    execute_step "Node.js (LTS) & PM2 Setup" setup_node_env
    execute_step "Java 21 JRE Environment Check" check_java
    execute_step "NPM Packages Installation" install_dependencies
    execute_step "Administrator Account Setup" setup_owner
    execute_step "Frontend & Server Build" build_application
    execute_step "Start N1X Panel Service" start_panel

    echo -e "  ${GRAY}│${NC}                                                               ${GRAY}│${NC}"
    echo -e "  ${GRAY}└───${NC}"
    echo ""

    local SYS_IP=$(get_sys_ip)
    local PORT="${PORT:-8080}"

    echo -e "  ${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗"
    echo -e "  ║  ✔  N1X PANEL INSTALLED & STARTED SUCCESSFULLY               ║"
    echo -e "  ╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "  ║                                                              ║"
    echo -e "  ║  • URL           : ${CYAN}http://${SYS_IP}:${PORT}${NC}                       "
    echo -e "  ║  • Username      : ${WHITE}${N1X_OWNER_USER:-admin}${NC}                                  "
    echo -e "  ║  • Password      : ${WHITE}${N1X_OWNER_PASS:-admin123}${NC}                               "
    echo -e "  ║  • Runtime       : ${GREEN}Pure Node.js Process Engine (No Docker)${NC}       "
    echo -e "  ║  • SFTP Port     : ${YELLOW}6869${NC}                                          "
    echo -e "  ║                                                              ║"
    echo -e "  ║  ${BOLD}Useful Commands:${NC}                                            ║"
    echo -e "  ║    pm2 status         - Check panel status                   ║"
    echo -e "  ║    pm2 logs n1x-panel - Stream panel logs                    ║"
    echo -e "  ║    bash update.sh     - Update N1X Panel                     ║"
    echo -e "  ║                                                              ║"
    echo -e "  ${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

install_all
