import type { CouponType } from "@prisma/client";

/** A coupon row for the super-admin coupons table. */
export interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  maxRedemptions: number | null;
  redemptions: number;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}
