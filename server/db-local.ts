import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { companies, jobs } from "@shared/schema";
import fs from 'fs';
import path from 'path';

// Manual environment loading to ensure DATABASE_URL is available
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  });
}

// Initialize the database connection for local PostgreSQL
const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema: { companies, jobs } });

export { companies, jobs } from "@shared/schema";
