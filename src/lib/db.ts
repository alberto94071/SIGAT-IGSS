import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const neonSql = neon(process.env.DATABASE_URL!);
export const db = drizzle(neonSql, { schema });

export { sql };
