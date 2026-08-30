import type { AnalyzeResponse } from "./types";

const KEY = "finpath:last-analysis";

export function saveAnalysis(result: AnalyzeResponse) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(result));
}

export function loadAnalysis(): AnalyzeResponse | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalyzeResponse;
  } catch {
    return null;
  }
}
