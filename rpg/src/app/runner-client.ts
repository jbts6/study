import type { RunRequest, RunResult, RunnerState } from "../runners/protocol/types";

export type RunnerDisplayState = "connecting" | "ready" | "running" | "unavailable";

export interface RunnerClient {
  readonly state: RunnerDisplayState;
  connect(): Promise<void>;
  run(request: RunRequest): Promise<RunResult>;
  interrupt(runId: string): void;
  onStateChange(listener: (state: RunnerDisplayState) => void): () => void;
  close(): void;
}
type ActiveRun = Readonly<{
  runId: string;
  resolve: (result: RunResult) => void;
  reject: (error: Error) => void;
}>;

const UNAVAILABLE_MESSAGE = "本地 Python Runner 不可用。启动 Runner 后刷新页面。";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function displayState(state: RunnerState): RunnerDisplayState {
  if (state === "ready") return "ready";
  if (state === "running" || state === "interrupting") return "running";
  if (state === "unavailable") return "unavailable";
  return "connecting";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toError(value: unknown, fallback = UNAVAILABLE_MESSAGE): Error {
  if (value instanceof Error) return value;
  return isRecord(value) && typeof value.message === "string" ? new Error(value.message) : new Error(fallback);
}

function parseLoopbackWebSocketUrl(value: string): URL {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (url.protocol === "ws:" && LOOPBACK_HOSTS.has(hostname)) return url;
  } catch {
  }
  throw new Error("本地 Python Runner 连接地址必须是 loopback ws:// URL。");
}

export class WebSocketRunnerClient implements RunnerClient {
  private readonly url: string;
  private socket?: WebSocket;
  private connectPromise?: Promise<void>;
  private active?: ActiveRun;
  private _state: RunnerDisplayState = "connecting";
  private readonly listeners = new Set<(state: RunnerDisplayState) => void>();

  constructor(url: string) {
    this.url = url;
  }

  get state(): RunnerDisplayState {
    return this._state;
  }

  connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      let socket: WebSocket;
      let settled = false;
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        callback();
      };
      const settleResolve = (): void => settle(resolve);
      const settleReject = (error: Error): void => settle(() => reject(error));

      try {
        const url = parseLoopbackWebSocketUrl(this.url);
        socket = new WebSocket(url.href);
      } catch (error) {
        const connectionError = toError(error);
        this.setState("unavailable");
        settleReject(connectionError);
        return;
      }

      this.socket = socket;
      socket.onopen = (): void => {
        try {
          socket.send(JSON.stringify({ type: "subscribe_state" }));
          settleResolve();
        } catch (error) {
          this.failUnavailable();
          settleReject(toError(error));
        }
      };
      socket.onmessage = (event: MessageEvent): void => {
        this.handleMessage(event.data);
      };
      const failConnection = (): void => {
        this.failUnavailable();
        settleReject(new Error(UNAVAILABLE_MESSAGE));
      };
      socket.onerror = failConnection;
      socket.onclose = failConnection;
    });

    return this.connectPromise;
  }

  async run(request: RunRequest): Promise<RunResult> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("本地 Python Runner 尚未连接。");
    }
    if (this.active) {
      throw new Error("已有一个本地 Python Runner 请求正在执行。");
    }

    return new Promise<RunResult>((resolve, reject) => {
      this.active = { runId: request.runId, resolve, reject };
      try {
        socket.send(JSON.stringify({ type: "run", request }));
      } catch (error) {
        this.finishActive(toError(error));
      }
    });
  }

  interrupt(runId: string): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "interrupt", runId }));
  }

  onStateChange(listener: (state: RunnerDisplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    const socket = this.socket;
    this.finishActive(new Error(UNAVAILABLE_MESSAGE));
    this.setState("unavailable");
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;
    let message: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(data);
      if (!isRecord(parsed)) return;
      message = parsed;
    } catch {
      return;
    }

    if (message.type === "state") {
      this.setState(displayState(message.state as RunnerState));
      return;
    }
    if (message.type === "run_result" && isRecord(message.result)) {
      const result = message.result as unknown as RunResult;
      if (this.active?.runId === result.runId) this.finishActive(result);
      return;
    }
    if (message.type === "protocol_error") {
      const text = typeof message.error === "string"
        ? message.error
        : typeof message.message === "string" ? message.message : "Runner protocol error";
      this.finishActive(new Error(text));
    }
  }

  private failUnavailable(): void {
    this.finishActive(new Error(UNAVAILABLE_MESSAGE));
    this.setState("unavailable");
  }

  private setState(state: RunnerDisplayState): void {
    if (this._state === state) return;
    this._state = state;
    for (const listener of this.listeners) listener(state);
  }

  private finishActive(outcome: RunResult | Error): void {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    if (outcome instanceof Error) active.reject(outcome);
    else active.resolve(outcome);
  }
}
