import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, ErrorCode } from "./errors.js";
import { newRequestId, logLine } from "./logging.js";
import { openApiDocument } from "./openapi.js";
import { health, research, verifyCitations, type Gateway } from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");

export async function buildApp(gw: Gateway): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: false });

  app.addHook("onRequest", async (req) => {
    req.requestId = (req.headers["x-request-id"] as string | undefined) || newRequestId();
  });

  app.addHook("onResponse", async (req, reply) => {
    logLine({
      requestId: req.requestId,
      method: req.method,
      url: req.routeOptions.url ?? req.url.split("?")[0],
      status: reply.statusCode,
      latencyMs: reply.elapsedTime,
    });
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send({ code: err.code, message: err.message });
    }
    const msg = err instanceof Error ? err.message : "internal error";
    if (/ECONNREFUSED|ENOENT|spawn|MCP/i.test(msg)) {
      return reply.status(503).send({ code: ErrorCode.MCP_UNAVAILABLE, message: "MCP server is unavailable" });
    }
    return reply.status(500).send({ code: ErrorCode.INTERNAL, message: "internal error" });
  });

  app.get("/v1/health", async () => health(gw));
  app.get("/v1/openapi.json", async () => openApiDocument);

  app.post("/v1/research", async (req, reply) => {
    const body = (req.body ?? {}) as { query?: unknown };
    if (typeof body.query !== "string") {
      throw new ApiError(ErrorCode.BAD_REQUEST, "query is required", 400);
    }
    const result = await research(gw, body.query, req.requestId);
    return reply.send(result);
  });

  app.post("/v1/citations/verify", async (req, reply) => {
    const body = (req.body ?? {}) as { text?: unknown };
    if (typeof body.text !== "string") {
      throw new ApiError(ErrorCode.BAD_REQUEST, "text is required", 400);
    }
    const result = await verifyCitations(gw, body.text, req.requestId);
    return reply.send(result);
  });

  await app.register(fastifyStatic, {
    root: webRoot,
    wildcard: false,
  });

  return app;
}
