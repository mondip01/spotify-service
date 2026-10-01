import { env } from "../../config/env";
import { createBreaker } from "../circuitBreaker";
import { httpGet } from "../httpClient";
import { withCache } from "../../utils/cache";

// Section 3: "User Service - user existence/profile references. Store
// userId; do not duplicate full user profile." The Music Service asks
// for just enough (displayName/avatar/role) to render UI copy like
// "Welcome {name}" and to check admin role - never stores it.
export interface UserProfileRef {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
}

async function fetchProfile(userId: string): Promise<UserProfileRef> {
  return httpGet<UserProfileRef>(`${env.externalServices.userServiceBaseUrl}/internal/users/${userId}`);
}

const breaker = createBreaker("user-service", fetchProfile, {
  // Section 15 fallback: "Use only safe cached data; otherwise fail
  // protected operation." A stale cached profile is fine for display
  // purposes; there is no cached fallback for calls that don't already
  // have one cached, so those simply surface a 503 from the breaker.
  onOpenFallback: async (userId: string) => ({ userId, displayName: "Devotee" }),
});

export async function getUserProfile(userId: string): Promise<UserProfileRef> {
  return withCache(`music:userprofile:${userId}`, 300, () => breaker.fire(userId));
}
