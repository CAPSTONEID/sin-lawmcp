/** Frontend contract for the v1 lawyer-facing legal research API. */

export type ResearchKind = "law" | "precedent";

export type ResearchStatus = "ok" | "partial";

export interface ResearchCard {
  kind: ResearchKind;
  title: string;
  citation: string;
  summary: string;
  officialUrl: string;
  id?: string;
}

export interface ResearchRequest {
  query: string;
}

export interface ResearchResponse {
  status: ResearchStatus;
  results: ResearchCard[];
}

export type VerifyVerdict =
  | "exists"
  | "not_found"
  | "content_mismatch"
  | "repealed"
  | "unverified";

export interface VerifyRequest {
  text: string;
}

export interface VerifyItem {
  citation: string;
  verdict: VerifyVerdict;
  officialUrl?: string;
  note?: string;
}

export interface VerifyResponse {
  items: VerifyItem[];
}

export interface HealthResponse {
  mcp: "up" | "down";
  ocConfigured: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MeResponse {
  email: string;
}

export type ErrorCode =
  | "LAW_OC_MISSING"
  | "MCP_UNAVAILABLE"
  | "UPSTREAM_LAW_GO_KR"
  | "NOT_FOUND"
  | "PARTIAL"
  | "BAD_REQUEST"
  | "INTERNAL"
  | "UNAUTHENTICATED";

export interface ErrorBody {
  code: ErrorCode;
  message: string;
}
