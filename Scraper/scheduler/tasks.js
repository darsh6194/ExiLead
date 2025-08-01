// Graphile Worker tasks for ExiLead pipeline (separate scraping and database steps)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Task 1: Run Final_Scraper.py to scrape jobs
async function runFinalScraper(payload, helpers) {
  const { job, withPgClient, addJob } = helpers;
  
  console.log('🕷️ STARTING FINAL SCRAPER (Step 1/2)');
  console.log('=' .repeat(60));
  console.log(`Job ID: ${job.id}`);
  console.log(`Scheduled at: ${new Date()}`);
  console.log('=' .repeat(60));

  // Use the worker's database client for job tracking
  return await withPgClient(async (client) => {
    let jobRunId;
    
    try {
      const result = await client.query(`
        INSERT INTO scheduler_runs (job_name, started_at, status)
        VALUES ('final_scraper', NOW(), 'running')
        RETURNING id
      `);
      jobRunId = result.rows[0].id;
    } catch (error) {
      console.error('❌ Failed to create job run record:', error);
      throw error;
    }

    return new Promise((resolve, reject) => {
      // Path to the Final_Scraper.py
      const scraperPath = path.join(process.env.SCRAPER_PATH || 'C:\\Programs\\ExiLead\\Scraper', 'Final_Scraper.py');
      
      console.log(`📂 Running Final_Scraper: ${scraperPath}`);
      
      // Set up environment for the scraper
      const scraperEnv = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      };
      
      // Build command with any payload arguments
      let scraperArgs = [scraperPath];
      if (payload && payload.companies_file) {
        scraperArgs.push('--companies', payload.companies_file);
      }
      
      console.log(`🎯 Command: python ${scraperArgs.join(' ')}`);
      
      // Start the Python scraper process
      const pythonProcess = spawn('python', scraperArgs, {
        cwd: path.dirname(scraperPath),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: scraperEnv
      });

      let outputBuffer = '';
      let errorBuffer = '';
      let resultsFile = null;

      // Capture stdout - RAW OUTPUT FROM FINAL_SCRAPER
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Print raw output exactly as Final_Scraper generates it (no prefixes, no trimming)
        process.stdout.write(output);
        
        // Look for results file creation
        const resultsMatch = output.match(/Results saved to: ([^\n]+\.json)/);
        if (resultsMatch) {
          resultsFile = resultsMatch[1];
          console.log(`\n📁 [WORKER] Results file detected: ${resultsFile}\n`);
        }
      });

      // Capture stderr - RAW ERRORS FROM FINAL_SCRAPER
      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errorBuffer += error;
        
        // Print raw stderr exactly as Final_Scraper generates it (no prefixes, no trimming)
        process.stderr.write(error);
      });

      // Handle process completion
      pythonProcess.on('close', async (code) => {
        console.log(`\n🏁 [WORKER] Final_Scraper finished with exit code: ${code}`);
        
        const status = code === 0 ? 'success' : 'error';
        
        // Update job run record
        try {
          await client.query(`
            UPDATE scheduler_runs 
            SET finished_at = NOW(),
                status = $1,
                error_message = $2,
                output = $3,
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
            WHERE id = $4
          `, [status, errorBuffer || null, outputBuffer, jobRunId]);
        } catch (updateError) {
          console.error('❌ [WORKER] Failed to update job run record:', updateError);
        }

        if (code === 0 && resultsFile) {
          console.log('✅ [WORKER] Final_Scraper completed successfully!');
          console.log(`📁 [WORKER] Results file: ${resultsFile}`);
          
          // Queue the database pipeline job with the results file
          try {
            await addJob('runDatabasePipeline', { 
              resultsFile: resultsFile,
              scraperJobId: job.id 
            });
            console.log('📊 [WORKER] Database pipeline job queued successfully');
            resolve({ 
              status: 'success', 
              resultsFile: resultsFile,
              nextJob: 'runDatabasePipeline'
            });
          } catch (queueError) {
            console.error('❌ [WORKER] Failed to queue database pipeline job:', queueError);
            reject(new Error(`Scraping succeeded but failed to queue database pipeline: ${queueError.message}`));
          }
        } else {
          const errorMessage = `Final_Scraper failed with code ${code}. Error: ${errorBuffer}`;
          console.error('❌ [WORKER]', errorMessage);
          reject(new Error(errorMessage));
        }
      });

      // Handle process errors
      pythonProcess.on('error', async (error) => {
        console.error('❌ [WORKER] Process error:', error);
        
        try {
          await client.query(`
            UPDATE scheduler_runs 
            SET finished_at = NOW(),
                status = 'error',
                error_message = $1
            WHERE id = $2
          `, [error.message, jobRunId]);
        } catch (updateError) {
          console.error('❌ [WORKER] Failed to update job run record:', updateError);
        }
        
        reject(error);
      });
    });
  });
}

// Task 2: Run database_pipeline.py to save results to database
async function runDatabasePipeline(payload, helpers) {
  const { job, withPgClient } = helpers;
  
  console.log('🗄️ STARTING DATABASE PIPELINE (Step 2/2)');
  console.log('=' .repeat(60));
  console.log(`Job ID: ${job.id}`);
  console.log(`Previous Scraper Job: ${payload.scraperJobId}`);
  console.log(`Results File: ${payload.resultsFile}`);
  console.log(`Scheduled at: ${new Date()}`);
  console.log('=' .repeat(60));

  if (!payload.resultsFile) {
    throw new Error('No results file provided for database pipeline');
  }

  // Verify results file exists
  if (!fs.existsSync(payload.resultsFile)) {
    throw new Error(`Results file not found: ${payload.resultsFile}`);
  }

  return await withPgClient(async (client) => {
    let jobRunId;
    
    try {
      const result = await client.query(`
        INSERT INTO scheduler_runs (job_name, started_at, status, parent_job_id)
        VALUES ('database_pipeline', NOW(), 'running', $1)
        RETURNING id
      `, [payload.scraperJobId]);
      jobRunId = result.rows[0].id;
    } catch (error) {
      console.error('❌ Failed to create job run record:', error);
      throw error;
    }

    return new Promise((resolve, reject) => {
      // Path to the database_pipeline.py
      const pipelinePath = path.join(process.env.SCRAPER_PATH || 'C:\\Programs\\ExiLead\\Scraper', 'database_pipeline.py');
      
      console.log(`📂 Running Database Pipeline: ${pipelinePath}`);
      console.log(`📁 Processing file: ${payload.resultsFile}`);
      
      // Set up environment for the pipeline
      const pipelineEnv = {
        ...process.env,
        DATABASE_URL: process.env.SCRAPER_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exilead_jobs',
        PYTHONIOENCODING: 'utf-8'
      };
      
      console.log(`🗄️ Pipeline will use database: ${pipelineEnv.DATABASE_URL.replace(/password=[^@]+/, 'password=***')}`);
      
      // Start the Python pipeline process
      const pythonProcess = spawn('python', [pipelinePath, payload.resultsFile], {
        cwd: path.dirname(pipelinePath),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: pipelineEnv
      });

      let outputBuffer = '';
      let errorBuffer = '';
      let stats = {
        totalJobs: 0,
        savedJobs: 0,
        skippedDuplicates: 0,
        errors: 0
      };

      // Capture stdout - RAW OUTPUT FROM DATABASE_PIPELINE
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Print raw output exactly as database_pipeline generates it
        process.stdout.write(output);
        
        // Parse statistics from output
        const totalMatch = output.match(/Total jobs processed: (\d+)/);
        if (totalMatch) {
          stats.totalJobs = parseInt(totalMatch[1]);
        }
        
        const savedMatch = output.match(/Successfully saved to DB: (\d+)/);
        if (savedMatch) {
          stats.savedJobs = parseInt(savedMatch[1]);
        }
        
        const skippedMatch = output.match(/Skipped \(Duplicates\): (\d+)/);
        if (skippedMatch) {
          stats.skippedDuplicates = parseInt(skippedMatch[1]);
        }
        
        const errorsMatch = output.match(/Errors: (\d+)/);
        if (errorsMatch) {
          stats.errors = parseInt(errorsMatch[1]);
        }
      });

      // Capture stderr - RAW ERRORS FROM DATABASE_PIPELINE
      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errorBuffer += error;
        
        // Print raw stderr exactly as database_pipeline generates it
        process.stderr.write(error);
      });

      // Handle process completion
      pythonProcess.on('close', async (code) => {
        console.log(`\n🏁 [WORKER] Database pipeline finished with exit code: ${code}`);
        
        const status = code === 0 ? 'success' : 'error';
        
        // Update job run record
        try {
          await client.query(`
            UPDATE scheduler_runs 
            SET finished_at = NOW(),
                status = $1,
                error_message = $2,
                jobs_saved = $3,
                total_jobs_processed = $4,
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
            WHERE id = $5
          `, [status, errorBuffer || null, stats.savedJobs, stats.totalJobs, jobRunId]);
        } catch (updateError) {
          console.error('❌ [WORKER] Failed to update job run record:', updateError);
        }

        if (code === 0) {
          console.log('✅ [WORKER] DATABASE PIPELINE COMPLETED SUCCESSFULLY');
          console.log(`📊 [WORKER] Final Stats: ${stats.savedJobs} saved, ${stats.skippedDuplicates} duplicates, ${stats.errors} errors`);
          resolve({
            status: 'success',
            totalJobs: stats.totalJobs,
            savedJobs: stats.savedJobs,
            skippedDuplicates: stats.skippedDuplicates,
            errors: stats.errors,
            output: outputBuffer
          });
        } else {
          const errorMessage = `Database pipeline failed with code ${code}. Error: ${errorBuffer}`;
          console.error('❌ [WORKER]', errorMessage);
          reject(new Error(errorMessage));
        }
      });

      // Handle process errors
      pythonProcess.on('error', async (error) => {
        console.error('❌ [WORKER] Pipeline process error:', error);
        
        try {
          await client.query(`
            UPDATE scheduler_runs 
            SET finished_at = NOW(),
                status = 'error',
                error_message = $1
            WHERE id = $2
          `, [error.message, jobRunId]);
        } catch (updateError) {
          console.error('❌ [WORKER] Failed to update job run record:', updateError);
        }
        
        reject(error);
      });
    });
  });
}

// Task: Health check for the system
async function healthCheck(payload, helpers) {
  const { withPgClient } = helpers;
  
  console.log('🏥 RUNNING HEALTH CHECK');
  
  return await withPgClient(async (client) => {
    try {
      // Check database connection
      await client.query('SELECT NOW()');
      console.log('✅ Database connection healthy');
      
      // Check recent job runs
      const recentRuns = await client.query(`
        SELECT * FROM scheduler_runs 
        WHERE started_at > NOW() - INTERVAL '30 days'
        ORDER BY started_at DESC 
        LIMIT 5
      `);
      
      console.log(`📊 Recent job runs: ${recentRuns.rows.length}`);
      
      // Check scheduler config
      const config = await client.query(`
        SELECT * FROM scheduler_config 
        WHERE job_name = 'exilead_scraper'
      `);
      
      if (config.rows.length > 0) {
        const job = config.rows[0];
        console.log(`📅 Scheduler status: ${job.enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`⏰ Last run: ${job.last_run || 'Never'}`);
        console.log(`🔄 Pattern: ${job.cron_pattern}`);
      }
      
      console.log('✅ HEALTH CHECK COMPLETED');
      
      return {
        success: true,
        timestamp: new Date(),
        checks: {
          database: 'healthy',
          recentRuns: recentRuns.rows.length,
          schedulerEnabled: config.rows.length > 0 ? config.rows[0].enabled : false
        }
      };
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  });
}

module.exports = {
  runFinalScraper,
  runDatabasePipeline,
  healthCheck
};
