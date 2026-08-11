import { WebSocketServer, WebSocket } from "ws";
import { PythonRunnerAdapter } from "./adapter";
import { PythonBridge } from "./python-bridge";
import { detectPython } from "./python-detector";
import type { RunRequest } from "../protocol/types";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const daemonScript = path.join(__dirname, "../python/runtime/daemon.py");

export interface ServerHandle {
  readonly port: number;
  close(): Promise<void>;
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
    wss.on("error", reject);
    wss.on("listening", () => {
      const addr = wss.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        get port() {
          return actualPort;
        },
        close: () =>
          new Promise<void>((res) => {
            wss.close(() => res());
          }),
      });
    });

    wss.on("connection", (ws, req) => {
      const origin = req.headers.origin;
      if (origin && !origin.includes("127.0.0.1") && !origin.includes("localhost")) {
        ws.close(1008, "Forbidden origin");
        return;
      }

      const adapter = new PythonRunnerAdapter({
        createChannel: () => new PythonBridge({ pythonPath: detection.path, daemonScript }),
      });

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
          }
        } catch {
          /* ignore malformed messages */
        }
      });

      ws.on("close", () => {
        adapter.dispose();
      });
    });
  });
}
