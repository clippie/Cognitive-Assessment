import { apiPost } from "./client";
import type { SessionCreate, SessionResponse } from "../types/session";

export function submitSession(session: SessionCreate): Promise<SessionResponse> {
  return apiPost<SessionResponse>("/sessions", session);
}
