import { randomUUID } from "node:crypto";
import { maskSecrets } from "./errors.js";

export function newRequestId(): string {
  return randomUUID();
}

export function logLine(fields: Record<string, unknown>): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === "body" || k === "query" || k === "text" || k === "LAW_OC") continue;
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
