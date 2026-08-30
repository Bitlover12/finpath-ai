export const won = (value: number | null | undefined) =>
  value == null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;

export const manWon = (value: number | null | undefined) =>
  value == null ? "-" : `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;

export const monthsText = (months: number | null | undefined) => {
  if (months == null) return "계산 불가";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest}개월`;
  return rest ? `${years}년 ${rest}개월` : `${years}년`;
};
