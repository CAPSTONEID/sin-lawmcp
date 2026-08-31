import type { ErrorCode as ErrorCodeName } from "./types.js";

export const ErrorCode = {
  LAW_OC_MISSING: "LAW_OC_MISSING",
  MCP_UNAVAILABLE: "MCP_UNAVAILABLE",
  UPSTREAM_LAW_GO_KR: "UPSTREAM_LAW_GO_KR",
  NOT_FOUND: "NOT_FOUND",
  PARTIAL: "PARTIAL",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL: "INTERNAL",
  UNAUTHENTICATED: "UNAUTHENTICATED",
} as const;

export const LAW_OC_MISSING_MESSAGE =
  "「법제처 Open API 인증키(OC)」가 설정되지 않았습니다. 로컬 env 파일의 LAW_OC 에 인증키를 넣으세요. https://open.law.go.kr";

export class ApiError extends Error {
  readonly code: ErrorCodeName;
  readonly statusCode: number;

  constructor(code: ErrorCodeName, message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isOcConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.LAW_OC?.trim());
}

export function maskSensitive(input: string): string {
  return input
    .replace(/([?&](?:oc|apikey|api_key|authkey|auth_key|key)=)[^&\s]+/gi, "$1***")
    .replace(/\bLAW_OC\s*[=:]\s*\S+/gi, "LAW_OC=***")
    .replace(/\b(oc|apiKey|api_key)\s*[=:]\s*\S+/gi, "$1=***");
}

export const maskSecrets = maskSensitive;

export function lawOcMissing(): ApiError {
  return new ApiError("LAW_OC_MISSING", LAW_OC_MISSING_MESSAGE, 503);
}

export function mcpUnavailable(detail?: string): ApiError {
  const extra = detail ? ` (${detail})` : "";
  return new ApiError("MCP_UNAVAILABLE", `korean-law-mcp 에 연결할 수 없습니다.${extra}`, 503);
}

export function upstreamLawGoKr(detail?: string): ApiError {
  const extra = detail ? ` ${detail}` : "";
  return new ApiError("UPSTREAM_LAW_GO_KR", `법제처(open.law.go.kr) 조회에 실패했습니다.${extra}`.trim(), 502);
}

export function notFound(detail?: string): ApiError {
  return new ApiError("NOT_FOUND", detail ?? "법제처에서 해당 자료를 찾지 못했습니다.", 404);
}

export function partial(detail?: string): ApiError {
  return new ApiError("PARTIAL", detail ?? "일부 조회만 성공했습니다.", 207);
}

export function badRequest(message: string): ApiError {
  return new ApiError("BAD_REQUEST", message, 400);
}

export function unauthenticated(message = "authentication required"): ApiError {
  return new ApiError("UNAUTHENTICATED", message, 401);
}
