import { SubscriptionPlan, Subscription, Entitlement, EntitlementFeature } from "./subscription.schema";

// This is the interface everything else in the codebase depends on
// (playback.service, media.service). When Payment Service takes over,
// only THIS file's internals need to change - callers stay the same.
export const subscriptionRepository = {
  listPlans: () => SubscriptionPlan.find({ status: "ACTIVE" }).lean(),
  findPlanByCode: (code: string) => SubscriptionPlan.findOne({ code, status: "ACTIVE" }).lean(),

  findActiveSubscription: (userId: string) =>
    Subscription.findOne({ userId, status: "ACTIVE" }).sort({ currentPeriodEnd: -1 }).lean(),

  createSubscription: (doc: Partial<import("./subscription.schema").SubscriptionDoc>) => Subscription.create(doc),

  async cancelSubscription(userId: string) {
    await Subscription.updateMany({ userId, status: "ACTIVE" }, { $set: { cancelAtPeriodEnd: true } });
  },

  async expireSubscription(subscriptionId: string) {
    await Subscription.updateOne({ _id: subscriptionId }, { $set: { status: "EXPIRED" } });
  },

  /** Subscriptions entering the "notify before expiry" window (used by the analytics/notification flow). */
  findSubscriptionsExpiringBetween: (from: Date, to: Date) =>
    Subscription.find({ status: "ACTIVE", currentPeriodEnd: { $gte: from, $lte: to } }).lean(),

  async grantEntitlement(userId: string, feature: EntitlementFeature, source: "SUBSCRIPTION" | "ADMIN" | "PROMOTION", expiresAt?: Date) {
    await Entitlement.updateOne(
      { userId, feature },
      { $set: { active: true, source, expiresAt: expiresAt ?? null } },
      { upsert: true }
    );
  },

  async revokeEntitlement(userId: string, feature: EntitlementFeature) {
    await Entitlement.updateOne({ userId, feature }, { $set: { active: false } });
  },

  findActiveEntitlement: (userId: string, feature: EntitlementFeature) =>
    Entitlement.findOne({ userId, feature, active: true }).lean(),
};
