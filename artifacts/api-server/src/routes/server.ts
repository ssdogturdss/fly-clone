import { Router, type IRouter } from "express";
import { spawn, type ChildProcess } from "child_process";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MAX_LOG_LINES = 500;
const logBuffer: string[] = [];
let devProcess: ChildProcess | null = null;
let startTime: number | null = null;

function appendLog(line: string) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
}

function isRunning(): boolean {
  return devProcess !== null && devProcess.exitCode === null;
}

function startDevServer() {
  if (isRunning()) return;
  appendLog("[control] Starting dev server...");
  devProcess = spawn("pnpm", ["--filter", "@workspace/pwa", "run", "dev"], {
    shell: true,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  startTime = Date.now();

  devProcess.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l) => l.trim());
    lines.forEach((l) => appendLog(l));
  });

  devProcess.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l) => l.trim());
    lines.forEach((l) => appendLog(`[err] ${l}`));
  });

  devProcess.on("exit", (code) => {
    appendLog(`[control] Dev server exited with code ${code}`);
    devProcess = null;
    startTime = null;
  });

  logger.info("Dev server process started");
}

function stopDevServer() {
  if (!isRunning() || !devProcess) return;
  appendLog("[control] Stopping dev server...");
  devProcess.kill("SIGTERM");
  devProcess = null;
  startTime = null;
}

router.get("/server/status", (_req, res) => {
  const running = isRunning();
  const uptime = running && startTime ? (Date.now() - startTime) / 1000 : null;
  res.json({
    running,
    pid: devProcess?.pid ?? null,
    uptime,
    recentLogs: logBuffer.slice(-50),
  });
});

router.post("/server/start", (_req, res) => {
  if (isRunning()) {
    res.json({ success: false, message: "Server is already running" });
    return;
  }
  startDevServer();
  res.json({ success: true, message: "Server started" });
});

router.post("/server/stop", (_req, res) => {
  if (!isRunning()) {
    res.json({ success: false, message: "Server is not running" });
    return;
  }
  stopDevServer();
  res.json({ success: true, message: "Server stopped" });
});

router.post("/server/restart", (_req, res) => {
  stopDevServer();
  setTimeout(() => startDevServer(), 500);
  res.json({ success: true, message: "Server restarting..." });
});

router.get("/server/logs", (req, res) => {
  const lines = Math.min(parseInt((req.query.lines as string) ?? "100", 10), MAX_LOG_LINES);
  const result = logBuffer.slice(-lines);
  res.json({ lines: result, total: logBuffer.length });
});

export default router;
