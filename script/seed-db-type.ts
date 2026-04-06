import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

/** Drizzle DB instance (same shape as `db` from `server/db.ts`). */
export type SeedDb = NodePgDatabase<typeof schema>;
