// Graphile Worker with built-in cron support
const { run, parseCrontab } = require('graphile-worker');
const tasks = require('./tasks');
require('dotenv').config();

// Define cron jobs in crontab format
const crontab = `
# ExiLead Automated Scraper - Every 2 weeks at midnight
0 0 */14 * * runExileadScraper

# Health Check - Every hour
0 * * * * healthCheck
`;

async function startWorkerWithCron() {
  console.log('🔧 STARTING GRAPHILE WORKER WITH CRON');
  console.log('=' .repeat(60));
  console.log(`Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`Worker PID: ${process.pid}`);
  
  // Parse cron jobs
  console.log('📅 Parsing cron jobs...');
  const cronItems = parseCrontab(crontab);
  console.log(`✅ Found ${cronItems.length} cron jobs:`);
  cronItems.forEach(item => {
    console.log(`  🔄 ${item.task}: ${item.pattern}`);
  });
  
  console.log('=' .repeat(60));

  const runner = await run({
    connectionString: process.env.DATABASE_URL,
    taskList: tasks,
    crontab: crontab,              // Enable cron jobs
    concurrency: 1,                // Run one job at a time
    noHandleSignals: false,
    pollInterval: 5000,            // Check for jobs every 5 seconds
    maxPoolSize: 10,
  });

  console.log('✅ Worker with cron started successfully');
  console.log('🔄 Listening for jobs and cron triggers...');
  console.log('📋 Available tasks:');
  console.log('  - runExileadScraper: Runs the automated pipeline');
  console.log('  - healthCheck: System health verification');
  console.log('📅 Cron Schedule:');
  console.log('  - Scraper: Every 2 weeks (0 0 */14 * *)');
  console.log('  - Health Check: Every hour (0 * * * *)');
  console.log('=' .repeat(60));

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down worker...');
    await runner.stop();
    console.log('✅ Worker stopped gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down worker...');
    await runner.stop();
    console.log('✅ Worker stopped gracefully');
    process.exit(0);
  });

  return runner;
}

if (require.main === module) {
  startWorkerWithCron().catch((error) => {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  });
}

module.exports = { startWorkerWithCron };
