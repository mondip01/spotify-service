import CircuitBreaker from "opossum";
import logger from "../utils/logger";
export type CircuitStatus = "CLOSED" | "OPEN" | "HALF_OPEN";
export interface CircuitStateEntry {
  status:        CircuitStatus;
  failures:      number;
  lastFailureAt: number | null;
  openedAt:      number | null;
}
export interface ICircuitStateStore {
  get(name: string): Promise<CircuitStateEntry | null>;
  set(name: string, state: CircuitStateEntry): Promise<void>;
  del(name: string): Promise<void>;
}
export function createInMemoryCircuitStateStore(): ICircuitStateStore {
  const map = new Map<string, CircuitStateEntry>();
  return {
    async get(name)        { return map.get(name) ?? null; },
    async set(name, state) { map.set(name, state); },
    async del(name)        { map.delete(name); },
  };
}
let defaultStore: ICircuitStateStore = createInMemoryCircuitStateStore();
export function setDefaultCircuitStateStore(store: ICircuitStateStore): void {
  defaultStore = store;
}
export function getDefaultCircuitStateStore(): ICircuitStateStore {
  return defaultStore;
}
export interface CircuitBreakerConfig {
  name:                 string;
  timeout?:             number;   // ms before a call is considered failed
  errorThresholdPct?:   number;   // % failures before opening
  resetTimeout?:        number;   // ms to wait in OPEN before half-open probe
  volumeThreshold?:     number;   // min calls before the breaker can trip
  rollingCountTimeout?: number;   // rolling window length ms
  store?:               ICircuitStateStore;
  errorFilter?:         (error: unknown) => boolean; // true = don't count as failure
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFn<A extends any[], R> = (...args: A) => Promise<R>;
export interface ICircuitBreaker<A extends unknown[], R> {
  fire(...args: A): Promise<R>;
  isOpen():     boolean;
  isClosed():   boolean;
  isHalfOpen(): boolean;
  stats():      CircuitBreaker.Stats;
  reset():      Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCircuitBreaker<A extends any[], R>(
  fn:  AsyncFn<A, R>,
  cfg: CircuitBreakerConfig,
): ICircuitBreaker<A, R> {
  const store = cfg.store ?? defaultStore;
  const breaker = new CircuitBreaker(fn, {
    name:                     cfg.name,
    timeout:                  cfg.timeout             ?? 3_000,
    errorThresholdPercentage: cfg.errorThresholdPct   ?? 50,
    resetTimeout:             cfg.resetTimeout        ?? 30_000,
    volumeThreshold:          cfg.volumeThreshold     ?? 5,
    rollingCountTimeout:      cfg.rollingCountTimeout ?? 10_000,
    allowWarmUp:              false,
    errorFilter:              cfg.errorFilter ?? (() => false),
  });
  breaker.on("open", async () => {
    logger.warn({ circuit: cfg.name }, "Circuit breaker opened");
    const prev = await store.get(cfg.name);
    await store.set(cfg.name, {
      status:        "OPEN",
      failures:      prev?.failures      ?? 0,
      lastFailureAt: prev?.lastFailureAt ?? Date.now(),
      openedAt:      Date.now(),
    });
  });
  breaker.on("halfOpen", async () => {
    logger.info({ circuit: cfg.name }, "Circuit breaker half-open, probing");
    const prev = await store.get(cfg.name);
    await store.set(cfg.name, {
      ...(prev ?? { failures: 0, lastFailureAt: null, openedAt: null }),
      status: "HALF_OPEN",
    });
  });
  breaker.on("close", async () => {
    logger.info({ circuit: cfg.name }, "Circuit breaker closed");
    await store.set(cfg.name, { status: "CLOSED", failures: 0, lastFailureAt: null, openedAt: null });
  });
  breaker.on("failure", async () => {
    const prev = await store.get(cfg.name);
    await store.set(cfg.name, {
      status:        prev?.status   ?? "CLOSED",
      failures:      (prev?.failures ?? 0) + 1,
      lastFailureAt: Date.now(),
      openedAt:      prev?.openedAt ?? null,
    });
  });
  breaker.on("success", async () => {
    const prev = await store.get(cfg.name);
    if (prev?.status === "CLOSED" && (prev.failures ?? 0) > 0) {
      await store.set(cfg.name, { ...prev, failures: 0 });
    }
  });
  breaker.on("fallback", (result: unknown) => logger.warn({ circuit: cfg.name, result }, "Circuit breaker fallback triggered"));
  breaker.on("reject",   () => logger.warn({ circuit: cfg.name }, "Circuit breaker rejected call — circuit is open"));
  breaker.on("timeout",  () => logger.warn({ circuit: cfg.name }, "Circuit breaker call timed out"));
  return {
    fire:       (...args: A) => breaker.fire(...args) as Promise<R>,
    isOpen:     ()           => breaker.opened,
    isClosed:   ()           => breaker.closed,
    isHalfOpen: ()           => breaker.halfOpen,
    stats:      ()           => breaker.stats,
    reset:      async ()     => { await store.del(cfg.name); },
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapWithCircuitBreaker<T extends Record<string, AsyncFn<any[], any>>>(
  target:  T,
  baseCfg: CircuitBreakerConfig,
): T {
  const wrapped: Partial<T> = {};
  for (const key of Object.keys(target) as (keyof T)[]) {
    const fn = target[key];
    if (typeof fn !== "function") { wrapped[key] = fn; continue; }
    const cb = createCircuitBreaker(fn.bind(target) as AsyncFn<unknown[], unknown>, {
      ...baseCfg,
      name: `${baseCfg.name}:${String(key)}`,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wrapped as any)[key] = (...args: unknown[]) => cb.fire(...args);
  }
  return wrapped as T;
}

/** Backwards-compatible breaker factory used by service clients. */
export function createBreaker<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  options: { onOpenFallback?: (...args: A) => Promise<R> } = {},
): ICircuitBreaker<A, R> {
  const breaker = new CircuitBreaker(fn, {
    name,
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000,
    volumeThreshold: 5,
    rollingCountTimeout: 10000,
  });
  if (options.onOpenFallback) {
    breaker.fallback((...args: A) => options.onOpenFallback!(...args));
  }
  return {
    fire: (...args: A) => breaker.fire(...args) as Promise<R>,
    isOpen: () => breaker.opened,
    isClosed: () => breaker.closed,
    isHalfOpen: () => breaker.halfOpen,
    stats: () => breaker.stats,
    reset: async () => { breaker.close(); },
  };
}
