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

type ActiveOutcome = Readonly<{ result: RunResult } | { error: Error }>;

const UNAVAILABLE_MESSAGE = "本地 Python Runner 不可用。启动 Runner 后刷新页面。";

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
  if (isRecord(value) && typeof value.message === "string") return new Error(value.message);
  return new Error(fallback);
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
      const settleResolve = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const settleReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        socket = new WebSocket(this.url);
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
          const connectionError = toError(error);
          this.finishActive({ error: new Error(UNAVAILABLE_MESSAGE) });
          this.setState("unavailable");
          settleReject(connectionError);
        }
      };
      socket.onmessage = (event: MessageEvent): void => {
        this.handleMessage(event.data);
      };
      socket.onerror = (): void => {
        this.failUnavailable();
        settleReject(new Error(UNAVAILABLE_MESSAGE));
      };
      socket.onclose = (): void => {
        this.failUnavailable();
        settleReject(new Error(UNAVAILABLE_MESSAGE));
      };
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
        this.finishActive({ error: toError(error) });
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
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    const socket = this.socket;
    this.finishActive({ error: new Error(UNAVAILABLE_MESSAGE) });
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
      if (this.active?.runId === result.runId) this.finishActive({ result });
      return;
    }
    if (message.type === "protocol_error") {
      const text = typeof message.error === "string"
        ? message.error
        : typeof message.message === "string" ? message.message : "Runner protocol error";
      this.finishActive({ error: new Error(text) });
    }
  }

  private failUnavailable(): void {
    this.finishActive({ error: new Error(UNAVAILABLE_MESSAGE) });
    this.setState("unavailable");
  }

  private setState(state: RunnerDisplayState): void {
    if (this._state === state) return;
    this._state = state;
    for (const listener of this.listeners) listener(state);
  }

  private finishActive(outcome: ActiveOutcome): void {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    if ("result" in outcome) {
      active.resolve(outcome.result);
    } else {
      active.reject(outcome.error);
    }
  }
}
