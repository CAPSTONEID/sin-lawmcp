import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpClient, McpToolResult } from "./types.js";

const FORBIDDEN_HOST = "mcp.gomdori.app";

function resolveCommand(): { command: string; args: string[] } {
  const override = process.env.MCP_COMMAND?.trim();
  if (override) {
    const parts = override.split(/\s+/);
    return { command: parts[0]!, args: parts.slice(1) };
  }
  const localBin = path.join(process.cwd(), "node_modules", ".bin", "korean-law-mcp");
  if (existsSync(localBin)) return { command: localBin, args: [] };
  return {
    command: "npx",
    args: ["-y", "--ignore-scripts", "--omit=optional", "korean-law-mcp"],
  };
}

function childEnv(): Record<string, string> {
  const env: Record<string, string> = { ...getDefaultEnvironment() };
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.LAW_OC?.trim()) env.LAW_OC = process.env.LAW_OC.trim();
  env.MCP_HTTP_HOST = "127.0.0.1";
  return env;
}

function textOf(result: { content?: unknown; isError?: boolean }): McpToolResult {
  const parts: string[] = [];
  const content = Array.isArray(result.content) ? result.content : [];
  for (const c of content) {
    if (c && typeof c === "object" && (c as { type?: string }).type === "text") {
      parts.push(String((c as { text?: string }).text ?? ""));
    }
  }
  return { text: parts.join("\n"), isError: Boolean(result.isError) };
}

export class StdioKoreanLawMcp implements McpClient {
  private client: Client | undefined;
  private transport: StdioClientTransport | undefined;
  private connecting: Promise<void> | undefined;

  async ping(): Promise<boolean> {
    try {
      await this.ensure();
      await this.client!.listTools();
      return true;
    } catch {
      await this.safeClose();
      return false;
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    await this.ensure();
    const result = await this.client!.callTool({ name, arguments: args });
    return textOf(result as { content?: unknown; isError?: boolean });
  }

  async close(): Promise<void> {
    await this.safeClose();
  }

  private async ensure(): Promise<void> {
    if (this.client) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.connect();
    try {
      await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  private async connect(): Promise<void> {
    const { command, args } = resolveCommand();
    if ([command, ...args].some((s) => s.includes(FORBIDDEN_HOST))) {
      throw new Error("MCP_UNAVAILABLE: remote host is not allowed");
    }
    const transport = new StdioClientTransport({
      command,
      args,
      env: childEnv(),
      stderr: "pipe",
    });
    const client = new Client({ name: "sin-lawmcp", version: "1.0.0" });
    await client.connect(transport);
    this.transport = transport;
    this.client = client;
  }

  private async safeClose(): Promise<void> {
    const client = this.client;
    const transport = this.transport;
    this.client = undefined;
    this.transport = undefined;
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
    try {
      await transport?.close();
    } catch {
      /* ignore */
    }
  }
}
