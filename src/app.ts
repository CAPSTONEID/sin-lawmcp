import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCookieValue, serializeSessionCookie, SESSION_COOKIE, wantsSecureCookie } from "./auth/cookie.js";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { AuthStore, resolveDbPath } from "./auth/store.js";
import { ApiError, ErrorCode } from "./errors.js";
import { newRequestId, logLine } from "./logging.js";
import { openApiDocument } from "./openapi.js";
import { health, research, verifyCitations, type Gateway } from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    user?: { id: string; email: string };
  }
}

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");

const GENERIC_LOGIN_MESSAGE = "invalid email or password";

let dummyHashPromise: Promise<string> | undefined;
function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("invalid");
  return dummyHashPromise;
}

export type BuildAppOptions = {
  store?: AuthStore;
};

export async function buildApp(gw: Gateway, opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const store = opts.store ?? AuthStore.open(resolveDbPath());
  const app = Fastify({ logger: false, trustProxy: false });

  app.addHook("onRequest", async (req) => {
    req.requestId = (req.headers["x-request-id"] as string | undefined) || newRequestId();
    const sid = parseCookieValue(req.headers.cookie, SESSION_COOKIE);
    if (sid) {
      const user = store.getSession(sid);
      if (user) req.user = user;
    }
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

  app.addHook("onClose", async () => {
    if (!opts.store) store.close();
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

  function requireAuth(req: FastifyRequest): { id: string; email: string } {
    if (!req.user) {
      throw new ApiError(ErrorCode.UNAUTHENTICATED, "authentication required", 401);
    }
    return req.user;
  }

  function cookieSecure(req: FastifyRequest): boolean {
    return wantsSecureCookie({
      protocol: req.protocol,
      headers: req.headers as Record<string, unknown>,
    });
  }

  app.get("/v1/health", async () => health(gw));
  app.get("/v1/openapi.json", async () => openApiDocument);

  app.post("/v1/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      throw new ApiError(ErrorCode.BAD_REQUEST, "email and password are required", 400);
    }
    const row = store.findUserByEmail(body.email);
    const hash = row?.passwordHash ?? (await dummyPasswordHash());
    const ok = await verifyPassword(body.password, hash);
    if (!row || !ok) {
      throw new ApiError(ErrorCode.UNAUTHENTICATED, GENERIC_LOGIN_MESSAGE, 401);
    }
    const sid = store.createSession(row.id);
    reply.header("Set-Cookie", serializeSessionCookie(sid, { secure: cookieSecure(req) }));
    return reply.code(204).send();
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const sid = parseCookieValue(req.headers.cookie, SESSION_COOKIE);
    if (sid) store.revokeSession(sid);
    reply.header("Set-Cookie", serializeSessionCookie("", { secure: cookieSecure(req), clear: true }));
    return reply.code(204).send();
  });

  app.get("/v1/auth/me", async (req) => {
    const user = requireAuth(req);
    return { email: user.email };
  });

  app.post("/v1/research", async (req, reply) => {
    const user = requireAuth(req);
    const body = (req.body ?? {}) as { query?: unknown };
    if (typeof body.query !== "string") {
      throw new ApiError(ErrorCode.BAD_REQUEST, "query is required", 400);
    }
    store.insertRecord(user.id, "research", body.query);
    const result = await research(gw, body.query, req.requestId);
    return reply.send(result);
  });

  app.post("/v1/citations/verify", async (req, reply) => {
    const user = requireAuth(req);
    const body = (req.body ?? {}) as { text?: unknown };
    if (typeof body.text !== "string") {
      throw new ApiError(ErrorCode.BAD_REQUEST, "text is required", 400);
    }
    store.insertRecord(user.id, "verify", body.text);
    const result = await verifyCitations(gw, body.text, req.requestId);
    return reply.send(result);
  });

  await app.register(fastifyStatic, {
    root: webRoot,
    wildcard: false,
  });

  return app;
}
