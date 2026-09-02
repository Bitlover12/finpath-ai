import type { AnalyzeResponse, SpendingOptimizationResponse } from "./types";

const ANALYSIS_KEY = "finpath:last-analysis";
const SPENDING_KEY = "finpath:last-spending-optimization";

export function saveAnalysis(result: AnalyzeResponse) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ANALYSIS_KEY, JSON.stringify(result));
  // A new base/scenario analysis invalidates any previously calculated Full FinPath result.
  localStorage.removeItem(SPENDING_KEY);
}

export function loadAnalysis(): AnalyzeResponse | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalyzeResponse;
  } catch {
    return null;
  }
}

export function saveSpendingOptimization(result: SpendingOptimizationResponse) {
  if (typeof window !== "undefined") localStorage.setItem(SPENDING_KEY, JSON.stringify(result));
}

export function loadSpendingOptimization(): SpendingOptimizationResponse | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SPENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpendingOptimizationResponse;
  } catch {
    return null;
  }
}

export function clearSpendingOptimization() {
  if (typeof window !== "undefined") localStorage.removeItem(SPENDING_KEY);
}
