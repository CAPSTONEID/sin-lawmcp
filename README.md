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

## Access control

Per-lawyer accounts. No shared password. No public signup.

Invite a lawyer with the invite script in package.json. The one-time secret prints once to stdout and is not logged.

Run the invite script from package.json.

POST /v1/auth/login JSON body sets an httpOnly session cookie (sid, SameSite=Lax, Path=/; Secure when NODE_ENV=production or https).
POST /v1/auth/logout revokes that session. GET /v1/auth/me returns { email }.

POST /v1/research and POST /v1/citations/verify require the session cookie. Unauthenticated calls return 401 { code: "UNAUTHENTICATED", message } — never HTTP 200 empty results.

Queries and verify text are stored per account in local SQLite (data/app.db, gitignored). Lawyer B cannot read lawyer A.

LAW_OC stays in server env only. It is never in responses, cookies, or the frontend.

GET /v1/health and the static web UI (GET /) stay public. Login page comes from the frontend.

Do not deploy to Vercel/Pages. A public URL is not supported without this access-control gate. Bind still defaults to 127.0.0.1.

## Test

Use the test script in package.json. MCP is mocked. No live OC is required.

- 민법 제750조 -> exists
- 형법 제9999조 -> not_found
- 민법 제750조(계약해제) -> content_mismatch
- 화관법 research resolves toward 화학물질관리법
- GET /v1/health with OC unset -> ocConfigured false, key absent from JSON

## Errors

JSON object with code and message. Missing OC or MCP-down is never HTTP 200 with empty results.

- UNAUTHENTICATED (401): missing/invalid session, or failed login (generic message, no user enumeration)
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

v1 out of scope: document_review, client fields, public deploy.
Logs omit request bodies (query, login secret, verify text) and OC. Request id, tool name, and latency are fine. OC in URLs is masked.

## Endpoints

- GET /v1/health (public)
- POST /v1/auth/login
- POST /v1/auth/logout
- GET /v1/auth/me
- POST /v1/research (session required)
- POST /v1/citations/verify (session required)

Frontend types: src/types.ts and openapi.json
Attach korean-law-mcp locally over stdio. Never call remote MCP hosts.
Web UI local: after start open 127.0.0.1:3000 — search / and citations.html. Not Vercel.
