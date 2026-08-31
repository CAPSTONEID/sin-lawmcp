export type McpToolResult = {
  text: string;
  isError?: boolean;
};

export type McpClient = {
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
};

export type UpstreamKind = "ok" | "not_found" | "upstream" | "unavailable";
