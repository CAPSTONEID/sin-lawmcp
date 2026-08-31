import { randomUUID } from "node:crypto";
import { maskSecrets } from "./errors.js";

const SKIP = new Set([
  "body",
  "query",
  "text",
  "LAW_OC",
  "password",
  "cookie",
  "authorization",
]);

export function newRequestId(): string {
  return randomUUID();
}

export function logLine(fields: Record<string, unknown>): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SKIP.has(k)) continue;
    safe[k] = typeof v === "string" ? maskSecrets(v) : v;
  }
  process.stderr.write(JSON.stringify(safe) + "\n");
}

export function logToolCall(input: {
  requestId: string;
  tool: string;
  latencyMs: number;
  upstreamStatus: string;
}): void {
  logLine({
    requestId: input.requestId,
    tool: input.tool,
    latencyMs: input.latencyMs,
    upstreamStatus: input.upstreamStatus,
  });
}
