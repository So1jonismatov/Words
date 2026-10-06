import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as sqliteSchema from "./schema.sqlite";
import * as pgSchema from "./schema.pg";

/**
 * App code is written against the SQLite table types. At runtime the Postgres tables
 * (same column names and JS types, see schema.pg.ts) are swapped in when DATABASE_URL
 * points at Postgres. Only the portable Drizzle query builder is used, never
 * dialect-specific helpers such as `.get()`/`.all()`/`.run()`.
 */
export type Tables = typeof sqliteSchema;
export type Database = LibSQLDatabase<typeof sqliteSchema>;
export type Dialect = "sqlite" | "pg";

export interface DbState {
  db: Database;
  t: Tables;
  dialect: Dialect;
}

const DEFAULT_URL = "file:./data/local.db";

export function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || DEFAULT_URL;
}

export function dialectFor(url: string): Dialect {
  return /^postgres(ql)?:\/\//i.test(url) ? "pg" : "sqlite";
}

function createFromEnv(): DbState {
  const url = databaseUrl();
  if (dialectFor(url) === "pg") {
    const client = postgres(url, { max: 5, prepare: false });
    return {
      db: drizzlePg(client, { schema: pgSchema }) as unknown as Database,
      t: pgSchema as unknown as Tables,
      dialect: "pg",
    };
  }
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    if (file && !file.startsWith(":")) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  // Foreign keys are per-connection in SQLite; we also delete child rows explicitly.
  void client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  return { db: drizzleLibsql(client, { schema: sqliteSchema }), t: sqliteSchema, dialect: "sqlite" };
}

const globalForDb = globalThis as unknown as { __mxDb?: DbState & { schema?: unknown; injected?: boolean } };

export function getDb(): DbState {
  const cached = globalForDb.__mxDb;
  // The state lives on globalThis so dev hot reloads don't open new connections. When a
  // reload brings a changed schema module (e.g. a new table), rebuild the state so `t`
  // never points at stale table objects.
  if (!cached || (!cached.injected && cached.schema !== sqliteSchema)) {
    globalForDb.__mxDb = { ...createFromEnv(), schema: sqliteSchema };
  }
  return globalForDb.__mxDb!;
}

/** Tests inject an in-memory database (libSQL or PGlite). */
export function setDbForTests(state: DbState) {
  globalForDb.__mxDb = { ...state, injected: true };
}
