import CircuitBreaker from "opossum";
import { env } from "../../config/env";
import { logger } from "../logger";
import { AppError } from "../errors/AppError";

// Section 15: every call to User/Auth/Payment/Notification is wrapped in
// a timeout + circuit breaker so a slow/failing dependency can't cascade
// into the Music Service. One factory, reused by every integrations/*.client.ts.
export function createBreaker<TArgs extends unknown[], TResult>(
  name: string,
  action: (...args: TArgs) => Promise<TResult>,
  opts?: { timeoutMs?: number; onOpenFallback?: (...args: TArgs) => Promise<TResult> }
) {
  const breaker = new CircuitBreaker(action, {
    timeout: opts?.timeoutMs ?? env.circuitBreaker.timeoutMs,
    errorThresholdPercentage: env.circuitBreaker.errorThresholdPercentage,
    resetTimeout: env.circuitBreaker.resetTimeoutMs,
    name,
  });

  breaker.on("open", () => logger.warn({ breaker: name }, "circuit_breaker_open"));
  breaker.on("halfOpen", () => logger.info({ breaker: name }, "circuit_breaker_half_open"));
  breaker.on("close", () => logger.info({ breaker: name }, "circuit_breaker_closed"));
  breaker.on("timeout", () => logger.warn({ breaker: name }, "circuit_breaker_timeout"));
  breaker.on("reject", () => logger.warn({ breaker: name }, "circuit_breaker_rejected_fastfail"));

  if (opts?.onOpenFallback) {
    breaker.fallback((...args: TArgs) => opts.onOpenFallback!(...args));
  } else {
    breaker.fallback(() => {
      throw AppError.dependencyUnavailable(
        `${name.toUpperCase()}_UNAVAILABLE`,
        `${name} is currently unavailable`
      );
    });
  }

  return breaker;
}
