import { Pool } from 'pg';

const setupSchedulerDatabase = async () => {
  // Connect directly to the scheduler database since it already exists
  const schedulerPool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/exilead_scheduler'
  });

  try {
    console.log('Connecting to scheduler database...');
    
    // First, check what tables already exist
    const existingTables = await schedulerPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Existing tables in scheduler database:');
    existingTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check if our required tables exist
    const tableNames = existingTables.rows.map(row => row.table_name);
    const hasConfigTable = tableNames.includes('scheduler_config');
    const hasRunsTable = tableNames.includes('scheduler_runs');
    
    console.log(`\nScheduler config table exists: ${hasConfigTable}`);
    console.log(`Scheduler runs table exists: ${hasRunsTable}`);
    
    if (hasConfigTable && hasRunsTable) {
      console.log('\nChecking existing data...');
      
      // Check scheduler_config data
      const configData = await schedulerPool.query('SELECT * FROM scheduler_config');
      console.log(`Config records: ${configData.rows.length}`);
      if (configData.rows.length > 0) {
        console.log('Config data:');
        configData.rows.forEach(row => {
          console.log(`  - ${row.job_name}: ${row.cron_pattern} (enabled: ${row.enabled})`);
        });
      }
      
      // Check scheduler_runs data
      const runsData = await schedulerPool.query('SELECT COUNT(*) as count FROM scheduler_runs');
      console.log(`\nRuns records: ${runsData.rows[0].count}`);
      
      // Get latest runs
      const latestRuns = await schedulerPool.query(`
        SELECT job_name, status, started_at, duration_seconds, jobs_saved, companies_processed 
        FROM scheduler_runs 
        ORDER BY started_at DESC 
        LIMIT 5
      `);
      
      if (latestRuns.rows.length > 0) {
        console.log('Latest runs:');
        latestRuns.rows.forEach(row => {
          console.log(`  - ${row.job_name}: ${row.status} at ${row.started_at} (${row.jobs_saved} jobs)`);
        });
      }
      
      console.log('\nScheduler database is already set up and has data!');
      return;
    }
    
    // Create scheduler_config table
    await schedulerPool.query(`
      CREATE TABLE IF NOT EXISTS scheduler_config (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(255) NOT NULL UNIQUE,
        cron_pattern VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        next_run TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create scheduler_runs table
    await schedulerPool.query(`
      CREATE TABLE IF NOT EXISTS scheduler_runs (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'running',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        finished_at TIMESTAMP WITH TIME ZONE,
        duration_seconds INTEGER,
        jobs_saved INTEGER DEFAULT 0,
        companies_processed INTEGER DEFAULT 0,
        error_message TEXT,
        output_log TEXT
      )
    `);

    // Insert default configuration for the scraper
    await schedulerPool.query(`
      INSERT INTO scheduler_config (job_name, cron_pattern, enabled, next_run)
      VALUES ('exilead_scraper', '0 0 */14 * *', true, NOW() + INTERVAL '14 days')
      ON CONFLICT (job_name) DO NOTHING
    `);

    // Insert a sample run for testing
    await schedulerPool.query(`
      INSERT INTO scheduler_runs (job_name, status, started_at, finished_at, duration_seconds, jobs_saved, companies_processed)
      VALUES (
        'exilead_scraper', 
        'success', 
        NOW() - INTERVAL '1 day', 
        NOW() - INTERVAL '1 day' + INTERVAL '23 minutes', 
        1380, 
        136, 
        50
      )
      ON CONFLICT DO NOTHING
    `);

    console.log('Scheduler tables created successfully');
    console.log('Sample data inserted');
    
  } catch (error) {
    console.error('Error setting up scheduler database:', error.message);
  } finally {
    await schedulerPool.end();
  }
};

setupSchedulerDatabase().catch(console.error);
