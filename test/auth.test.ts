import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { inviteUser } from "../src/auth/invite.js";
import { AuthStore } from "../src/auth/store.js";
import { appOf, loginSid, MockMcp, seedUser, sidFrom } from "./helpers.js";

function cookieHeader(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  return Array.isArray(raw) ? raw.join("\n") : String(raw ?? "");
}

function leakHaystack(res: { headers: Record<string, unknown>; body: string }): string {
  return cookieHeader(res) + "\n" + res.body;
}

describe("unauthenticated gate", () => {
  it("POST research without session is 401 not 200 empty", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", () => ({ text: "법령명: 민법" }));
    mcp.tools.set("search_decisions", () => ({ text: "[NOT_FOUND]" }));
    const store = AuthStore.open(":memory:");
    const app = await buildApp({ mcp, ocConfigured: () => true }, { store });
    const res = await app.inject({
      method: "POST",
      url: "/v1/research",
      payload: { query: "민법" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.statusCode).not.toBe(200);
    const body = res.json();
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(body.message).toBeTruthy();
    expect(body.results).toBeUndefined();
    await app.close();
  });

  it("POST verify without session is 401 not 200 empty", async () => {
    const mcp = new MockMcp();
    const store = AuthStore.open(":memory:");
    const app = await buildApp({ mcp, ocConfigured: () => true }, { store });
    const res = await app.inject({
      method: "POST",
      url: "/v1/citations/verify",
      payload: { text: "민법 제750조" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHENTICATED");
    expect(res.json().items).toBeUndefined();
    await app.close();
  });
});

describe("login then research", () => {
  it("session cookie is httpOnly SameSite=Lax Path=/ and research works", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", () => ({
      text: "법령명: 화학물질관리법\nhttps://www.law.go.kr/법령/화학물질관리법",
    }));
    mcp.tools.set("search_decisions", () => ({ text: "[NOT_FOUND] 검색 결과 없음" }));
    const { app, sid, secret } = await appOf(mcp);
    const me = await app.inject({ method: "GET", url: "/v1/auth/me", cookies: { sid } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("lawyer@example.com");

    const res = await app.inject({
      method: "POST",
      url: "/v1/research",
      payload: { query: "화관법" },
      cookies: { sid },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[0].title).toContain("화학물질관리법");

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "lawyer@example.com", password: secret },
    });
    expect(login.statusCode).toBe(204);
    const setCookie = cookieHeader(login);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).not.toMatch(/LAW_OC/);
    expect(setCookie).not.toContain(secret);
    expect(login.body).not.toContain(secret);
    await app.close();
  });
});

describe("isolation", () => {
  it("A stored query is not visible to B", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", () => ({
      text: "법령명: 민법\nhttps://www.law.go.kr/법령/민법",
    }));
    mcp.tools.set("search_decisions", () => ({ text: "[NOT_FOUND] 검색 결과 없음" }));
    const store = AuthStore.open(":memory:");
    const secretA = "secret-a-ok";
    const secretB = "secret-b-ok";
    const userA = await seedUser(store, "a@example.com", secretA);
    const userB = await seedUser(store, "b@example.com", secretB);
    const app = await buildApp({ mcp, ocConfigured: () => true }, { store });
    const sidA = await loginSid(app, "a@example.com", secretA);
    const sidB = await loginSid(app, "b@example.com", secretB);

    const created = await app.inject({
      method: "POST",
      url: "/v1/research",
      payload: { query: "민법 비밀질의-A" },
      cookies: { sid: sidA },
    });
    expect(created.statusCode).toBe(200);

    const recordsA = store.listRecords(userA.id);
    const recordsB = store.listRecords(userB.id);
    expect(recordsA.some((r) => r.body.includes("비밀질의-A"))).toBe(true);
    expect(recordsB.some((r) => r.body.includes("비밀질의-A"))).toBe(false);
    expect(recordsB).toHaveLength(0);

    const meB = await app.inject({ method: "GET", url: "/v1/auth/me", cookies: { sid: sidB } });
    expect(meB.json().email).toBe("b@example.com");
    expect(JSON.stringify(meB.json())).not.toContain("비밀질의-A");
    await app.close();
  });
});

describe("logout", () => {
  it("old cookie is rejected after logout", async () => {
    const mcp = new MockMcp();
    mcp.tools.set("search_law", () => ({
      text: "법령명: 민법\nhttps://www.law.go.kr/법령/민법",
    }));
    mcp.tools.set("search_decisions", () => ({ text: "[NOT_FOUND] 검색 결과 없음" }));
    const { app, sid } = await appOf(mcp);
    const out = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      cookies: { sid },
    });
    expect(out.statusCode).toBe(204);

    const res = await app.inject({
      method: "POST",
      url: "/v1/research",
      payload: { query: "민법" },
      cookies: { sid },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHENTICATED");
    await app.close();
  });
});

describe("secrets stay off the wire", () => {
  it("responses and set-cookie never contain LAW_OC or the raw secret", async () => {
    const mcp = new MockMcp();
    const { app, sid, secret } = await appOf(mcp, false);
    process.env.LAW_OC = "oc-must-not-leak";
    try {
      const health = await app.inject({ method: "GET", url: "/v1/health" });
      expect(leakHaystack(health)).not.toMatch(/LAW_OC/);
      expect(leakHaystack(health)).not.toContain("oc-must-not-leak");
      expect(leakHaystack(health)).not.toContain(secret);

      const me = await app.inject({ method: "GET", url: "/v1/auth/me", cookies: { sid } });
      expect(leakHaystack(me)).not.toMatch(/LAW_OC/);
      expect(leakHaystack(me)).not.toContain(secret);

      const bad = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: "lawyer@example.com", password: "wrong-secret" },
      });
      expect(bad.statusCode).toBe(401);
      expect(bad.json().message).toBe("invalid email or password");
      expect(leakHaystack(bad)).not.toContain("wrong-secret");
      expect(leakHaystack(bad)).not.toContain(secret);
      expect(leakHaystack(bad)).not.toMatch(/LAW_OC/);
    } finally {
      delete process.env.LAW_OC;
      await app.close();
    }
  });

  it("unknown email uses the same generic login message", async () => {
    const mcp = new MockMcp();
    const { app } = await appOf(mcp);
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "nobody@example.com", password: "anything" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHENTICATED");
    expect(res.json().message).toBe("invalid email or password");
    await app.close();
  });
});

describe("no shared-password or signup routes", () => {
  it("has no shared-password or public signup endpoint", async () => {
    const mcp = new MockMcp();
    const { app } = await appOf(mcp);
    for (const url of ["/v1/auth/register", "/v1/signup", "/v1/auth/shared", "/v1/auth/password"]) {
      const res = await app.inject({ method: "POST", url, payload: {} });
      expect(res.statusCode).toBeGreaterThanOrEqual(404);
      expect(res.statusCode).not.toBe(200);
      expect(res.statusCode).not.toBe(204);
    }
    await app.close();
  });
});

describe("invite", () => {
  it("creates a hashed user and printed secret can log in", async () => {
    const store = AuthStore.open(":memory:");
    const created = await inviteUser(store, "invited@example.com");
    expect(created.email).toBe("invited@example.com");
    expect(created.password.length).toBeGreaterThan(8);
    const row = store.findUserByEmail(created.email);
    expect(row?.passwordHash).toMatch(/^scrypt\$/);
    expect(row?.passwordHash).not.toContain(created.password);

    const mcp = new MockMcp();
    const app = await buildApp({ mcp, ocConfigured: () => true }, { store });
    const sid = await loginSid(app, created.email, created.password);
    expect(sid.length).toBeGreaterThan(10);
    await app.close();
  });

  it("CLI prints the one-time secret to stdout only", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "lawmcp-"));
    const dbPath = path.join(dir, "app.db");
    const result = spawnSync(
      process.execPath,
      [path.join("node_modules", "tsx", "dist", "cli.mjs"), "src/cli/invite.ts", "cli@example.com"],
      {
        cwd: path.join(import.meta.dirname, ".."),
        encoding: "utf8",
        env: { ...process.env, AUTH_DB: dbPath },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/one-time password:/);
    expect(result.stderr).not.toMatch(/one-time password:/);
    const printed = result.stdout.match(/one-time password:\s+(\S+)/)?.[1];
    expect(printed).toBeTruthy();
  });
});

describe("production cookie flag", () => {
  it("sets Secure when NODE_ENV is production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const mcp = new MockMcp();
      const { app, secret } = await appOf(mcp);
      const login = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: "lawyer@example.com", password: secret },
      });
      expect(cookieHeader(login)).toMatch(/Secure/);
      expect(sidFrom(login.headers["set-cookie"]).length).toBeGreaterThan(10);
      await app.close();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
