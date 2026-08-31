import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { AuthStore } from "../src/auth/store.js";
import type { McpClient, McpToolResult } from "../src/mcp/types.js";

export class MockMcp implements McpClient {
  pingOk = true;
  tools = new Map<string, (args: Record<string, unknown>) => McpToolResult | Promise<McpToolResult>>();
  failConnect = false;
  async ping(): Promise<boolean> {
    if (this.failConnect) throw new Error("spawn ENOENT");
    return this.pingOk;
  }
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (this.failConnect) throw new Error("spawn ENOENT");
    const fn = this.tools.get(name);
    if (!fn) throw new Error("unknown tool " + name);
    return fn(args);
  }
  async close(): Promise<void> {}
}

export function sidFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const m = String(header ?? "").match(/(?:^|,\s*)sid=([^;]*)/);
  if (!m) throw new Error("missing sid cookie");
  return m[1];
}

export async function seedUser(store: AuthStore, email: string, secret: string) {
  return store.createUser(email, await hashPassword(secret));
}

export async function loginSid(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  secret: string,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: secret },
  });
  if (res.statusCode !== 204) {
    throw new Error("login failed " + res.statusCode + " " + res.body);
  }
  return sidFrom(res.headers["set-cookie"]);
}

export async function appOf(mcp: MockMcp, oc = true) {
  const store = AuthStore.open(":memory:");
  const secret = "test-secret-ok";
  const user = await seedUser(store, "lawyer@example.com", secret);
  const app = await buildApp({ mcp, ocConfigured: () => oc }, { store });
  const sid = await loginSid(app, "lawyer@example.com", secret);
  return { app, store, sid, user, secret };
}
