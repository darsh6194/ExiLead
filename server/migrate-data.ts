// Load environment variables from .env file FIRST
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manual .env loading for migration script
try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  const envVars = envFile.split('\n').filter(line => line.includes('='));
  
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
  
  console.log('Environment variables loaded from .env file');
} catch (error) {
  console.log('No .env file found or error reading it. Using system environment variables.');
}

async function migrateData() {
  try {
    console.log("Starting data migration from JSON to PostgreSQL...");
    
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL environment variable is required");
      console.error("Please create a .env file with DATABASE_URL or set it as an environment variable");
      console.error("Example: DATABASE_URL=postgresql://username:password@host:port/database");
      process.exit(1);
    }
    
    console.log("✅ Database URL found:", process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));
    console.log("🔄 Testing database connection...");
    
    // Now import the storage after environment variables are loaded
    const { storage } = await import("./database-storage.js");
    
    // Test the connection first
    try {
      await storage.getCompanies();
      console.log("✅ Database connection successful");
    } catch (error) {
      console.error("❌ Database connection failed:", error instanceof Error ? error.message : String(error));
      console.error("\n🔧 Troubleshooting tips:");
      console.error("1. Make sure PostgreSQL server is running");
      console.error("2. Verify database exists (create it if needed)");
      console.error("3. Check username/password are correct");
      console.error("4. Run 'npm run db:push' to create tables first");
      process.exit(1);
    }
    
    console.log("🚀 Proceeding with migration...");
    await storage.loadDataFromJson();
    
    console.log("✅ Data migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateData();
