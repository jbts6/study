export class RunnerStateStore<TState extends string> {
  private current: TState;
  private readonly listeners = new Set<(state: TState) => void>();

  constructor(initialState: TState) {
    this.current = initialState;
  }

  get value(): TState {
    return this.current;
  }

  subscribe(listener: (state: TState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(state: TState): void {
    if (state === this.current) return;
    this.current = state;
    for (const listener of this.listeners) listener(state);
  }
}

export function clearTimer(timer: ReturnType<typeof setTimeout> | undefined): void {
  if (timer !== undefined) clearTimeout(timer);
}
