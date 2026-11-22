#!/bin/bash
# =========================================================
# N1X Panel - Automated Update & Recovery Script
# 100% Pure Node.js Runtime (No Docker Required)
# =========================================================

if [ -z "$BASH_VERSION" ]; then
    if command -v bash > /dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
fi

set -o pipefail

GREEN='\033[38;5;48m'
EMERALD='\033[38;5;42m'
CYAN='\033[38;5;51m'
YELLOW='\033[38;5;220m'
RED='\033[38;5;196m'
WHITE='\033[1;37m'
GRAY='\033[38;5;242m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
    clear 2>/dev/null || true
    echo -e "
  ${CYAN}${BOLD}╭──────────────────────────────────────────────────────────────╮
  │  ${WHITE}███╗   ██╗ ██╗██╗  ██╗${CYAN}   ${BOLD}${WHITE}N1X PANEL UPDATER${CYAN}                 │
  │  ${WHITE}████╗  ██║███║╚██╗██╔╝${CYAN}   ${EMERALD}Safe Node.js Update & Rebuild${CYAN}         │
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
    local logfile="/tmp/n1x_update_$$.log"
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

pull_git_updates() {
    if [ -d ".git" ]; then
        git fetch --all --prune > /dev/null 2>&1 || true
        git pull --rebase > /dev/null 2>&1 || git pull > /dev/null 2>&1 || true
    fi
    return 0
}

update_dependencies() {
    mkdir -p .data/servers .data/temp backups
    npm install --no-audit --no-fund
    if [ -d "node_modules/.bin" ]; then
        chmod -R +x node_modules/.bin 2>/dev/null || true
    fi
}

build_app() {
    npm run build
}

restart_service() {
    if run_pm2 describe n1x-panel > /dev/null 2>&1; then
        run_pm2 restart n1x-panel > /dev/null 2>&1
    elif run_pm2 describe jtg-main > /dev/null 2>&1; then
        run_pm2 restart jtg-main > /dev/null 2>&1
    else
        local PORT="${PORT:-8080}"
        run_pm2 start dist/server.cjs --name "n1x-panel" --env PORT="${PORT}" > /dev/null 2>&1 || {
            pkill -f "dist/server.cjs" > /dev/null 2>&1 || true
            nohup node dist/server.cjs > panel.log 2>&1 &
        }
    fi
    sleep 2
}

run_update() {
    print_banner
    echo -e "  ${GRAY}┌──${NC} ${BOLD}N1X PANEL UPDATE PROGRESS${NC} ${GRAY}─────────────────────────────┐${NC}"
    echo -e "  ${GRAY}│${NC}                                                               ${GRAY}│${NC}"

    execute_step "Pulling Latest Source Changes" pull_git_updates
    execute_step "Updating NPM Packages" update_dependencies
    execute_step "Building Production Bundle" build_app
    execute_step "Restarting N1X Panel Service" restart_service

    echo -e "  ${GRAY}│${NC}                                                               ${GRAY}│${NC}"
    echo -e "  ${GRAY}└───${NC}"
    echo ""

    echo -e "  ${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗"
    echo -e "  ║  ✔  N1X PANEL UPDATED SUCCESSFULLY                          ║"
    echo -e "  ╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "  ║  • Engine    : Node.js Process Engine (100% Docker-Free)     ║"
    echo -e "  ║  • Service   : Restarted via PM2                             ║"
    echo -e "  ${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

run_update
