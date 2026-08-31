/** Local API client — never talks to MCP. Same-origin only. */
const API = "";

export async function getHealth() {
  const r = await fetch(`${API}/v1/health`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw ObjectApiError(r.status, body);
  return body;
}

export async function research(query) {
  const r = await fetch(`${API}/v1/research`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw objectApiError(r.status, body);
  return body;
}

export async function verifyCitations(text) {
  const r = await fetch(`${API}/v1/citations/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw objectApiError(r.status, body);
  return body;
}

function objectApiError(status, body) {
  const err = new Error(body?.message || `HTTP ${status}`);
  err.code = body?.code || "INTERNAL";
  err.status = status;
  err.body = body;
  return err;
}

export function verdictLabel(v) {
  switch (v) {
    case "exists": return { text: "실존", cls: "exists" };
    case "not_found": return { text: "조문 없음", cls: "not-found" };
    case "content_mismatch": return { text: "제목 불일치·통과 아님", cls: "mismatch" };
    case "repealed": return { text: "폐지", cls: "repealed" };
    case "unverified": return { text: "미검증", cls: "unverified" };
    default: return { text: v, cls: "unverified" };
  }
}

export function errorTitle(code) {
  switch (code) {
    case "LAW_OC_MISSING":
      return "법제처 Open API 인증키(OC)가 등록되지 않았습니다";
    case "MCP_UNAVAILABLE":
      return "법령 MCP 서버에 연결할 수 없습니다";
    case "UPSTREAM_LAW_GO_KR":
      return "법제처 원문 조회 실패";
    case "NOT_FOUND":
      return "해당 조문 없음";
    default:
      return "요청을 처리할 수 없습니다";
  }
}
