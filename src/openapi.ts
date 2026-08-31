/** OpenAPI 3 document for the v1 HTTP API (frontend contract). */

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "sin-lawmcp",
    version: "1.1.0",
    description:
      "변호사용 한국 법령 리서치 HTTP API. 초대 발급 계정 + httpOnly 세션 쿠키. 프론트엔드는 이 HTTP API만 호출하고 MCP에 직접 접속하지 않습니다. 공개 가입 없음. LAW_OC 는 서버 env 에만 둡니다.",
  },
  servers: [{ url: "http://127.0.0.1:3000" }],
  paths: {
    "/v1/health": {
      get: {
        summary: "MCP 및 LAW_OC 설정 여부",
        security: [],
        responses: {
          "200": {
            description: "헬스. ocConfigured 는 boolean 뿐이며 키 값은 절대 포함하지 않습니다.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/v1/auth/login": {
      post: {
        summary: "로그인 (초대된 계정만). 공개 가입 없음.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "204": {
            description: "성공. Set-Cookie: sid (httpOnly, SameSite=Lax, Path=/).",
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/v1/auth/logout": {
      post: {
        summary: "로그아웃. 세션 폐기.",
        responses: {
          "204": { description: "세션 무효화. 쿠키 삭제." },
        },
      },
    },
    "/v1/auth/me": {
      get: {
        summary: "현재 세션 사용자",
        responses: {
          "200": {
            description: "로그인한 변호사 이메일",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MeResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/v1/research": {
      post: {
        summary: "법령·판례 검색 (세션 필요)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResearchRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "검색 성공 또는 부분 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ResearchResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/v1/citations/verify": {
      post: {
        summary: "조문·판례 인용 검증 (세션 필요)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "검증 결과",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "sid",
      },
    },
    responses: {
      Error: {
        description: "JSON 에러",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorBody" },
          },
        },
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      MeResponse: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
      ResearchRequest: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      ResearchCard: {
        type: "object",
        required: ["kind", "title", "citation", "summary", "officialUrl"],
        properties: {
          kind: { type: "string", enum: ["law", "precedent"] },
          title: { type: "string" },
          citation: { type: "string" },
          summary: { type: "string" },
          officialUrl: { type: "string", format: "uri" },
          id: { type: "string" },
        },
      },
      ResearchResponse: {
        type: "object",
        required: ["status", "results"],
        properties: {
          status: { type: "string", enum: ["ok", "partial"] },
          results: { type: "array", items: { $ref: "#/components/schemas/ResearchCard" } },
        },
      },
      VerifyRequest: {
        type: "object",
        required: ["text"],
        properties: { text: { type: "string" } },
      },
      VerifyItem: {
        type: "object",
        required: ["citation", "verdict"],
        properties: {
          citation: { type: "string" },
          verdict: {
            type: "string",
            enum: ["exists", "not_found", "content_mismatch", "repealed", "unverified"],
          },
          officialUrl: { type: "string", format: "uri" },
          note: { type: "string" },
        },
      },
      VerifyResponse: {
        type: "object",
        required: ["items"],
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/VerifyItem" } },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["mcp", "ocConfigured"],
        properties: {
          mcp: { type: "string", enum: ["up", "down"] },
          ocConfigured: { type: "boolean" },
        },
      },
      ErrorBody: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "LAW_OC_MISSING",
              "MCP_UNAVAILABLE",
              "UPSTREAM_LAW_GO_KR",
              "NOT_FOUND",
              "PARTIAL",
              "BAD_REQUEST",
              "INTERNAL",
              "UNAUTHENTICATED",
            ],
          },
          message: { type: "string" },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
} as const;
