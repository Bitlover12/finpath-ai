import type { ReactNode } from "react";

type Tone = "accent" | "danger" | "ink";

const TONE: Record<Tone, string> = {
  accent: "text-accent",
  danger: "text-danger-fg",
  ink: "text-ink",
};

/** 큰 숫자 + 아래 회색 라벨. 자산형성포털식 지표 박스. */
export function StatCard({
  label,
  value,
  tone = "accent",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="fp-panel p-5">
      <div className={`text-display tabular-nums ${TONE[tone]}`}>{value}</div>
      <p className="mt-1 text-caption text-subtle">{label}</p>
    </div>
  );
}
