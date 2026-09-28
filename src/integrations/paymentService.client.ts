import { env } from "../config/env";
import { createBreaker } from "../shared/circuitBreaker/breaker";
import { httpPost } from "./httpClient";

// Section 3 / 20: Payment Service is external and will become the
// production source of truth for billing. Today, the temporary
// subscription module in this service calls this client so that the
// integration point already exists - only the *implementation* behind
// SubscriptionRepository changes when Payment Service takes over.
export interface ChargeRequest {
  userId: string;
  amountInPaise: number;
  reason: "SUBSCRIPTION_MONTHLY" | "RECHARGE";
  idempotencyKey: string;
}
export interface ChargeResult {
  success: boolean;
  paymentReference: string;
}

async function charge(req: ChargeRequest): Promise<ChargeResult> {
  return httpPost<ChargeResult>(`${env.externalServices.paymentServiceBaseUrl}/internal/charges`, req);
}

const breaker = createBreaker("payment-service", charge, {
  // Section 15: "Fail premium-only action safely." Never invent a
  // successful charge on breaker-open.
  onOpenFallback: async () => ({ success: false, paymentReference: "" }),
});

export async function chargeUser(req: ChargeRequest): Promise<ChargeResult> {
  return breaker.fire(req);
}
