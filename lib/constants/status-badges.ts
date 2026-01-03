import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

interface StatusBadgeConfig {
  variant: BadgeVariant;
  label: string;
}

/**
 * 구독 상태 배지 설정
 * @example
 * const status = 'active';
 * const config = subscriptionStatusBadge[status];
 * <Badge variant={config.variant}>{config.label}</Badge>
 */
export const subscriptionStatusBadge: Record<string, StatusBadgeConfig> = {
  active: { variant: "success", label: "활성" },
  trialing: { variant: "default", label: "체험 중" },
  past_due: { variant: "warning", label: "연체" },
  canceled: { variant: "secondary", label: "취소됨" },
  expired: { variant: "destructive", label: "만료" },
  incomplete: { variant: "warning", label: "결제 대기" },
  incomplete_expired: { variant: "destructive", label: "결제 실패" },
} as const;

/**
 * 결제 상태 배지 설정
 * @example
 * const status = 'PAID';
 * const config = paymentStatusBadge[status];
 * <Badge variant={config.variant}>{config.label}</Badge>
 */
export const paymentStatusBadge: Record<string, StatusBadgeConfig> = {
  PAID: { variant: "success", label: "완료" },
  PENDING: { variant: "warning", label: "대기" },
  FAILED: { variant: "destructive", label: "실패" },
  CANCELLED: { variant: "secondary", label: "취소" },
  REFUNDED: { variant: "outline", label: "환불" },
  PARTIAL_REFUNDED: { variant: "outline", label: "부분환불" },
} as const;

/**
 * 플랜 티어 배지 설정
 * @example
 * const tier = 'pro';
 * const config = planTierBadge[tier];
 * <Badge variant={config.variant}>{config.label}</Badge>
 */
export const planTierBadge: Record<string, StatusBadgeConfig> = {
  free: { variant: "secondary", label: "Free" },
  starter: { variant: "default", label: "Starter" },
  pro: { variant: "success", label: "Pro" },
  enterprise: { variant: "default", label: "Enterprise" },
} as const;

/**
 * 사용량 상태 계산 (Progress variant 결정용)
 * @param current 현재 사용량
 * @param limit 최대 한도
 * @returns Progress 컴포넌트 variant
 */
export function getUsageVariant(
  current: number,
  limit: number
): "default" | "warning" | "destructive" {
  if (limit <= 0) return "default";

  const percentage = (current / limit) * 100;

  if (percentage >= 90) return "destructive";
  if (percentage >= 70) return "warning";
  return "default";
}

/**
 * 사용량 경고 배지 설정
 * @param percentage 사용률 (0-100)
 * @returns 경고 배지 설정 또는 null
 */
export function getUsageWarningBadge(
  percentage: number
): StatusBadgeConfig | null {
  if (percentage >= 100) {
    return { variant: "destructive", label: "한도 초과" };
  }
  if (percentage >= 90) {
    return { variant: "destructive", label: "한도 임박" };
  }
  if (percentage >= 70) {
    return { variant: "warning", label: "주의" };
  }
  return null;
}
