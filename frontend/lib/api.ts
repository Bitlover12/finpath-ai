import type { AnalyzeResponse, CardCatalogItem, CardTypePreference, EligibilityResponse, PolicyCatalogItem, ScenarioChange, SpendingCategory, SpendingOptimizationResponse, SpendingUploadResponse, UserProfile } from "./types";

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


export function getPolicies() {
  return request<PolicyCatalogItem[]>("/api/policies");
}

export function checkEligibility(profile: UserProfile, policyIds?: string[]) {
  return request<EligibilityResponse>("/api/eligibility", {
    method: "POST",
    body: JSON.stringify({ profile, policy_ids: policyIds || null }),
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


export function getCards() {
  return request<CardCatalogItem[]>("/api/cards");
}

export function recommendSpending(profile: UserProfile, categories: Partial<Record<SpendingCategory, number>>, options?: { current_card_id?: string | null; card_type_preference?: CardTypePreference; cut_percent?: number; }) {
  return request<SpendingOptimizationResponse>("/api/spending/recommend", {
    method: "POST",
    body: JSON.stringify({
      profile,
      spending: {
        categories,
        current_card_id: options?.current_card_id || null,
        card_type_preference: options?.card_type_preference || "BOTH",
        cut_percent: options?.cut_percent ?? 10,
      },
    }),
  });
}

export async function uploadSpendingFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/api/spending/upload`, { method: "POST", body: form });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }
  return response.json() as Promise<SpendingUploadResponse>;
}
