import postgres from "postgres";
import fs from 'fs';
import path from 'path';

// Manual environment loading (same as migrate-data.ts)
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

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
  
  try {
    // Test connection with environment variable
    const sql = postgres(process.env.DATABASE_URL!);
    
    // Simple test query
    const result = await sql`SELECT version()`;
    console.log('✅ Connection successful!');
    console.log('PostgreSQL version:', result[0].version);
    
    // Test if ExiLead database exists
    const databases = await sql`SELECT datname FROM pg_database WHERE datname = 'ExiLead'`;
    if (databases.length > 0) {
      console.log('✅ ExiLead database exists');
    } else {
      console.log('❌ ExiLead database not found');
    }
    
    await sql.end();
  } catch (error) {
    console.error('❌ Connection failed:', error);
    
    // Try alternative connection strings
    console.log('\nTrying alternative connection methods...');
    
    const alternatives = [
      'postgresql://postgres:postgres@localhost:5432/ExiLead',
      'postgresql://postgres:@localhost:5432/ExiLead',
      'postgresql://postgres@localhost:5432/ExiLead'
    ];
    
    for (const url of alternatives) {
      try {
        console.log(`Testing: ${url.replace(/:[^:]*@/, ':****@')}`);
        const testSql = postgres(url);
        await testSql`SELECT 1`;
        console.log('✅ This connection works!');
        console.log(`Use this in your .env: DATABASE_URL=${url}`);
        await testSql.end();
        break;
      } catch (altError) {
        console.log('❌ Failed');
      }
    }
  }
}

testConnection().catch(console.error);
