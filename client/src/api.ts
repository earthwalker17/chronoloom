import type { EngineId, IdentityId, NpcId } from "@shared/constants";
import type { HealthResponse, LifeReport, MetaResponse, SessionView, TalkResponse } from "@shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } };
  if (!res.ok) {
    throw new ApiError(res.status, body.error?.code ?? "unknown", body.error?.message ?? "出了点问题");
  }
  return body as T;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  meta: () => request<MetaResponse>("/api/meta"),
  createSession: (identityId: IdentityId, provider?: EngineId, playerNameZh?: string) =>
    request<SessionView>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ identityId, provider, playerNameZh }),
    }),
  getSession: (id: string) => request<SessionView>(`/api/sessions/${id}`),
  takeTurn: (id: string, choiceId: string, turn: number) =>
    request<SessionView>(`/api/sessions/${id}/turn`, {
      method: "POST",
      body: JSON.stringify({ choiceId, turn }),
    }),
  talk: (id: string, npcId: NpcId, turn: number) =>
    request<TalkResponse>(`/api/sessions/${id}/talk`, {
      method: "POST",
      body: JSON.stringify({ npcId, turn }),
    }),
  getReport: (id: string) =>
    request<{ report: LifeReport }>(`/api/sessions/${id}/report`, { method: "POST", body: "{}" }),
};

const SAVE_KEY = "chronoloom.sessionId";

export const savedSession = {
  get: (): string | null => localStorage.getItem(SAVE_KEY),
  set: (id: string) => localStorage.setItem(SAVE_KEY, id),
  clear: () => localStorage.removeItem(SAVE_KEY),
};
