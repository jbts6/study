import { WebSocketServer, WebSocket } from "ws";
import { PythonRunnerAdapter } from "./adapter.ts";
import { PythonBridge } from "./python-bridge.ts";
import { detectPython } from "./python-detector.ts";
import type { RunRequest } from "../protocol/types.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const daemonScript = path.join(moduleDir, "../python/runtime/daemon.py");
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const CLOSE_GRACE_MS = 500;

export interface ServerHandle {
  readonly port: number;
  close(): Promise<void>;
}

export function isLoopbackOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname;
  const normalized = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return LOOPBACK_HOSTS.has(normalized);
}

function originAllowed(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  if (origin === "null") return false;
  return isLoopbackOrigin(origin);
}

export async function startRunnerServer(port: number): Promise<ServerHandle> {
  const detection = await detectPython();
  if (!detection.ok) {
    throw new Error(`Python not available: ${detection.message}`);
  }
  return startRunnerServerWithDetection(port, detection);
}

export function startRunnerServerWithDetection(
  port: number,
  detection: { ok: true; path: string },
): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ host: "127.0.0.1", port });
    const adapters = new Map<WebSocket, PythonRunnerAdapter>();
    let closePromise: Promise<void> | undefined;

    const disposeSocket = async (ws: WebSocket, adapter: PythonRunnerAdapter): Promise<void> => {
      try {
        await adapter.dispose();
      } catch {
        /* ignore */
      }
      if (ws.readyState === WebSocket.OPEN) {
        await new Promise<void>((res) => {
          const timer = setTimeout(() => { ws.terminate(); res(); }, CLOSE_GRACE_MS);
          ws.close(1001);
          ws.on("close", () => { clearTimeout(timer); res(); });
        });
      }
    };

    const close = (): Promise<void> => {
      if (closePromise) return closePromise;
      closePromise = (async () => {
        wss.removeAllListeners("connection");
        wss.removeAllListeners("error");
        const sockets = [...adapters.keys()];
        await Promise.all(
          sockets.map((ws) => {
            const adapter = adapters.get(ws);
            return adapter ? disposeSocket(ws, adapter) : Promise.resolve();
          }),
        );
        await new Promise<void>((res) => wss.close(() => res()));
      })();
      return closePromise;
    };

    wss.on("error", reject);
    wss.on("listening", () => {
      const addr = wss.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        get port() {
          return actualPort;
        },
        close,
      });
    });

    wss.on("connection", (ws, req) => {
      const origin = req.headers.origin;
      if (!originAllowed(origin)) {
        ws.close(1008, "Forbidden origin");
        return;
      }
      const adapter = new PythonRunnerAdapter({
        createChannel: () => new PythonBridge({ pythonPath: detection.path, daemonScript }),
      });
      adapters.set(ws, adapter);

      adapter.onStateChange((state) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "state", state }));
        }
      });

      ws.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            type: string;
            request?: RunRequest;
            runId?: string;
          };
          if (msg.type === "run" && msg.request) {
            const result = await adapter.run(msg.request);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "run_result", result }));
            }
          } else if (msg.type === "interrupt" && msg.runId) {
            await adapter.interrupt(msg.runId);
          } else if (msg.type === "subscribe_state") {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "state", state: adapter.state }));
            }
          } else if (msg.type === "dispose") {
            await disposeSocket(ws, adapter);
            adapters.delete(ws);
          } else {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "protocol_error", error: "unknown message type" }));
            }
          }
        } catch (err) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "protocol_error", error: err instanceof Error ? err.message : "unknown" }));
          }
        }
      });

      const cleanup = (): void => {
        adapters.delete(ws);
        void adapter.dispose();
      };
      ws.on("close", cleanup);
      ws.on("error", cleanup);
    });
  });
}
