#!/usr/bin/env node

// Manual pipeline runner for testing the two-step process
const { Client } = require('pg');
const { run } = require('graphile-worker');

async function runScrapingPipeline() {
  console.log('🚀 STARTING EXILEAD SCRAPING PIPELINE');
  console.log('=' .repeat(60));
  console.log('This will run the pipeline in two steps:');
  console.log('  Step 1: runFinalScraper - Scrape jobs and save to JSON');
  console.log('  Step 2: runDatabasePipeline - Save JSON results to database');
  console.log('=' .repeat(60));

  try {
    // Database connection for Graphile Worker
    const workerDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exilead_scheduler';
    
    console.log(`🗄️ Connecting to worker database: ${workerDbUrl.replace(/password=[^@]+/, 'password=***')}`);
    
    // Start the worker runner
    const tasks = require('./tasks.js');
    const runner = await run({
      connectionString: workerDbUrl,
      concurrency: 1,
      taskList: tasks
      // No crontab for manual runs
    });

    console.log('🔧 Worker runner started');
    
    // Connect to database to queue jobs
    const client = new Client({ connectionString: workerDbUrl });
    await client.connect();
    
    console.log('📋 Queueing Final_Scraper job...');
    
    // Queue the first job (Final_Scraper)
    await client.query(`
      SELECT graphile_worker.add_job(
        'runFinalScraper',
        $1::json,
        max_attempts => 3
      )
    `, [JSON.stringify({
      companies_file: process.argv[2] || null // Optional companies file
    })]);
    
    console.log('✅ Final_Scraper job queued successfully!');
    console.log('📊 The database pipeline job will be automatically queued after scraping completes');
    console.log('');
    console.log('👀 Watch the logs above for real-time progress...');
    console.log('');
    console.log('ℹ️  Press Ctrl+C to stop watching (jobs will continue in background)');
    
    // Keep the runner alive to process jobs
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping worker runner...');
      await runner.stop();
      await client.end();
      console.log('✅ Runner stopped gracefully');
      process.exit(0);
    });
    
    // Wait indefinitely (until Ctrl+C)
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  }
}

async function queueJobOnly() {
  console.log('📋 QUEUEING SCRAPING PIPELINE JOB');
  console.log('=' .repeat(40));
  
  try {
    const workerDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exilead_scheduler';
    const client = new Client({ connectionString: workerDbUrl });
    await client.connect();
    
    console.log('📋 Queueing Final_Scraper job...');
    
    await client.query(`
      SELECT graphile_worker.add_job(
        'runFinalScraper',
        $1::json,
        max_attempts => 3
      )
    `, [JSON.stringify({
      companies_file: process.argv[3] || null
    })]);
    
    console.log('✅ Job queued successfully!');
    console.log('💡 Make sure a worker is running to process the job:');
    console.log('   node worker.js');
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Failed to queue job:', error);
    process.exit(1);
  }
}

async function showStatus() {
  console.log('📊 PIPELINE STATUS');
  console.log('=' .repeat(30));
  
  try {
    const workerDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exilead_scheduler';
    const client = new Client({ connectionString: workerDbUrl });
    await client.connect();
    
    // Check recent jobs
    const recentJobs = await client.query(`
      SELECT 
        job_name,
        status,
        started_at,
        finished_at,
        error_message,
        jobs_saved,
        total_jobs_processed
      FROM scheduler_runs 
      WHERE started_at > NOW() - INTERVAL '24 hours'
      ORDER BY started_at DESC 
      LIMIT 10
    `);
    
    console.log(`📋 Recent jobs (last 24 hours): ${recentJobs.rows.length}`);
    console.log('');
    
    for (const job of recentJobs.rows) {
      const duration = job.finished_at 
        ? `${Math.round((new Date(job.finished_at) - new Date(job.started_at)) / 1000)}s`
        : 'running...';
      
      const statusIcon = job.status === 'success' ? '✅' : job.status === 'error' ? '❌' : '🔄';
      
      console.log(`${statusIcon} ${job.job_name}`);
      console.log(`   Started: ${new Date(job.started_at).toLocaleString()}`);
      console.log(`   Status: ${job.status} (${duration})`);
      
      if (job.jobs_saved) {
        console.log(`   Jobs Saved: ${job.jobs_saved}`);
      }
      
      if (job.total_jobs_processed) {
        console.log(`   Total Processed: ${job.total_jobs_processed}`);
      }
      
      if (job.error_message) {
        console.log(`   Error: ${job.error_message.substring(0, 100)}...`);
      }
      
      console.log('');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Failed to get status:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'run') {
  runScrapingPipeline();
} else if (command === 'queue') {
  queueJobOnly();
} else if (command === 'status') {
  showStatus();
} else {
  console.log('🔧 ExiLead Pipeline Runner');
  console.log('');
  console.log('Usage:');
  console.log('  node run-pipeline.js run [companies.json]     # Run pipeline with worker');
  console.log('  node run-pipeline.js queue [companies.json]  # Queue job only');
  console.log('  node run-pipeline.js status                  # Show recent job status');
  console.log('');
  console.log('Examples:');
  console.log('  node run-pipeline.js run                     # Run with all companies');
  console.log('  node run-pipeline.js run companies.json      # Run with specific companies');
  console.log('  node run-pipeline.js queue                   # Queue job for existing worker');
  console.log('  node run-pipeline.js status                  # Check recent job status');
}
