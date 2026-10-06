import path from "node:path";
import { migrate as migrateLibsql } from "drizzle-orm/libsql/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import type { DbState } from "./index";

export async function runMigrations({ db, dialect }: DbState) {
  const folder = path.resolve(process.cwd(), "drizzle", dialect);
  if (dialect === "pg") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePg(db as any, { migrationsFolder: folder });
  } else {
    await migrateLibsql(db, { migrationsFolder: folder });
  }
}
