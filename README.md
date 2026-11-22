# N1X Panel

Lightweight, modern Game & Application Server Management Panel built on 100% pure Node.js (No Docker Required).

## Features
- **Pure Node.js Runtime**: Completely Docker-free. High performance native process management.
- **Custom RAM & CPU Allocation**: Allocate custom RAM (e.g. `256 MB`, `512 MB`, `1 GB`, `4 GB`) and custom CPU Limits (e.g. `25%`, `50%`, `100%`, `200%`).
- **Same-Port Local Hosting**: Bound servers host directly on their exact assigned ports locally.
- **Multi-Workload Support**: Minecraft (Paper, Spigot, Fabric, Forge, Velocity, BungeeCord), Node.js applications & Discord bots, and Python scripts with automatic `requirements.txt` installation.
- **Built-in File Manager & SFTP**: Full file management with chunked uploads and SFTP access.
- **Server Control**: One-click start, clean stop, instant restart with socket cooldown, and safe server deletion.

## Quick Automated Setup

```bash
bash install.sh
```

## Manual Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Setup admin user:
   ```bash
   npm run createuser
   ```

4. Start the server (Port 8080):
   ```bash
   npm run start
   ```

## Managing Background Service (PM2)

```bash
pm2 status
pm2 logs n1x-panel
pm2 restart n1x-panel
```

## Updating N1X Panel

```bash
bash update.sh
```
