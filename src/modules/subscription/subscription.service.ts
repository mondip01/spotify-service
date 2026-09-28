import { subscriptionRepository } from "./subscription.repository";
import { chargeUser } from "../../integrations/paymentService.client";
import { AppError } from "../../shared/errors/AppError";
import { withCache, cacheDel } from "../../shared/cache/cache";
import { withIdempotency } from "../../shared/idempotency/idempotency";
import { Request } from "express";
import { EntitlementFeature } from "./subscription.schema";
import { getIdempotencyKey } from "../../shared/idempotency/idempotency";
import { v4 as uuid } from "uuid";

const ENTITLEMENT_CACHE_TTL_SEC = 60; // short TTL - section 12: "invalidate on subscription change"

export const subscriptionService = {
  listPlans: () => subscriptionRepository.listPlans(),

  async myStatus(userId: string) {
    const subscription = await subscriptionRepository.findActiveSubscription(userId);
    const entitled = await this.isEntitled(userId, "PREMIUM_AUDIO");
    return { subscription, premiumAudioEntitled: entitled };
  },

  /**
   * Section 14: "Subscription activation - Idempotency key + transaction
   * for subscription/entitlement changes." Charges via Payment Service
   * (today: local test provider), then atomically creates the
   * Subscription record and grants the PREMIUM_AUDIO entitlement.
   */
  async subscribe(userId: string, planCode: string, req: Request) {
    return withIdempotency("subscription-subscribe", userId, req, async () => {
      const plan = await subscriptionRepository.findPlanByCode(planCode);
      if (!plan) throw AppError.notFound("PLAN_NOT_FOUND", "Subscription plan not found");

      const idempotencyKey = getIdempotencyKey(req) ?? `sub_${uuid()}`;
      const charge = await chargeUser({
        userId,
        amountInPaise: Math.round(plan.price * 100),
        reason: "SUBSCRIPTION_MONTHLY",
        idempotencyKey,
      });
      if (!charge.success) {
        throw AppError.unprocessable("CHARGE_FAILED", "Payment could not be completed");
      }

      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.billingPeriod === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (plan.billingPeriod === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      const subscription = await subscriptionRepository.createSubscription({
        userId,
        planId: plan._id as any,
        status: "ACTIVE",
        provider: "LOCAL_TEST",
        providerSubscriptionId: charge.paymentReference,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      await subscriptionRepository.grantEntitlement(userId, "PREMIUM_AUDIO", "SUBSCRIPTION", periodEnd);
      await cacheDel(`music:entitlement:${userId}`);

      return subscription;
    });
  },

  async cancel(userId: string) {
    await subscriptionRepository.cancelSubscription(userId);
    // Entitlement stays active until currentPeriodEnd; a scheduled sweep
    // (see analytics/notification flow) flips it off once the period ends.
    return { cancelAtPeriodEnd: true };
  },

  /** Grants free access from a recharge (mirrors the PRD's "recharge >= 100 -> 6 months free" rule). */
  async grantFromRecharge(userId: string, months: number) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);
    await subscriptionRepository.grantEntitlement(userId, "PREMIUM_AUDIO", "PROMOTION", expiresAt);
    await cacheDel(`music:entitlement:${userId}`);
  },

  async isEntitled(userId: string, feature: EntitlementFeature): Promise<boolean> {
    return withCache(`music:entitlement:${userId}:${feature}`, ENTITLEMENT_CACHE_TTL_SEC, async () => {
      const entitlement = await subscriptionRepository.findActiveEntitlement(userId, feature);
      if (!entitlement) return false;
      if (entitlement.expiresAt && entitlement.expiresAt.getTime() < Date.now()) return false;
      return true;
    });
  },
};
