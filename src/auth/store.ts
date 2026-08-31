import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SESSION_TTL_SECONDS } from "./cookie.js";

export const DEFAULT_DB_PATH = path.join("data", "app.db");

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.AUTH_DB?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_DB_PATH;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthUser = { id: string; email: string };

export class AuthStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrate();
  }

  static open(dbPath: string): AuthStore {
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return new AuthStore(db);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);
    const cols = this.db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "expires_at")) {
      this.db.exec("ALTER TABLE sessions ADD COLUMN expires_at TEXT");
      const rows = this.db.prepare("SELECT id, created_at FROM sessions").all() as Array<{
        id: string;
        created_at: string;
      }>;
      const ttlMs = SESSION_TTL_SECONDS * 1000;
      const upd = this.db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?");
      for (const row of rows) {
        const start = Date.parse(row.created_at);
        const expires = new Date((Number.isFinite(start) ? start : Date.now()) + ttlMs).toISOString();
        upd.run(expires, row.id);
      }
    }
    this.db.exec("DROP TABLE IF EXISTS records");
  }

  createUser(email: string, passwordHash: string): AuthUser {
    const id = randomUUID();
    const normalized = normalizeEmail(email);
    const createdAt = new Date().toISOString();
    this.db
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(id, normalized, passwordHash, createdAt);
    return { id, email: normalized };
  }

  findUserByEmail(email: string): { id: string; email: string; passwordHash: string } | undefined {
    return this.db
      .prepare("SELECT id, email, password_hash AS passwordHash FROM users WHERE email = ?")
      .get(normalizeEmail(email)) as { id: string; email: string; passwordHash: string } | undefined;
  }

  createSession(userId: string, ttlSeconds: number = SESSION_TTL_SECONDS): string {
    const id = randomBytes(32).toString("base64url");
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
    this.db
      .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(id, userId, createdAt, expiresAt);
    return id;
  }

  getSession(sessionId: string): AuthUser | undefined {
    if (!sessionId) return undefined;
    const now = new Date().toISOString();
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    return this.db
      .prepare(
        `SELECT u.id AS id, u.email AS email
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(sessionId, now) as AuthUser | undefined;
  }

  revokeSession(sessionId: string): void {
    if (!sessionId) return;
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  /** Test helper: true if needle appears in any stored row. */
  containsText(needle: string): boolean {
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
      name: string;
    }>;
    for (const table of tables) {
      if (!/^[a-z_]+$/i.test(table.name)) continue;
      const rows = this.db.prepare(`SELECT * FROM ${table.name}`).all();
      if (JSON.stringify(rows).includes(needle)) return true;
    }
    return false;
  }

  close(): void {
    this.db.close();
  }
}
