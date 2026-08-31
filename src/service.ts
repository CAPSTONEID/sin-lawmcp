import { ApiError, ErrorCode, LAW_OC_MISSING_MESSAGE, isOcConfigured } from "./errors.js";
import { logToolCall } from "./logging.js";
import { classifyToolText, looksLikeEmptySearch } from "./mcp/classify.js";
import { parseLawHits, parsePrecedentHits } from "./mcp/parse-research.js";
import { parseVerifyOutput } from "./mcp/parse-verify.js";
import type { McpClient, McpToolResult } from "./mcp/types.js";
import type { HealthResponse, ResearchResponse, VerifyResponse } from "./types.js";

export type Gateway = {
  mcp: McpClient;
  ocConfigured?: () => boolean;
};

async function timedCall(
  mcp: McpClient,
  requestId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const t0 = Date.now();
  try {
    const result = await mcp.callTool(tool, args);
    const kind = classifyToolText(result.text, result.isError);
    logToolCall({ requestId, tool, latencyMs: Date.now() - t0, upstreamStatus: kind });
    return result;
  } catch (err) {
    logToolCall({
      requestId,
      tool,
      latencyMs: Date.now() - t0,
      upstreamStatus: "unavailable",
    });
    throw err;
  }
}

function requireOc(gw: Gateway): void {
  const ok = gw.ocConfigured ? gw.ocConfigured() : isOcConfigured();
  if (!ok) {
    throw new ApiError(ErrorCode.LAW_OC_MISSING, LAW_OC_MISSING_MESSAGE, 503);
  }
}

export async function health(gw: Gateway): Promise<HealthResponse> {
  const ocConfigured = gw.ocConfigured ? gw.ocConfigured() : isOcConfigured();
  let mcp: "up" | "down" = "down";
  try {
    mcp = (await gw.mcp.ping()) ? "up" : "down";
  } catch {
    mcp = "down";
  }
  return { mcp, ocConfigured };
}

export async function research(gw: Gateway, query: string, requestId: string): Promise<ResearchResponse> {
  requireOc(gw);
  const q = query.trim();
  if (!q) throw new ApiError(ErrorCode.BAD_REQUEST, "query is required", 400);

  let law: McpToolResult | undefined;
  let prec: McpToolResult | undefined;
  let mcpDown = false;
  try {
    law = await timedCall(gw.mcp, requestId, "search_law", { query: q });
  } catch {
    mcpDown = true;
  }
  try {
    prec = await timedCall(gw.mcp, requestId, "search_decisions", {
      query: q,
      domain: "precedent",
    });
  } catch {
    if (!law) mcpDown = true;
  }

  if (mcpDown && !law && !prec) {
    throw new ApiError(ErrorCode.MCP_UNAVAILABLE, "MCP server is unavailable", 503);
  }

  const lawKind = law ? classifyToolText(law.text, law.isError) : "unavailable";
  const precKind = prec ? classifyToolText(prec.text, prec.isError) : "unavailable";

  if (lawKind === "upstream" && (!prec || precKind === "upstream" || precKind === "unavailable")) {
    throw new ApiError(
      ErrorCode.UPSTREAM_LAW_GO_KR,
      "법제처(law.go.kr) 조회가 실패했습니다. 일시 장애·타임아웃·안티봇 HTML일 수 있습니다.",
      502,
    );
  }

  const results = [
    ...(law && lawKind !== "upstream" && !looksLikeEmptySearch(law.text) ? parseLawHits(law.text) : []),
    ...(prec && precKind !== "upstream" && !looksLikeEmptySearch(prec.text) ? parsePrecedentHits(prec.text) : []),
  ];

  if (results.length === 0) {
    if (lawKind === "upstream" || precKind === "upstream") {
      throw new ApiError(
        ErrorCode.UPSTREAM_LAW_GO_KR,
        "법제처(law.go.kr) 조회가 실패했습니다. 일시 장애·타임아웃·안티봇 HTML일 수 있습니다.",
        502,
      );
    }
    throw new ApiError(ErrorCode.NOT_FOUND, "검색 결과가 없습니다.", 404);
  }

  const partial = lawKind !== "ok" || precKind !== "ok";
  return { status: partial ? "partial" : "ok", results };
}

export async function verifyCitations(gw: Gateway, text: string, requestId: string): Promise<VerifyResponse> {
  requireOc(gw);
  const body = text.trim();
  if (!body) throw new ApiError(ErrorCode.BAD_REQUEST, "text is required", 400);

  let result: McpToolResult | undefined;
  try {
    result = await timedCall(gw.mcp, requestId, "legal_analysis", {
      mode: "verify_citations",
      text: body,
    });
  } catch {
    try {
      result = await timedCall(gw.mcp, requestId, "verify_citations", { text: body });
    } catch (err) {
      throw new ApiError(ErrorCode.MCP_UNAVAILABLE, "MCP server is unavailable", 503);
    }
  }

  const kind = classifyToolText(result.text, result.isError);
  if (kind === "upstream") {
    throw new ApiError(
      ErrorCode.UPSTREAM_LAW_GO_KR,
      "법제처(law.go.kr) 조회가 실패했습니다. 일시 장애·타임아웃·안티봇 HTML일 수 있습니다.",
      502,
    );
  }

  return { items: parseVerifyOutput(result.text) };
}
