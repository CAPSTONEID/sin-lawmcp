/** OpenAPI 3 document for the v1 HTTP API (frontend contract). */

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "sin-lawmcp",
    version: "1.0.0",
    description:
      "변호사용 한국 법령 리서치 HTTP API. 프론트엔드는 이 HTTP API만 호출하고 MCP에 직접 접속하지 않습니다.",
  },
  servers: [{ url: "http://127.0.0.1:3000" }],
  paths: {
    "/v1/health": {
      get: {
        summary: "MCP 및 LAW_OC 설정 여부",
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
    "/v1/research": {
      post: {
        summary: "법령·판례 검색",
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
          "404": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/v1/citations/verify": {
      post: {
        summary: "조문·판례 인용 검증",
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
          "502": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
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
            ],
          },
          message: { type: "string" },
        },
      },
    },
  },
} as const;
