import postgres from "postgres";
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

const sql = postgres(process.env.DATABASE_URL);

async function clearDatabase() {
  try {
    console.log('Clearing database...');
    await sql`DELETE FROM jobs`;
    await sql`DELETE FROM companies`;
    console.log('Database cleared successfully');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    await sql.end();
    process.exit(1);
  }
}

clearDatabase();
