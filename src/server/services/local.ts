import fs from "fs-extra";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import { panelEvents } from "../events.js";
import { parseRam } from "../../utils/ram.js";

const execAsync = promisify(exec);
const processes = new Map<string, ChildProcess>();
const localStartedAt = new Map<string, string>();
const activeStreams = new Set<string>();

export const createLocalServer = async (serverData: any) => {
  const serverPath = path.join(process.cwd(), ".data", "servers", serverData.id);
  await fs.ensureDir(serverPath);

  const type = (serverData.type || "nodejs").toLowerCase();

  if (type === "python" || type === "python3") {
    const mainPath = path.join(serverPath, "main.py");
    const reqPath = path.join(serverPath, "requirements.txt");
    if (!await fs.pathExists(mainPath)) {
      await fs.writeFile(mainPath, `# Python Application on N1X Panel\nimport os\nimport sys\nfrom http.server import HTTPServer, BaseHTTPRequestHandler\n\nport = int(os.environ.get("SERVER_PORT", os.environ.get("PORT", ${serverData.port || 8000})))\nprint("==============================================", flush=True)\nprint("🐍 Python Application Running", flush=True)\nprint(f"Python Version: {sys.version}", flush=True)\nprint(f"Listening Port: {port}", flush=True)\nprint("Upload your files in File Manager to customize!", flush=True)\nprint("==============================================", flush=True)\n\nclass RequestHandler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.send_header('Content-type', 'application/json')\n        self.end_headers()\n        self.wfile.write(b'{"status": "online", "runtime": "python"}')\n\n    def log_message(self, format, *args):\n        print(f"[{self.log_date_time_string()}] {format % args}", flush=True)\n\nserver = HTTPServer(('0.0.0.0', port), RequestHandler)\nprint(f"[Server] Listening on http://0.0.0.0:{port}", flush=True)\ntry:\n    server.serve_forever()\nexcept KeyboardInterrupt:\n    print("\\nStopping server...", flush=True)\n    server.server_close()\n`);
    }
    if (!await fs.pathExists(reqPath)) {
      await fs.writeFile(reqPath, "# Add python dependencies here\n");
    }
  } else {
    const indexPath = path.join(serverPath, "index.js");
    const pkgPath = path.join(serverPath, "package.json");
    if (!await fs.pathExists(indexPath)) {
      await fs.writeFile(indexPath, `// Node.js Application on N1X Panel\nconst http = require('http');\nconst port = process.env.PORT || process.env.SERVER_PORT || ${serverData.port || 3000};\n\nconsole.log('==============================================');\nconsole.log('🚀 Node.js Application Running on port ' + port);\nconsole.log('Node Version: ' + process.version);\nconsole.log('Upload your files in File Manager to customize!');\nconsole.log('==============================================');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ status: 'online', runtime: 'node.js', time: new Date().toISOString() }));\n});\n\nserver.listen(port, '0.0.0.0', () => {\n  console.log(\`[Server] Listening on http://0.0.0.0:\${port}\`);\n});\n`);
    }
    if (!await fs.pathExists(pkgPath)) {
      await fs.writeFile(pkgPath, JSON.stringify({
        name: (serverData.name || "node-app").toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        version: "1.0.0",
        description: "Node.js application hosted on N1X Panel",
        main: "index.js",
        scripts: { "start": "node index.js" }
      }, null, 2));
    }
  }

  return `local-${serverData.id}`;
};


export const startLocalServer = async (id: string, serverData: any) => {
  if (processes.has(id)) {
    await stopLocalServer(id);
    await new Promise(r => setTimeout(r, 600));
  }

  const serverPath = path.join(process.cwd(), ".data", "servers", id);
  await fs.ensureDir(serverPath);
  const type = (serverData.type || "paper").toLowerCase();

  const logPath = path.join(serverPath, "panel.log");
  try {
    await fs.writeFile(logPath, "");
  } catch (e) {}
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });

  const emitLog = (msg: string) => {
    panelEvents.emit("log", id, msg);
  };

  const logMessage = (msg: string) => {
    const formatted = `[Panel] ${msg}\n`;
    if (logStream.writable) {
      logStream.write(formatted);
    }
    emitLog(formatted);
  };

  let child: any;

  if (type === "nodejs" || type === "node") {
    const pkgPath = path.join(serverPath, "package.json");
    if (await fs.pathExists(pkgPath)) {
      try {
        const pkg = await fs.readJson(pkgPath);
        if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
          const nmPath = path.join(serverPath, "node_modules");
          if (!await fs.pathExists(nmPath)) {
            logMessage("Installing Node.js dependencies...");
            await execAsync("npm install --no-audit --no-fund --omit=dev", { cwd: serverPath }).catch(e => logMessage(`[npm notice] ${e.message}`));
            logMessage("Node.js dependencies installed successfully.");
          }
        }
      } catch (pkgErr: any) {
        logMessage(`[npm notice] ${pkgErr.message}`);
      }
    }

    let entry = "index.js";
    for (const testFile of ["index.js", "app.js", "server.js", "main.js", "bot.js"]) {
      if (await fs.pathExists(path.join(serverPath, testFile))) {
        entry = testFile;
        break;
      }
    }
    const parsedRam = parseRam(serverData.ram);
    child = spawn("node", [entry], {
      cwd: serverPath,
      env: {
        ...process.env,
        PORT: String(serverData.port || 3000),
        SERVER_PORT: String(serverData.port || 3000),
        NODE_OPTIONS: `--max-old-space-size=${parsedRam.mb}`,
        RAM_LIMIT_MB: String(parsedRam.mb),
        CPU_LIMIT: String(serverData.cpu || 100),
        NODE_ENV: "production"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
  } else if (type === "python" || type === "python3") {
    const reqPath = path.join(serverPath, "requirements.txt");
    if (await fs.pathExists(reqPath)) {
      try {
        const reqContent = await fs.readFile(reqPath, "utf8");
        const lines = reqContent.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
        if (lines.length > 0) {
          logMessage("Installing Python requirements from requirements.txt...");
          const pipCmd = process.platform === "win32" ? "pip" : "pip3";
          await execAsync(`${pipCmd} install -r requirements.txt`, { cwd: serverPath }).catch(e => logMessage(`[pip notice] ${e.message}`));
          logMessage("Python requirements installed.");
        }
      } catch (reqErr: any) {
        logMessage(`[pip notice] ${reqErr.message}`);
      }
    }

    let entry = "main.py";
    for (const testFile of ["main.py", "app.py", "bot.py", "index.py", "server.py"]) {
      if (await fs.pathExists(path.join(serverPath, testFile))) {
        entry = testFile;
        break;
      }
    }
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const parsedRam = parseRam(serverData.ram);
    child = spawn(pythonCmd, ["-u", entry], {
      cwd: serverPath,
      env: {
        ...process.env,
        PORT: String(serverData.port || 8000),
        SERVER_PORT: String(serverData.port || 8000),
        RAM_LIMIT_MB: String(parsedRam.mb),
        CPU_LIMIT: String(serverData.cpu || 100),
        PYTHONUNBUFFERED: "1"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
  } else {
    // Custom startup command or fallback to Node.js
    const parsedRam = parseRam(serverData.ram);
    if (serverData.startupCommand && serverData.startupCommand.trim()) {
      const parts = serverData.startupCommand.trim().split(/\s+/);
      const bin = parts[0];
      const args = parts.slice(1);
      child = spawn(bin, args, {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: String(serverData.port || 3000),
          SERVER_PORT: String(serverData.port || 3000),
          RAM_LIMIT_MB: String(parsedRam.mb),
          CPU_LIMIT: String(serverData.cpu || 100),
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
    } else {
      let entry = "index.js";
      for (const testFile of ["index.js", "app.js", "server.js", "main.js", "bot.js"]) {
        if (await fs.pathExists(path.join(serverPath, testFile))) {
          entry = testFile;
          break;
        }
      }
      child = spawn("node", [entry], {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: String(serverData.port || 3000),
          SERVER_PORT: String(serverData.port || 3000),
          NODE_OPTIONS: `--max-old-space-size=${parsedRam.mb}`,
          RAM_LIMIT_MB: String(parsedRam.mb),
          CPU_LIMIT: String(serverData.cpu || 100),
          NODE_ENV: "production"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
    }
  }

  processes.set(id, child);

  child.on("spawn", () => {
    localStartedAt.set(id, new Date().toISOString());
    logMessage(`Server process started with PID ${child.pid} for ${serverData.name || id} (${type})`);
  });

  child.on("error", (err: Error) => {
    localStartedAt.delete(id);
    logMessage(`Failed to start server process: ${err.message}`);
    if (err.message.includes("ENOENT")) {
        logMessage("---- RUNTIME NOTICE ----");
        logMessage(`Required executable or binary is missing or not in PATH for runtime (${type})!`);
        logMessage("If running Minecraft with the Node.js / Local Process runtime on a Linux VPS, ensure OpenJDK 21 is installed:");
        logMessage("  sudo apt update && sudo apt install -y openjdk-21-jre-headless");
        logMessage("------------------------");
    }
  });

  child.on("close", (code: number | null) => {
    logMessage(`Server process exited with code ${code}`);
    processes.delete(id);
    localStartedAt.delete(id);
    activeStreams.delete(id);
  });

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (logStream.writable) logStream.write(text);
    emitLog(text);
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (logStream.writable) logStream.write(text);
    emitLog(text);
  });

  // Verify process does not immediately crash on startup
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const errorHandler = (err: Error) => {
      if (!settled) {
        settled = true;
        processes.delete(id);
        localStartedAt.delete(id);
        reject(new Error(`Server failed to start: ${err.message}`));
      }
    };
    const exitHandler = (code: number | null) => {
      if (!settled && code !== 0 && code !== null) {
        settled = true;
        processes.delete(id);
        localStartedAt.delete(id);
        reject(new Error(`Server process exited immediately with code ${code}`));
      }
    };
    child.once("error", errorHandler);
    child.once("close", exitHandler);

    setTimeout(() => {
      if (!settled) {
        settled = true;
        child.removeListener("error", errorHandler);
        child.removeListener("close", exitHandler);
        resolve();
      }
    }, 450);
  });
};


export const stopLocalServer = async (id: string): Promise<boolean> => {
  localStartedAt.delete(id);
  const child = processes.get(id);
  if (!child) return true;

  if (child.stdin && child.stdin.writable) {
    try {
      child.stdin.write("stop\nend\nexit\n");
    } catch (e) {}
  }
  try {
    child.kill("SIGTERM");
  } catch (e) {}

  const start = Date.now();
  while (processes.has(id) && Date.now() - start < 4000) {
    await new Promise(r => setTimeout(r, 100));
  }

  if (processes.has(id)) {
    if (process.platform === "win32" && child.pid) {
      await execAsync(`taskkill /pid ${child.pid} /T /F`).catch(() => {});
    }
    try {
      child.kill("SIGKILL");
    } catch (e) {}
    processes.delete(id);
  }

  activeStreams.delete(id);
  return true;
};

export const killLocalServer = async (id: string): Promise<void> => {
  localStartedAt.delete(id);
  const child = processes.get(id);
  if (child) {
    if (process.platform === "win32" && child.pid) {
      await execAsync(`taskkill /pid ${child.pid} /T /F`).catch(() => {});
    }
    try {
      child.kill("SIGKILL");
    } catch (e) {}
    processes.delete(id);
    activeStreams.delete(id);
    panelEvents.emit("log", id, `[Panel] Process forcefully killed (SIGKILL).\n`);
  }
};

export const restartLocalServer = async (id: string, serverData: any): Promise<void> => {
  await stopLocalServer(id);
  if (processes.has(id)) {
    // If still in map, force delete
    processes.delete(id);
  }
  // Allow brief cooldown for operating system socket release
  await new Promise(r => setTimeout(r, 800));
  await startLocalServer(id, serverData);
  const status = await getLocalServerStatus(id);
  if (!status.State.Running) {
    throw new Error("Server process failed to start during restart.");
  }
};

export const deleteLocalServer = async (id: string) => {
  await stopLocalServer(id);
  localStartedAt.delete(id);
  const serverPath = path.join(process.cwd(), ".data", "servers", id);
  await fs.remove(serverPath);
};

export const getLocalServerStatus = async (id: string) => {
  const isRunning = processes.has(id);
  return {
    State: {
      Running: isRunning,
      Status: isRunning ? "running" : "exited",
      StartedAt: isRunning ? localStartedAt.get(id) || null : null
    }
  };
};

export const getLocalServerStats = async (id: string) => {
  const child = processes.get(id);
  if (!child || !child.pid || !processes.has(id)) {
    return { cpu: 0, ram: 0, disk: 0 };
  }

  let cpu = 0;
  let ram = 0;
  let disk = 0;

  try {
    const { stdout } = await execAsync(`ps -p ${child.pid} -o %cpu,rss`);
    const lines = stdout.trim().split("\n");
    if (lines.length > 1) {
      const parts = lines[1].trim().split(/\s+/);
      cpu = parseFloat(parts[0]) || 0;
      const rssKb = parseInt(parts[1]) || 0;
      ram = Math.round((rssKb / 1024) * 10) / 10;
    }
  } catch (e) {}

  try {
    const serverPath = path.join(process.cwd(), ".data", "servers", id);
    const { stdout } = await execAsync(`du -sm "${serverPath}"`);
    const parts = stdout.trim().split(/\s+/);
    const diskMB = parseInt(parts[0]) || 0;
    disk = Math.round((diskMB / 1024) * 100) / 100;
  } catch (e) {
    disk = 0.05;
  }

  return {
    cpu,
    ram,
    disk
  };
};

export const getLocalServerLogs = async (id: string) => {
  const logPath = path.join(process.cwd(), ".data", "servers", id, "panel.log");
  if (await fs.pathExists(logPath)) {
    const logs = await fs.readFile(logPath, "utf8");
    return logs.split("\n").slice(-100).join("\n");
  }
  return "";
};

export const attachLocalServerSocket = (id: string, serverId: string) => {
  // handled natively by startLocalServer now to capture all output reliably
};

export const sendLocalServerCommand = async (id: string, command: string) => {
  const child = processes.get(id);
  if (child && child.stdin) {
    child.stdin.write(command + "\n");
  }
};

export const getLocalProcessInfo = (id: string) => {
  const child = processes.get(id);
  const serverPath = path.join(process.cwd(), ".data", "servers", id);
  if (child) {
    return {
      pid: child.pid,
      jarPath: path.join(serverPath, "server.jar"),
      logPath: path.join(serverPath, "panel.log")
    };
  }
  return null;
};
