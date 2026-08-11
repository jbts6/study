import { startRunnerServer } from "./node-server.ts";

const DEFAULT_PORT = 5175;

function parsePort(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const port = Number(value);
  if (port < 0 || port > 65535) return undefined;
  return port;
}

async function main(): Promise<void> {
  let port = DEFAULT_PORT;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--port") {
      const raw = process.argv[i + 1];
      if (raw === undefined) {
        process.stderr.write("缺少 --port 参数值\n");
        process.exit(2);
      }
      const parsed = parsePort(raw);
      if (parsed === undefined) {
        process.stderr.write(`无效端口参数: ${raw}\n`);
        process.exit(2);
      }
      port = parsed;
      i++;
    }
  }
  const server = await startRunnerServer(port);
  process.stdout.write(JSON.stringify({ type: "runner_ready", port: server.port }) + "\n");
  let closed = false;
  const shutdown = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await server.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err: unknown) => {
  process.stderr.write(`Runner 启动失败: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
