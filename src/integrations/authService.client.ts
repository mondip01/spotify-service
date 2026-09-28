import { env } from "../config/env";
import { createBreaker } from "../shared/circuitBreaker/breaker";
import { httpGet } from "./httpClient";

// Section 3 / 16: the Music Service verifies JWTs locally (see
// shared/auth/authMiddleware.ts) for speed and resilience. This client
// is only used for the rare case a route needs to double-check that a
// token hasn't been revoked server-side (e.g. logout-everywhere flows).
async function verifyRemote(token: string): Promise<{ valid: boolean; userId?: string }> {
  return httpGet(`${env.externalServices.authServiceBaseUrl}/internal/verify`, {
    Authorization: `Bearer ${token}`,
  });
}

const breaker = createBreaker("auth-service", verifyRemote, {
  // Section 15: "Do not bypass authentication." If Auth Service is down
  // and a route explicitly needs the remote check, fail closed - never
  // pretend the token is valid.
  onOpenFallback: async () => ({ valid: false }),
});

export async function verifyTokenRemotely(token: string) {
  return breaker.fire(token);
}
