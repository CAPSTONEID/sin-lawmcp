import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const DEFAULT_DB_PATH = path.join("data", "app.db");

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.AUTH_DB?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_DB_PATH;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthUser = { id: string; email: string };

export type StoredRecord = {
  id: string;
  userId: string;
  kind: "research" | "verify";
  body: string;
  createdAt: string;
};

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
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS records_user_id ON records(user_id);
    `);
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

  createSession(userId: string): string {
    const id = randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)")
      .run(id, userId, new Date().toISOString());
    return id;
  }

  getSession(sessionId: string): AuthUser | undefined {
    if (!sessionId) return undefined;
    return this.db
      .prepare(
        `SELECT u.id AS id, u.email AS email
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`,
      )
      .get(sessionId) as AuthUser | undefined;
  }

  revokeSession(sessionId: string): void {
    if (!sessionId) return;
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  insertRecord(userId: string, kind: "research" | "verify", body: string): void {
    this.db
      .prepare("INSERT INTO records (id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), userId, kind, body, new Date().toISOString());
  }

  listRecords(userId: string): StoredRecord[] {
    return this.db
      .prepare(
        "SELECT id, user_id AS userId, kind, body, created_at AS createdAt FROM records WHERE user_id = ? ORDER BY created_at ASC",
      )
      .all(userId) as StoredRecord[];
  }

  close(): void {
    this.db.close();
  }
}
