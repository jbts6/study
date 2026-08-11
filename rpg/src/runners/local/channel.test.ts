import { describe, expect, it } from "vitest";
import type { LocalRunnerChannel } from "./channel";

describe("local runner channel contract", () => {
  it("defines a generation counter and lifecycle hooks", () => {
    const stub: LocalRunnerChannel = {
      generation: 0,
      onMessage: undefined,
      onExit: undefined,
      send: () => false,
      interrupt: () => undefined,
      kill: () => undefined,
      pid: undefined,
    };
    expect(stub.generation).toBe(0);
    expect(typeof stub.send).toBe("function");
    expect(typeof stub.interrupt).toBe("function");
    expect(typeof stub.kill).toBe("function");
  });
});
