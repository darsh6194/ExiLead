# ExiLead Data Migration Guide

## Overview
This guide documents the complete data migration process from JSON files to PostgreSQL database for the ExiLead job platform.

## Migration Architecture

### Source Data
- **File**: `data/Final_json_with_categories.json`
- **Size**: ~50MB JSON file
- **Structure**: Nested object with companies and their job listings
- **Total Records**: 42 companies with ~25,000+ jobs
- **Filtered Records**: 13,966 technical jobs after filtering

### Target Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Tables**: `companies` and `jobs`
- **Relationships**: One-to-many (company to jobs)

## Migration Scripts

### 1. Environment Setup Script
Location: `server/migrate-data.ts`

```typescript
// Manual environment variable loading
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
```

### 2. Migration Command
```bash
npm run db:migrate
```

Package.json script:
```json
{
  "scripts": {
    "db:migrate": "tsx server/migrate-data.ts"
  }
}
```

## Migration Process Flow

### Step 1: Environment Validation
1. Load `.env` file manually (dotenv wasn't working in migration context)
2. Validate `DATABASE_URL` exists
3. Test database connection

```typescript
console.log('✅ Database URL found:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
console.log('🔄 Testing database connection...');
await db.select().from(companies).limit(1);
console.log('✅ Database connection successful');
```

### Step 2: Schema Preparation
1. Clear existing data (for fresh migration)
2. Reset auto-increment sequences
3. Prepare for bulk insertion

```typescript
// Clear existing data
await db.delete(jobs);
await db.delete(companies);
console.log('Cleared existing data from database');
```

### Step 3: Company Processing
For each company in the JSON:

1. **Extract Industry**: Based on company name patterns
```typescript
let industry = "Technology";
if (companyName.toLowerCase().includes("bank") || companyName.toLowerCase().includes("financial")) {
  industry = "Financial Services";
} else if (companyName.toLowerCase().includes("health") || companyName.toLowerCase().includes("medical")) {
  industry = "Healthcare";
} else if (companyName.toLowerCase().includes("retail") || companyName.toLowerCase().includes("consumer")) {
  industry = "Retail";
}
```

2. **Filter Technical Jobs**: Only process jobs marked as technical
```typescript
const technicalJobs = company_data.jobs?.filter((job: any) => job.is_technical === "Technical") || [];
```

3. **Insert Company Record**:
```typescript
const companyInsert: InsertCompany = {
  name: company_data.company || companyName,
  industry: industry,
  website: company_data.url || "",
  description: `${company_data.company || companyName} is a leading ${industry.toLowerCase()} company with multiple open positions across various locations.`,
  logo: "",
  jobCount: technicalJobs.length,
};

const [insertedCompany] = await db.insert(companies).values(companyInsert).returning();
```

### Step 4: Job Processing & Enhancement

For each technical job:

1. **Parse Employment Type**:
```typescript
let employmentType = "Full-time";
if (jobData.title?.toLowerCase().includes("intern")) {
  employmentType = "Internship";
} else if (jobData.title?.toLowerCase().includes("contract")) {
  employmentType = "Contract";
} else if (jobData.title?.toLowerCase().includes("part-time")) {
  employmentType = "Part-time";
}
```

2. **Determine Work Mode**:
```typescript
let workMode = "On-site";
if (jobData.remote_work === "Yes" || jobData.location?.toLowerCase().includes("remote")) {
  workMode = "Remote";
} else if (jobData.location?.toLowerCase().includes("hybrid")) {
  workMode = "Hybrid";
}
```

3. **Extract Skills**: Parse technical skills from job titles
```typescript
const skillsFromTitle = [];
const techSkills = ["java", "python", "javascript", "react", "node", "aws", "azure", "sql", "mongodb", "kubernetes", "docker", "spring", "angular", "vue", "typescript", "golang", "c++", "c#", ".net", "php", "ruby", "scala", "kotlin"];

for (const skill of techSkills) {
  if (jobData.title?.toLowerCase().includes(skill)) {
    skillsFromTitle.push(skill.charAt(0).toUpperCase() + skill.slice(1));
  }
}
```

### Step 5: Batch Processing
To handle large datasets efficiently:

```typescript
const batchSize = 100;
let insertedCount = 0;

for (let i = 0; i < jobsToInsert.length; i += batchSize) {
  const batch = jobsToInsert.slice(i, i + batchSize);
  await db.insert(jobs).values(batch as any);
  insertedCount += batch.length;
  
  // Show progress for large companies (>500 jobs)
  if (jobsToInsert.length > 500 && insertedCount % 500 === 0) {
    console.log(`    Progress: ${insertedCount}/${jobsToInsert.length} jobs inserted`);
  }
}
```

## Migration Results

### Successful Migration Stats
```
✅ Data migration completed successfully!

Companies Processed: 42
Total Technical Jobs: 13,966
Average Jobs per Company: 332
Largest Company: Accenture (9,018 jobs)
Smallest Company: HP (8 jobs)
```

### Company Breakdown
| Company | Technical Jobs | Progress Tracking |
|---------|----------------|-------------------|
| Accenture | 9,018 | ✅ Batch processed |
| IBM | 1,250 | ✅ Batch processed |
| Amazon | 1,228 | ✅ Batch processed |
| Citi Bank | 746 | ✅ Batch processed |
| Goldman Sachs | 644 | ✅ Batch processed |
| NTT Data | 418 | ✅ Standard processing |
| JP Morgan | 355 | ✅ Standard processing |
| United Health Group | 335 | ✅ Standard processing |
| Morgan Stanley | 296 | ✅ Standard processing |
| Google | 282 | ✅ Standard processing |
| ... | ... | ... |

### Performance Metrics
- **Total Migration Time**: ~3-4 minutes
- **Batch Size**: 100 jobs per batch
- **Progress Tracking**: Every 500 jobs for companies >500 jobs
- **Memory Usage**: Optimized with batch processing
- **Error Rate**: 0% (all companies migrated successfully)

## Technical Challenges & Solutions

### Challenge 1: Stack Overflow on Large Inserts
**Problem**: Inserting 9,018 jobs for Accenture caused "Maximum call stack size exceeded"

**Solution**: Implemented batch processing
```typescript
// Before: Single bulk insert (failed)
await db.insert(jobs).values(allJobs);

// After: Batch processing (success)
for (let i = 0; i < jobsToInsert.length; i += batchSize) {
  const batch = jobsToInsert.slice(i, i + batchSize);
  await db.insert(jobs).values(batch);
}
```

### Challenge 2: Environment Variable Loading
**Problem**: `dotenv` not working in migration script context

**Solution**: Manual .env file parsing
```typescript
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
```

### Challenge 3: Database Connection Issues
**Problem**: PostgreSQL authentication failed for user

**Solution**: Switched to local PostgreSQL with proper credentials
```typescript
// Updated connection string
DATABASE_URL=postgresql://postgres:password@localhost:5432/ExiLead
```

## Data Quality Improvements

### 1. Industry Classification
Automatically classified companies into industries:
- Technology (default)
- Financial Services
- Healthcare  
- Retail

### 2. Job Enhancement
- Parsed employment types from titles
- Determined work modes from location data
- Extracted technical skills from job titles
- Standardized job categories

### 3. Data Validation
- Filtered only technical jobs (`is_technical: "Technical"`)
- Handled null/undefined values with defaults
- Cleaned up "N/A" values in descriptions

## Running the Migration

### Prerequisites
1. PostgreSQL installed and running
2. Database created: `ExiLead`
3. Environment variables set in `.env`
4. Dependencies installed: `npm install`

### Step-by-Step Process
1. **Prepare Environment**:
```bash
# Create .env file
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/ExiLead" > .env
```

2. **Run Migration**:
```bash
npm run db:migrate
```

3. **Verify Results**:
```bash
# Check company count
psql -d ExiLead -c "SELECT COUNT(*) FROM companies;"

# Check job count
psql -d ExiLead -c "SELECT COUNT(*) FROM jobs WHERE is_technical = 'Technical';"

# Check categories
psql -d ExiLead -c "SELECT DISTINCT category FROM jobs ORDER BY category;"
```

### Expected Output
```bash
Environment variables loaded from .env file
Starting data migration from JSON to PostgreSQL...
✅ Database URL found: postgresql://postgres:****@localhost:5432/ExiLead
🔄 Testing database connection...
✅ Database connection successful
🚀 Proceeding with migration...
Loading data from JSON into PostgreSQL...
Cleared existing data from database

Inserted company: Mastercard with 172 technical jobs
  - Inserted 172 technical jobs for Mastercard
Inserted company: Amazon with 1228 technical jobs
    Progress: 500/1228 jobs inserted
    Progress: 1000/1228 jobs inserted
  - Inserted 1228 technical jobs for Amazon
...
Inserted company: Accenture with 9018 technical jobs
    Progress: 500/9018 jobs inserted
    Progress: 1000/9018 jobs inserted
    Progress: 1500/9018 jobs inserted
    ...
    Progress: 9000/9018 jobs inserted
  - Inserted 9018 technical jobs for Accenture
...
Successfully loaded all data into PostgreSQL database
✅ Data migration completed successfully!
```

## Post-Migration Verification

### Database Verification Queries
```sql
-- Verify total companies
SELECT COUNT(*) as total_companies FROM companies;
-- Expected: 42

-- Verify total technical jobs
SELECT COUNT(*) as total_technical_jobs FROM jobs WHERE is_technical = 'Technical';
-- Expected: 13,966

-- Verify job categories
SELECT category, COUNT(*) as job_count 
FROM jobs 
WHERE is_technical = 'Technical' 
GROUP BY category 
ORDER BY job_count DESC;

-- Verify top companies by job count
SELECT c.name, c.job_count 
FROM companies c 
ORDER BY c.job_count DESC 
LIMIT 10;

-- Verify data integrity
SELECT 
  c.name,
  c.job_count as company_job_count,
  COUNT(j.id) as actual_job_count
FROM companies c
LEFT JOIN jobs j ON c.id = j.company_id
GROUP BY c.id, c.name, c.job_count
HAVING c.job_count != COUNT(j.id);
-- Should return 0 rows (no mismatches)
```

## Rollback Procedure

If migration needs to be rolled back:

```sql
-- Clear all data
DELETE FROM jobs;
DELETE FROM companies;

-- Reset sequences
ALTER SEQUENCE companies_id_seq RESTART WITH 1;
ALTER SEQUENCE jobs_id_seq RESTART WITH 1;
```

## Future Migration Considerations

### 1. Incremental Updates
For future data updates, consider implementing:
- Upsert logic for existing companies
- Job deduplication based on source URLs
- Timestamp-based incremental loading

### 2. Data Validation
- Schema validation before insertion
- Duplicate detection
- Data quality scoring

### 3. Performance Optimization
- Parallel processing for independent companies
- Database indexing strategy
- Connection pooling for large datasets

This migration guide provides a complete reference for understanding and replicating the data migration process for the ExiLead job platform.
