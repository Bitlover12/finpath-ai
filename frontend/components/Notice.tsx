import type { ReactNode } from "react";

type Tone = "warning" | "danger" | "success" | "info";

const MAP: Record<Tone, { box: string; label: string }> = {
  warning: { box: "bg-warn-bg", label: "text-warn-fg" },
  danger: { box: "bg-danger-bg", label: "text-danger-fg" },
  success: { box: "bg-ok-bg", label: "text-ok-fg" },
  info: { box: "bg-info-bg", label: "text-accent" },
};

/**
 * 경고·안내 박스. 상단 label 배지 + 본문.
 * 배경만 tone색이고 본문은 ink로 읽기 쉽게 유지한다.
 */
export function Notice({
  tone,
  label,
  children,
  className = "",
}: {
  tone: Tone;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const m = MAP[tone];
  return (
    <div className={`rounded-[20px] ${m.box} p-5 sm:p-6 ${className}`}>
      {label && <p className={`text-caption font-bold ${m.label}`}>{label}</p>}
      <div className={`${label ? "mt-2" : ""} text-body text-ink`}>{children}</div>
    </div>
  );
}
