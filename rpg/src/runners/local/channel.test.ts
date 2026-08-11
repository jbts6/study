import { describe, expect, it } from "vitest";
import type { LocalRunnerChannel } from "./channel";

describe("local runner channel contract", () => {
  it("defines a generation counter and async lifecycle hooks", () => {
    const stub: LocalRunnerChannel = {
      generation: 0,
      onMessage: undefined,
      onExit: undefined,
      waitReady: () => Promise.resolve(),
      send: () => Promise.resolve(),
      interrupt: () => undefined,
      kill: () => Promise.resolve(),
      pid: undefined,
    };
    expect(stub.generation).toBe(0);
    expect(typeof stub.waitReady).toBe("function");
    expect(typeof stub.send).toBe("function");
    expect(typeof stub.interrupt).toBe("function");
    expect(typeof stub.kill).toBe("function");
  });
});
