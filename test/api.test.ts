import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { McpClient, McpToolResult } from "../src/mcp/types.js";

class MockMcp implements McpClient {
  pingOk = true;
  tools = new Map<string, (args: Record<string, unknown>) => McpToolResult | Promise<McpToolResult>>();
  failConnect = false;
  async ping(): Promise<boolean> {
    if (this.failConnect) throw new Error("spawn ENOENT");
    return this.pingOk;
  }
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (this.failConnect) throw new Error("spawn ENOENT");
    const fn = this.tools.get(name);
    if (!fn) throw new Error("unknown tool " + name);
    return fn(args);
  }
  async close(): Promise<void> {}
}

async function appOf(mcp: MockMcp, oc = true) {
  return await buildApp({ mcp, ocConfigured: () => oc });
}

describe("health", () => {
  it("LAW_OC unset => ocConfigured false and key absent", async () => {
    const mcp = new MockMcp();
    const app = await appOf(mcp, false);
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { mcp: string; ocConfigured: boolean };
    expect(body.ocConfigured).toBe(false);
    expect(body.mcp).toBe("up");
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/LAW_OC/);
    expect(raw).not.toMatch(/honggildong|sk-|apiKey/i);
    expect(Object.keys(body).sort().join(",")).toBe("mcp,ocConfigured");
    await app.close();
  });
});
describe("citations/verify", () => {
  it("민법 제750조 => exists", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("legal_analysis", () => ({
      text: "[VERIFIED]\n✓ 민법 제750조(불법행위의 내용) 실존",
    }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/citations/verify", payload: { text: "민법 제750조" } });
    expect(res.statusCode).toBe(200);
    const item = res.json().items[0];
    expect(item.verdict).toBe("exists");
    expect(item.citation).toMatch(/민법/);
    await app.close();
  });

  it("형법 제9999조 => not_found", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("legal_analysis", () => ({
      text: "[HALLUCINATION_DETECTED]\n✗ 형법 제9999조 — [NOT_FOUND] 해당 조문 없음 (존재 범위: 제1조~제372조)",
      isError: true,
    }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/citations/verify", payload: { text: "형법 제9999조" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].verdict).toBe("not_found");
    await app.close();
  });

  it("민법 제750조(계약해제) => content_mismatch", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("legal_analysis", () => ({
      text: "[HALLUCINATION_DETECTED]\n✗ 민법 제750조 — [CONTENT_MISMATCH] 인용 제목 계약해제 ≠ 실제 조문제목 불법행위의 내용",
      isError: true,
    }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/citations/verify", payload: { text: "민법 제750조(계약해제)" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].verdict).toBe("content_mismatch");
    expect(res.json().items[0].verdict).not.toBe("exists");
    await app.close();
  });
});
describe("research", () => {
  it("화관법 resolves toward 화학물질관리법", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", (args) => {
      expect(String(args.query)).toMatch(/화관법/);
      return {
        text: "법령명: 화학물질관리법\nMST: 279811\nhttps://www.law.go.kr/법령/화학물질관리법",
      };
    });
    mcp.tools.set("search_decisions", () => ({ text: "검색 결과 없음 [NOT_FOUND]" }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/research", payload: { query: "화관법" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].title).toContain("화학물질관리법");
    expect(body.results[0].officialUrl).toMatch(/law\.go\.kr/);
    await app.close();
  });
});
describe("errors", () => {
  it("OC missing is not HTTP 200 empty results", async () => {
    const mcp = new MockMcp();
    const app = await appOf(mcp, false);
    const res = await app.inject({ method: "POST", url: "/v1/research", payload: { query: "민법" } });
    expect(res.statusCode).not.toBe(200);
    const body = res.json();
    expect(body.code).toBe("LAW_OC_MISSING");
    expect(body.message).toContain("법제처 Open API 인증키(OC)");
    expect(JSON.stringify(body)).not.toMatch(/OpenAI/i);
    await app.close();
  });

  it("MCP down => MCP_UNAVAILABLE", async () => {
    const mcp = new MockMcp();
    mcp.failConnect = true;
    const app = await appOf(mcp, true);
    const res = await app.inject({ method: "POST", url: "/v1/research", payload: { query: "민법" } });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("MCP_UNAVAILABLE");
    await app.close();
  });

  it("antibot HTML is UPSTREAM_LAW_GO_KR not not_found", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", () => ({
      text: "<!DOCTYPE html><html>location.assign antibot 503</html>",
      isError: true,
    }));
    mcp.tools.set("search_decisions", () => ({
      text: "<!DOCTYPE html><html>점검</html>",
      isError: true,
    }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/research", payload: { query: "민법" } });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("UPSTREAM_LAW_GO_KR");
    expect(res.json().code).not.toBe("NOT_FOUND");
    await app.close();
  });

  it("real miss after successful upstream => NOT_FOUND", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", () => ({ text: "[NOT_FOUND] 검색 결과 없음" }));
    mcp.tools.set("search_decisions", () => ({ text: "[NOT_FOUND] 검색 결과 없음" }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/research", payload: { query: "없는법령xyz" } });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
    await app.close();
  });
});
describe("verify mapping extras", () => {
  it("repealed and unverified stay distinct from exists", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("legal_analysis", () => ({
      text: "⌛ 구법 제1조 — [REPEALED] 폐지된 법령입니다\n⚠ 제1조 — 법령명 추출 실패",
    }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/citations/verify", payload: { text: "구법 제1조 제1조" } });
    const verdicts = res.json().items.map((i: { verdict: string }) => i.verdict);
    expect(verdicts).toContain("repealed");
    expect(verdicts).toContain("unverified");
    expect(verdicts).not.toContain("exists");
    await app.close();
  });

  it("NO_CITATIONS_FOUND is unverified never exists", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("legal_analysis", () => ({
      text: "[NO_CITATIONS_FOUND] 입력 텍스트에서 조문·판례 인용이 발견되지 않았습니다.",
    }));
    const app = await appOf(mcp);
    const res = await app.inject({ method: "POST", url: "/v1/citations/verify", payload: { text: "안녕하세요" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].verdict).toBe("unverified");
    await app.close();
  });
});

describe("web UI", () => {
  it("GET / serves local search page", async () => {
    const mcp = new MockMcp();
    const app = await appOf(mcp, false);
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toMatch(/text\/html/);
    expect(res.body).toMatch(/법령·판례 검색/);
    await app.close();
  });
});
