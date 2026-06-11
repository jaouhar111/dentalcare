// OpenWA gateway helper — start/stop the self-hosted WhatsApp Web bridge
// that powers the AI-receptionist QR onboarding (see lib/whatsapp/client.ts).
//
// The gateway lives in the sibling repo ../OpenWA as a Docker service named
// `openwa` (container `openwa-api`, port 127.0.0.1:2785). The #1 footgun in
// dev is forgetting that Docker Desktop itself isn't running, so `up` will
// launch it and wait for the daemon before composing the container.
//
// Usage (via pnpm):
//   pnpm openwa:up      # ensure Docker is up, then start the gateway (default)
//   pnpm openwa:down    # stop the gateway container
//   pnpm openwa:logs    # follow the gateway logs
//   pnpm openwa:status  # show container state + port check

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { platform } from "node:os";

const COMPOSE_FILE = "docker-compose.dev.yml";
const SERVICE = "openwa";
const CONTAINER = "openwa-api";
const PORT = 2785;

// ../OpenWA relative to this project's root (pnpm sets cwd = package dir).
const OPENWA_DIR = resolve(process.cwd(), "..", "OpenWA");

const cmd = (process.argv[2] ?? "up").toLowerCase();

function run(file, args, opts = {}) {
  return spawnSync(file, args, { stdio: "inherit", shell: false, ...opts });
}

function dockerOk() {
  const r = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    stdio: "ignore",
    shell: false,
  });
  return r.status === 0;
}

function startDockerDesktop() {
  if (platform() !== "win32") {
    console.error(
      "✖ Docker daemon is not running. Start Docker (or Docker Desktop) and retry.",
    );
    process.exit(1);
  }
  const candidates = [
    `${process.env.ProgramFiles}\\Docker\\Docker\\Docker Desktop.exe`,
    `${process.env.LOCALAPPDATA}\\Docker\\Docker Desktop.exe`,
  ].filter((p) => p && existsSync(p));
  if (candidates.length === 0) {
    console.error("✖ Docker Desktop is not running and the .exe was not found.");
    process.exit(1);
  }
  console.log("▸ Docker daemon not ready — launching Docker Desktop…");
  // `start "" "<exe>"` detaches so we don't block on the GUI process.
  spawnSync("cmd", ["/c", "start", "", candidates[0]], { stdio: "ignore" });
}

async function waitForDocker(timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (dockerOk()) return true;
    await new Promise((r) => setTimeout(r, 4000));
    process.stdout.write(".");
  }
  return false;
}

function compose(args) {
  if (!existsSync(resolve(OPENWA_DIR, COMPOSE_FILE))) {
    console.error(`✖ Not found: ${resolve(OPENWA_DIR, COMPOSE_FILE)}`);
    console.error("  The OpenWA gateway repo must sit next to this project (../OpenWA).");
    process.exit(1);
  }
  return run("docker", ["compose", "-f", COMPOSE_FILE, ...args], { cwd: OPENWA_DIR });
}

async function ensureDocker() {
  if (dockerOk()) return;
  startDockerDesktop();
  const ok = await waitForDocker();
  console.log("");
  if (!ok) {
    console.error("✖ Docker daemon still not ready after waiting. Open Docker Desktop manually.");
    process.exit(1);
  }
  console.log("✓ Docker daemon ready.");
}

async function main() {
  switch (cmd) {
    case "up": {
      await ensureDocker();
      console.log("▸ Starting OpenWA gateway…");
      const r = compose(["up", "-d", SERVICE]);
      if (r.status !== 0) process.exit(r.status ?? 1);
      console.log(`✓ OpenWA up on http://127.0.0.1:${PORT} (container ${CONTAINER}).`);
      console.log("  Open /settings/ai-receptionist and scan the QR.");
      break;
    }
    case "down": {
      if (!dockerOk()) {
        console.log("Docker isn't running — nothing to stop.");
        return;
      }
      compose(["stop", SERVICE]);
      break;
    }
    case "logs": {
      await ensureDocker();
      compose(["logs", "-f", SERVICE]);
      break;
    }
    case "status": {
      if (!dockerOk()) {
        console.log("Docker daemon: ✖ not running");
        return;
      }
      console.log("Docker daemon: ✓ running");
      run("docker", [
        "ps",
        "--filter",
        `name=${CONTAINER}`,
        "--format",
        "{{.Names}} | {{.Status}} | {{.Ports}}",
      ]);
      break;
    }
    default:
      console.error(`Unknown command "${cmd}". Use: up | down | logs | status`);
      process.exit(1);
  }
}

main();
