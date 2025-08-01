import { db, companies, jobs } from "./db-local";
import fs from 'fs';
import path from 'path';

// Manual environment loading
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

async function setupDatabase() {
  console.log('Setting up database schema...');
  
  try {
    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100) NOT NULL,
        website VARCHAR(500),
        description TEXT,
        logo VARCHAR(500),
        job_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Companies table created/verified');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        title VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        employment_type VARCHAR(50),
        work_mode VARCHAR(50),
        category VARCHAR(100),
        is_technical VARCHAR(20),
        description TEXT,
        requirements TEXT[],
        benefits TEXT[],
        skills TEXT[],
        apply_link VARCHAR(500),
        source_url VARCHAR(500),
        posted_date VARCHAR(100),
        deadline VARCHAR(100),
        salary VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Jobs table created/verified');

    // Test the connection by selecting from tables
    const companyCount = await db.select().from(companies);
    const jobCount = await db.select().from(jobs);
    
    console.log(`✅ Database setup complete!`);
    console.log(`   Companies: ${companyCount.length}`);
    console.log(`   Jobs: ${jobCount.length}`);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

setupDatabase().catch(console.error);
