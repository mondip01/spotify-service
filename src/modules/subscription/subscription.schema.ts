import { Schema, model, Types } from "mongoose";

// -----------------------------------------------------------------------
// TEMPORARY MODULE (section 20 / 3 / 26): this entire file exists only so
// premium functionality (entitlement-gated playback/download) can be
// built and tested before the Payment Service is ready to be the real
// billing authority. Business logic elsewhere depends on
// SubscriptionRepository / EntitlementService, never on these models
// directly - swapping the implementation for Payment Service later
// should not require touching PlaybackService or MediaService.
// -----------------------------------------------------------------------

export interface SubscriptionPlanDoc {
  code: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: "MONTHLY" | "YEARLY" | "ONE_TIME";
  features: string[];
  status: "ACTIVE" | "INACTIVE";
}
const planSchema = new Schema<SubscriptionPlanDoc>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    billingPeriod: { type: String, enum: ["MONTHLY", "YEARLY", "ONE_TIME"], required: true },
    features: { type: [String], default: ["PREMIUM_AUDIO"] },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);
export const SubscriptionPlan = model<SubscriptionPlanDoc>("SubscriptionPlan", planSchema);

export interface SubscriptionDoc {
  userId: string;
  planId: Types.ObjectId;
  status: "PENDING" | "ACTIVE" | "CANCELLED" | "EXPIRED";
  provider: "LOCAL_TEST" | "PAYMENT_SERVICE";
  providerSubscriptionId?: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const subscriptionSchema = new Schema<SubscriptionDoc>(
  {
    userId: { type: String, required: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    status: { type: String, enum: ["PENDING", "ACTIVE", "CANCELLED", "EXPIRED"], default: "PENDING" },
    provider: { type: String, enum: ["LOCAL_TEST", "PAYMENT_SERVICE"], default: "LOCAL_TEST" },
    providerSubscriptionId: { type: String, default: null },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });
export const Subscription = model<SubscriptionDoc>("Subscription", subscriptionSchema);

export type EntitlementFeature = "PREMIUM_AUDIO" | "DOWNLOAD" | "OTHER";
export type EntitlementSource = "SUBSCRIPTION" | "ADMIN" | "PROMOTION" | "PAYMENT_SERVICE";

export interface EntitlementDoc {
  userId: string;
  feature: EntitlementFeature;
  source: EntitlementSource;
  active: boolean;
  expiresAt?: Date | null;
  updatedAt: Date;
}
const entitlementSchema = new Schema<EntitlementDoc>(
  {
    userId: { type: String, required: true },
    feature: { type: String, enum: ["PREMIUM_AUDIO", "DOWNLOAD", "OTHER"], required: true },
    source: { type: String, enum: ["SUBSCRIPTION", "ADMIN", "PROMOTION", "PAYMENT_SERVICE"], required: true },
    active: { type: Boolean, required: true, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);
entitlementSchema.index({ userId: 1, feature: 1, active: 1 });
export const Entitlement = model<EntitlementDoc>("Entitlement", entitlementSchema);
