// Interactive database setup with password prompt
const { Client } = require('pg');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗄️ EXILEAD SCHEDULER DATABASE SETUP');
console.log('=' .repeat(50));

async function promptPassword() {
  return new Promise((resolve) => {
    rl.question('Enter PostgreSQL password for user "postgres": ', (password) => {
      resolve(password);
    });
  });
}

async function setupWithPassword() {
  try {
    const password = await promptPassword();
    rl.close();
    
    // Update .env file with the provided password
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    const newDatabaseUrl = `postgresql://postgres:${password}@localhost:5432/exilead_scheduler`;
    envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=${newDatabaseUrl}`);
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env with database credentials');
    
    // Test connection and setup database
    const client = new Client({
      connectionString: newDatabaseUrl
    });
    
    console.log('🔌 Testing database connection...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');
    
    // Create scheduler tables
    console.log('📋 Creating scheduler tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduler_config (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(100) UNIQUE NOT NULL,
        cron_pattern VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_run TIMESTAMP,
        next_run TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduler_runs (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(100) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'running',
        jobs_saved INTEGER DEFAULT 0,
        companies_processed INTEGER DEFAULT 0,
        error_message TEXT,
        duration_seconds INTEGER
      );
    `);
    
    // Insert default configuration
    await client.query(`
      INSERT INTO scheduler_config (job_name, cron_pattern, enabled)
      VALUES ('exilead_scraper', '0 0 */14 * *', true)
      ON CONFLICT (job_name) DO NOTHING;
    `);
    
    await client.end();
    
    console.log('✅ Database setup completed successfully!');
    console.log('📊 Default schedule: Every 2 weeks (0 0 */14 * *)');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('  1. Start the worker: npm run worker');
    console.log('  2. Start the scheduler: npm start');
    console.log('  3. Or run a job now: node schedule-job.js now');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Also support non-interactive mode if password is provided as argument
const password = process.argv[2];
if (password) {
  console.log('🔑 Using provided password...');
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  const newDatabaseUrl = `postgresql://postgres:${password}@localhost:5432/exilead_scheduler`;
  envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=${newDatabaseUrl}`);
  fs.writeFileSync(envPath, envContent);
  
  // Run setup with the provided password
  setupWithPassword().then(() => {
    console.log('✅ Non-interactive setup completed!');
  }).catch(console.error);
} else {
  // Interactive mode
  setupWithPassword();
}
