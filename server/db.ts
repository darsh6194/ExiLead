import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { companies, jobs } from "@shared/schema";

// Initialize the database connection
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema: { companies, jobs } });

export { companies, jobs } from "@shared/schema";
