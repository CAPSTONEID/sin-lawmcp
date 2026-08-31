# sin-lawmcp

Lawyer-facing Korean legal research HTTP API (v1).

## Requirements

- Node.js 20.19+
- 법제처 Open API OC from https://open.law.go.kr (not OpenAI)

## Install

Clone the repo. Then install dependencies with ignore-scripts so husky prepare is skipped.
Frontend never talks to MCP. This HTTP API is the only boundary.
Copy the env example file, set the 법제처 OC locally, and do not commit that file.

## Run

Listen address defaults to 127.0.0.1 port 3000.
Use the start script in package.json.

## Test

Use the test script in package.json. MCP is mocked. No live OC is required.

- 민법 제750조 -> exists
- 형법 제9999조 -> not_found
- 민법 제750조(계약해제) -> content_mismatch
- 화관법 research resolves toward 화학물질관리법
- GET /v1/health with OC unset -> ocConfigured false, key absent from JSON

## Errors

JSON object with code and message. Missing OC or MCP-down is never HTTP 200 with empty results.

- LAW_OC_MISSING (503): message includes the 법제처 Open API OC phrase
- MCP_UNAVAILABLE (503)
- UPSTREAM_LAW_GO_KR (502): 법제처 failure, timeout, 503, antibot HTML. This is not not_found.
- NOT_FOUND (404): real miss after successful upstream
- PARTIAL (207)
- BAD_REQUEST (400)

Verify verdicts: exists, not_found, content_mismatch, repealed, unverified.
CONTENT_MISMATCH maps to content_mismatch. REPEALED maps to repealed.
Verifier did not run or extract fail maps to unverified (never exists).
Every research card has officialUrl on law.go.kr.

v1 out of scope: document_review, client fields, login, public deploy.
Logs omit request bodies and OC. Request id, tool name, and latency are fine. OC in URLs is masked.

## Endpoints

- GET /v1/health
- POST /v1/research
- POST /v1/citations/verify

Frontend types: src/types.ts and openapi.yaml
Attach korean-law-mcp locally over stdio. Never call remote MCP hosts.
Web UI local: after start open 127.0.0.1:3000 — search / and citations.html. Not Vercel.
