import { db, companies, jobs } from "./db-local";
import { eq, like, ilike, or, and, desc, asc, sql, count } from "drizzle-orm";
import type { Company, Job, InsertCompany, InsertJob, CompanyWithJobs } from "@shared/schema";
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// Scheduler database connection for status information
const schedulerPool = new Pool({
  connectionString: process.env.SCHEDULER_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/exilead_scheduler'
});

export interface IStorage {
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyWithJobs(id: number, page?: number, limit?: number, category?: string): Promise<(CompanyWithJobs & { total?: number, hasMore?: boolean, pagination?: { total: number, hasMore: boolean } }) | undefined>;
  getJobs(page?: number, limit?: number): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  getJobsByCompany(companyId: number): Promise<Job[]>;
  getJobsByCategory(category: string, page?: number, limit?: number): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  getCategories(): Promise<string[]>;
  getJob(applyLink: string): Promise<Job | undefined>;
  searchCompaniesAndJobs(query: string): Promise<{ companies: Company[], jobs: Job[] }>;
  searchCompanyJobs(companyId: number, query: string, page?: number, limit?: number, category?: string): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  createCompany(company: InsertCompany): Promise<Company>;
  createJob(job: InsertJob): Promise<Job>;
  loadDataFromJson(): Promise<void>;
  getScraperStatus(): Promise<any>;
  getScraperRuns(page?: number, limit?: number): Promise<any>;
  getScraperConfig(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  
  async loadDataFromJson(): Promise<void> {
    try {
      console.log('Database URL being used:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
      
      // Check if data already exists in database
      try {
        const existingCompanies = await db.select().from(companies).limit(1);
        if (existingCompanies.length > 0) {
          console.log('Data already exists in database, skipping JSON load');
          return;
        }
      } catch (connectionError) {
        console.error('Database connection failed:', connectionError);
        console.log('Skipping database operations - data will not be loaded');
        return;
      }

      const dataPath = path.resolve(process.cwd(), 'data/Final_json_with_categories.json');
      if (fs.existsSync(dataPath)) {
        const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        
        console.log('Loading data from JSON into PostgreSQL...');
        
        // Clear existing data
        await db.delete(jobs);
        await db.delete(companies);
        
        console.log('Cleared existing data from database');

        // Load companies and jobs from JSON
        if (jsonData.companies) {
          for (const [companyName, companyData] of Object.entries(jsonData.companies as any)) {
            const company_data = companyData as any;
            
            // Extract industry from company name or set default
            let industry = "Technology";
            if (companyName.toLowerCase().includes("bank") || companyName.toLowerCase().includes("financial")) {
              industry = "Financial Services";
            } else if (companyName.toLowerCase().includes("health") || companyName.toLowerCase().includes("medical")) {
              industry = "Healthcare";
            } else if (companyName.toLowerCase().includes("retail") || companyName.toLowerCase().includes("consumer")) {
              industry = "Retail";
            }

            // Count only technical jobs for this company
            const technicalJobs = company_data.jobs?.filter((job: any) => job.is_technical === "Technical") || [];

            const companyInsert: InsertCompany = {
              name: company_data.company || companyName,
              industry: industry,
              website: company_data.url || "",
              description: `${company_data.company || companyName} is a leading ${industry.toLowerCase()} company with multiple open positions across various locations.`,
              logo: "",
              jobCount: technicalJobs.length,
            };
            
            // Insert company and get the returned company with ID
            const [insertedCompany] = await db.insert(companies).values(companyInsert).returning();
            console.log(`Inserted company: ${insertedCompany.name} with ${technicalJobs.length} technical jobs`);

            // Load jobs for this company (only technical jobs)
            if (technicalJobs.length > 0) {
              const jobsToInsert: InsertJob[] = [];
              
              for (const jobData of technicalJobs) {
                // Parse employment type and experience from employment_type field
                let employmentType = "Full-time";
                let experienceLevel = null;
                
                if (jobData.employment_type && jobData.employment_type !== "N/A") {
                  const empType = jobData.employment_type.toLowerCase();
                  if (empType.includes("experience:")) {
                    // Extract experience level (e.g., "Experience: 5-10 years" -> "5-10 years")
                    experienceLevel = jobData.employment_type.replace(/^experience:\s*/i, "").trim();
                  } else {
                    employmentType = jobData.employment_type;
                  }
                }
                
                // Override employment type based on title if not already set from employment_type field
                if (employmentType === "Full-time") {
                  if (jobData.title?.toLowerCase().includes("intern")) {
                    employmentType = "Internship";
                  } else if (jobData.title?.toLowerCase().includes("contract")) {
                    employmentType = "Contract";
                  } else if (jobData.title?.toLowerCase().includes("part-time")) {
                    employmentType = "Part-time";
                  }
                }

                // Parse work mode from location or remote field
                let workMode = "On-site";
                if (jobData.remote_work === "Yes" || jobData.location?.toLowerCase().includes("remote")) {
                  workMode = "Remote";
                } else if (jobData.location?.toLowerCase().includes("hybrid")) {
                  workMode = "Hybrid";
                }

                // Parse skills from multiple sources
                const skillsFromTitle = [];
                const skillsFromData = [];
                const techSkills = ["java", "python", "javascript", "react", "node", "aws", "azure", "sql", "mongodb", "kubernetes", "docker", "spring", "angular", "vue", "typescript", "golang", "c++", "c#", ".net", "php", "ruby", "scala", "kotlin", "full stack", "fullstack", "frontend", "backend", "devops", "machine learning", "data science"];

                // Extract skills from title
                for (const skill of techSkills) {
                  if (jobData.title?.toLowerCase().includes(skill)) {
                    skillsFromTitle.push(skill.charAt(0).toUpperCase() + skill.slice(1));
                  }
                }
                
                // Extract skills from the skills field in raw data
                if (jobData.skills && jobData.skills !== "N/A") {
                  let skillsText = jobData.skills;
                  // Remove "Required Skill:" prefix if present
                  skillsText = skillsText.replace(/^required skill:\s*/i, "").trim();
                  
                  // Split by commas and clean up
                  const extractedSkills = skillsText.split(/[,;]/).map((skill: string) => skill.trim()).filter((skill: string) => skill.length > 0);
                  skillsFromData.push(...extractedSkills);
                }
                
                // Combine and deduplicate skills
                const allSkills = Array.from(new Set([...skillsFromTitle, ...skillsFromData]));
                const finalSkills = allSkills.length > 0 ? allSkills : null;

                const jobInsert: InsertJob = {
                  companyId: insertedCompany.id,
                  title: jobData.title || "Software Engineer",
                  location: jobData.location || "Not specified",
                  employmentType: employmentType,
                  experienceLevel: experienceLevel,
                  workMode: workMode,
                  category: jobData.category || "Other",
                  isTechnical: jobData.is_technical === "Technical" ? "Technical" : "Non-Technical",
                  description: jobData.description && jobData.description !== "N/A" ? jobData.description : `Join ${insertedCompany.name} as a ${jobData.title}. We are looking for talented professionals to join our team.`,
                  requirements: jobData.requirements && jobData.requirements !== "N/A" ? 
                    (Array.isArray(jobData.requirements) ? jobData.requirements as string[] : [jobData.requirements as string]) : null,
                  benefits: jobData.benefits && jobData.benefits !== "N/A" ? 
                    (Array.isArray(jobData.benefits) ? jobData.benefits as string[] : [jobData.benefits as string]) : null,
                  skills: finalSkills,
                  applyLink: jobData.apply_link || "",
                  sourceUrl: jobData.source_url || "",
                  postedDate: jobData.posted_date && jobData.posted_date !== "N/A" ? jobData.posted_date : "Recently posted",
                  deadline: jobData.deadline && jobData.deadline !== "N/A" ? jobData.deadline : "",
                  salary: jobData.salary && jobData.salary !== "N/A" ? jobData.salary : "",
                };
                
                jobsToInsert.push(jobInsert);
              }
              
              // Batch insert all jobs for this company
              if (jobsToInsert.length > 0) {
                // Insert in smaller batches to avoid stack overflow
                const batchSize = 100;
                let insertedCount = 0;
                
                for (let i = 0; i < jobsToInsert.length; i += batchSize) {
                  const batch = jobsToInsert.slice(i, i + batchSize);
                  await db.insert(jobs).values(batch as any);
                  insertedCount += batch.length;
                  
                  // Show progress for large companies
                  if (jobsToInsert.length > 500 && insertedCount % 500 === 0) {
                    console.log(`    Progress: ${insertedCount}/${jobsToInsert.length} jobs inserted`);
                  }
                }
                
                console.log(`  - Inserted ${jobsToInsert.length} technical jobs for ${insertedCompany.name}`);
              }
            }
          }
        }
        
        console.log('Successfully loaded all data into PostgreSQL database');
      }
    } catch (error) {
      console.error('Error loading data from JSON into database:', error);
      throw error;
    }
  }

  async getCompanies(): Promise<Company[]> {
    try {
      return await db.select().from(companies).orderBy(desc(companies.jobCount));
    } catch (error) {
      console.error('Error fetching companies:', error);
      return [];
    }
  }

  async getCompany(id: number): Promise<Company | undefined> {
    try {
      const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching company:', error);
      return undefined;
    }
  }

  async getCompanyWithJobs(id: number, page: number = 1, limit: number = 20, category?: string): Promise<(CompanyWithJobs & { total?: number, hasMore?: boolean, pagination?: { total: number, hasMore: boolean } }) | undefined> {
    const company = await this.getCompany(id);
    if (!company) return undefined;

    const offset = (page - 1) * limit;
    
    // Build conditions for filtering
    const conditions = [eq(jobs.companyId, id)];
    if (category && category !== "all") {
      conditions.push(eq(jobs.category, category));
    }
    
    // Get total count of jobs for this company (with category filter if applied)
    const totalResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(jobs)
      .where(and(...conditions));
    const total = totalResult[0]?.count || 0;
    
    // Get paginated jobs for this company (with category filter if applied)
    const companyJobs = await db.select().from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);
      
    const hasMore = offset + limit < total;
    
    return {
      ...company,
      jobs: companyJobs,
      total, // Add total at root level for frontend compatibility
      hasMore, // Add hasMore at root level for frontend compatibility
      pagination: { total, hasMore },
    };
  }

  async getJobs(page: number = 1, limit: number = 20): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
    const offset = (page - 1) * limit;
    
    // Get total count of technical jobs
    const totalResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(jobs);
    const total = totalResult[0]?.count || 0;
    
    // Get paginated technical jobs
    const allJobs = await db.select().from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);
      
    const hasMore = offset + limit < total;
    
    return { jobs: allJobs, total, hasMore };
  }

  async getJobsByCompany(companyId: number): Promise<Job[]> {
    return await db.select().from(jobs)
      .where(eq(jobs.companyId, companyId))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobsByCategory(category: string, page: number = 1, limit: number = 20): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
    const offset = (page - 1) * limit;
    
    // Get total count of technical jobs in this category
    const totalResult = await db.select({ count: count() }).from(jobs)
      .where(and(eq(jobs.category, category), eq(jobs.isTechnical, "Technical")));
    const total = totalResult[0]?.count || 0;
    
    // Get paginated technical jobs in this category
    const categoryJobs = await db.select().from(jobs)
      .where(and(eq(jobs.category, category), eq(jobs.isTechnical, "Technical")))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);
      
    const hasMore = offset + limit < total;
    
    return { jobs: categoryJobs, total, hasMore };
  }

  async getCategories(): Promise<string[]> {
    const excludedCategories = ["Education", "HR/Recruiting", "Human Resources", "Legal/Compliance", "Healthcare", "Sales", "Administrative"];
    
    // Only get categories from jobs that belong to valid companies
    const result = await db.selectDistinct({ category: jobs.category })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobs.isTechnical, "Technical"));
      
    return result.map(r => r.category)
      .filter((cat): cat is string => cat !== null && !excludedCategories.includes(cat))
      .sort();
  }

  async getJob(applyLink: string): Promise<Job | undefined> {
    const result = await db.select().from(jobs).where(eq(jobs.applyLink, applyLink)).limit(1);
    return result[0];
  }

  async searchCompaniesAndJobs(query: string): Promise<{ companies: Company[], jobs: Job[] }> {
    console.log('Search query received:', query);
    
    // Prepare the search query for PostgreSQL FTS
    // Convert spaces to & for AND operations, handle special characters
    const tsQuery = query
      .trim()
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .split(/\s+/)
      .filter(term => term.length > 0)
      .join(' & '); // Use & for AND operations in FTS
    
    console.log('Generated FTS query:', tsQuery);
    
    // Search companies using PostgreSQL Full Text Search
    const matchedCompanies = await db.select().from(companies)
      .where(or(
        // FTS on company name and description
        sql`to_tsvector('english', ${companies.name}) @@ plainto_tsquery('english', ${query})`,
        sql`to_tsvector('english', ${companies.description}) @@ plainto_tsquery('english', ${query})`,
        sql`to_tsvector('english', ${companies.industry}) @@ plainto_tsquery('english', ${query})`,
        // Fallback to ILIKE for exact matches
        ilike(companies.name, `%${query}%`),
        ilike(companies.industry, `%${query}%`)
      ));

    // Search jobs using PostgreSQL Full Text Search
    const matchedJobs = await db.select().from(jobs)
      .where(or(
        // FTS on job content
        sql`to_tsvector('english', ${jobs.title}) @@ plainto_tsquery('english', ${query})`,
        sql`to_tsvector('english', ${jobs.description}) @@ plainto_tsquery('english', ${query})`,
        sql`to_tsvector('english', ${jobs.category}) @@ plainto_tsquery('english', ${query})`,
        sql`to_tsvector('english', ${jobs.location}) @@ plainto_tsquery('english', ${query})`,
        // FTS on skills array (convert to text first)
        sql`to_tsvector('english', ${jobs.skills}::text) @@ plainto_tsquery('english', ${query})`,
        // Fallback to ILIKE for exact phrase matching
        ilike(jobs.title, `%${query}%`),
        ilike(jobs.location, `%${query}%`),
        ilike(jobs.category, `%${query}%`),
        ilike(jobs.description, `%${query}%`),
        ilike(jobs.employmentType, `%${query}%`),
        ilike(jobs.experienceLevel, `%${query}%`),
        ilike(jobs.workMode, `%${query}%`),
        ilike(jobs.salary, `%${query}%`),
        // Skills array exact matching
        sql`${jobs.skills}::text ILIKE ${'%' + query + '%'}`
      ));

    console.log(`Found ${matchedCompanies.length} companies and ${matchedJobs.length} jobs`);
    return { companies: matchedCompanies, jobs: matchedJobs };
  }

  async searchCompanyJobs(companyId: number, query: string, page: number = 1, limit: number = 20, category?: string): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
    console.log(`Search company ${companyId} jobs with query: "${query}", category: "${category || 'all'}"`);
    
    const offset = (page - 1) * limit;
    
    // Search jobs for this company using PostgreSQL Full Text Search
    const searchConditions = or(
      // FTS on job content
      sql`to_tsvector('english', ${jobs.title}) @@ plainto_tsquery('english', ${query})`,
      sql`to_tsvector('english', ${jobs.description}) @@ plainto_tsquery('english', ${query})`,
      sql`to_tsvector('english', ${jobs.category}) @@ plainto_tsquery('english', ${query})`,
      sql`to_tsvector('english', ${jobs.location}) @@ plainto_tsquery('english', ${query})`,
      // FTS on skills array (convert to text first)
      sql`to_tsvector('english', ${jobs.skills}::text) @@ plainto_tsquery('english', ${query})`,
      // Fallback to ILIKE for exact phrase matching
      ilike(jobs.title, `%${query}%`),
      ilike(jobs.location, `%${query}%`),
      ilike(jobs.category, `%${query}%`),
      ilike(jobs.description, `%${query}%`),
      ilike(jobs.employmentType, `%${query}%`),
      ilike(jobs.experienceLevel, `%${query}%`),
      ilike(jobs.workMode, `%${query}%`),
      ilike(jobs.salary, `%${query}%`),
      // Skills array exact matching
      sql`${jobs.skills}::text ILIKE ${'%' + query + '%'}`
    );

    // Build base conditions
    const baseConditions = [
      eq(jobs.companyId, companyId),
      searchConditions
    ];

    // Add category filter if specified
    if (category && category !== "all") {
      baseConditions.push(eq(jobs.category, category));
    }

    // Get total count of matching jobs for this company
    const totalResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(jobs)
      .where(and(...baseConditions));
    const total = totalResult[0]?.count || 0;
    
    // Get paginated search results for this company
    const matchedJobs = await db.select().from(jobs)
      .where(and(...baseConditions))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);
      
    const hasMore = offset + limit < total;
    
    console.log(`Found ${matchedJobs.length} matching jobs out of ${total} total for company ${companyId}`);
    return { jobs: matchedJobs, total, hasMore };
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob as any).returning();
    
    // Update company job count if this is a technical job
    if (insertJob.isTechnical === "Technical") {
      const jobCount = await db.select().from(jobs).where(eq(jobs.companyId, insertJob.companyId!));
      await db.update(companies)
        .set({ jobCount: jobCount.length })
        .where(eq(companies.id, insertJob.companyId!));
    }
    
    return job;
  }

  // Scraper Status Methods
  async getScraperStatus(): Promise<any> {
    try {
      const client = await schedulerPool.connect();
      
      try {
        // Get overall status
        const lastRunResult = await client.query(`
          SELECT * FROM scheduler_runs 
          WHERE job_name = 'exilead_scraper' 
          ORDER BY started_at DESC 
          LIMIT 1
        `);
        
        const totalRunsResult = await client.query(`
          SELECT COUNT(*) as total_runs,
                 SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
                 SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_runs,
                 AVG(duration_seconds) as avg_duration,
                 SUM(jobs_saved) as total_jobs_saved,
                 SUM(companies_processed) as total_companies_processed
          FROM scheduler_runs 
          WHERE job_name = 'exilead_scraper'
        `);

        const currentlyRunningResult = await client.query(`
          SELECT COUNT(*) as running_count
          FROM scheduler_runs 
          WHERE job_name = 'exilead_scraper' AND status = 'running'
        `);

        const nextScheduledResult = await client.query(`
          SELECT next_run, cron_pattern, enabled
          FROM scheduler_config 
          WHERE job_name = 'exilead_scraper'
          LIMIT 1
        `);

        return {
          lastRun: lastRunResult.rows[0] || null,
          stats: totalRunsResult.rows[0] || {
            total_runs: 0,
            successful_runs: 0,
            failed_runs: 0,
            avg_duration: 0,
            total_jobs_saved: 0,
            total_companies_processed: 0
          },
          currentlyRunning: parseInt(currentlyRunningResult.rows[0]?.running_count || '0') > 0,
          schedule: nextScheduledResult.rows[0] || null,
          systemInfo: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching scraper status:', error);
      // Return fallback data when database is not available
      return {
        lastRun: null,
        stats: {
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          avg_duration: 0,
          total_jobs_saved: 0,
          total_companies_processed: 0
        },
        currentlyRunning: false,
        schedule: null,
        systemInfo: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        },
        error: 'Scheduler database not available'
      };
    }
  }

  async getScraperRuns(page: number = 1, limit: number = 10): Promise<any> {
    try {
      const client = await schedulerPool.connect();
      
      try {
        const offset = (page - 1) * limit;
        
        const runsResult = await client.query(`
          SELECT * FROM scheduler_runs 
          WHERE job_name = 'exilead_scraper'
          ORDER BY started_at DESC 
          LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const totalResult = await client.query(`
          SELECT COUNT(*) as total
          FROM scheduler_runs 
          WHERE job_name = 'exilead_scraper'
        `);

        return {
          runs: runsResult.rows,
          pagination: {
            total: parseInt(totalResult.rows[0].total),
            page,
            limit,
            hasMore: offset + limit < parseInt(totalResult.rows[0].total)
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching scraper runs:', error);
      // Return fallback data when database is not available
      return {
        runs: [],
        pagination: {
          total: 0,
          page,
          limit,
          hasMore: false
        },
        error: 'Scheduler database not available'
      };
    }
  }

  async getScraperConfig(): Promise<any> {
    try {
      const client = await schedulerPool.connect();
      
      try {
        const configResult = await client.query(`
          SELECT * FROM scheduler_config 
          WHERE job_name = 'exilead_scraper'
          LIMIT 1
        `);

        const healthConfigResult = await client.query(`
          SELECT * FROM scheduler_config 
          WHERE job_name = 'healthCheck'
          LIMIT 1
        `);

        return {
          scraperConfig: configResult.rows[0] || null,
          healthConfig: healthConfigResult.rows[0] || null,
          settings: {
            schedulerDatabase: process.env.SCHEDULER_DATABASE_URL?.replace(/:[^:]*@/, ':****@'),
            scraperDatabase: process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'),
            environment: process.env.NODE_ENV || 'development'
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching scraper config:', error);
      // Return fallback data when database is not available
      return {
        scraperConfig: null,
        healthConfig: null,
        settings: {
          schedulerDatabase: process.env.SCHEDULER_DATABASE_URL?.replace(/:[^:]*@/, ':****@'),
          scraperDatabase: process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'),
          environment: process.env.NODE_ENV || 'development'
        },
        error: 'Scheduler database not available'
      };
    }
  }
}

export const storage = new DatabaseStorage();
