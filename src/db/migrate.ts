import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

/** drizzle/ 配下のマイグレーションを DB に適用する（何度実行しても安全） */
export function runMigrations() {
  migrate(db, { migrationsFolder: "drizzle" });
}
