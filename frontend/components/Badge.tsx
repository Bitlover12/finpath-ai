import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "soon";

const TONE: Record<Tone, string> = {
  success: "bg-ok-bg text-ok-fg",
  warning: "bg-warn-bg text-warn-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-accent",
  neutral: "bg-neutral-bg text-subtle",
  soon: "bg-soon-bg text-soon-fg",
};

// 자격/모집 상태는 라벨을 컴포넌트가 소유한다 (호출부에서 문자열을 넘기지 않음).
const STATUS: Record<string, { label: string; tone: Tone }> = {
  eligible: { label: "가입 가능", tone: "success" },
  conditional: { label: "추가 확인", tone: "warning" },
  upcoming: { label: "모집 예정", tone: "soon" },
  closed: { label: "신청 마감", tone: "neutral" },
  check: { label: "일정 미확정", tone: "neutral" },
  ineligible: { label: "조건 미충족", tone: "neutral" },
  pending: { label: "판정 중", tone: "neutral" },
};

export type BadgeStatus = keyof typeof STATUS;

const BASE = "inline-flex items-center rounded-full px-2.5 py-1 text-caption font-bold";

/**
 * 자격 상태 배지: <Badge status="eligible" /> — 라벨·색 고정.
 * 그 외 동적 라벨(시나리오 변화 유형 등): <Badge tone="danger">기회 상실</Badge>.
 */
export function Badge({
  status,
  tone,
  children,
}: {
  status?: BadgeStatus;
  tone?: Tone;
  children?: ReactNode;
}) {
  if (status) {
    const s = STATUS[status];
    return <span className={`${BASE} ${TONE[s.tone]}`}>{s.label}</span>;
  }
  return <span className={`${BASE} ${TONE[tone ?? "neutral"]}`}>{children}</span>;
}
