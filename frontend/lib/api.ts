import type { AnalyzeResponse, ScenarioChange, UserProfile } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function analyze(profile: UserProfile) {
  return request<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
}

export function getDemo(id: "A" | "B" | "C") {
  return request<AnalyzeResponse>(`/api/demo/${id}`);
}

export function parseScenario(text: string) {
  return request<{ changes: ScenarioChange[]; notice: string | null }>("/api/scenario/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function applyScenario(profile: UserProfile, changes: ScenarioChange[]) {
  return request<AnalyzeResponse>("/api/scenario/apply", {
    method: "POST",
    body: JSON.stringify({ profile, changes }),
  });
}
