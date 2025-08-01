# ExiLead Job Platform - Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Backend Implementation](#backend-implementation)
3. [Database Schema](#database-schema)
4. [Data Migration Process](#data-migration-process)
5. [API Endpoints](#api-endpoints)
6. [Storage Implementation](#storage-implementation)
7. [Category Filtering System](#category-filtering-system)
8. [Technical Jobs Filtering](#technical-jobs-filtering)
9. [Deployment Guide](#deployment-guide)

## Architecture Overview

### Tech Stack
- **Backend**: Express.js + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS + shadcn/ui components

### Project Structure
```
ExiLead/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Route pages
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and types
├── server/               # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Memory storage implementation
│   ├── database-storage.ts # PostgreSQL implementation
│   ├── db-local.ts       # Database connection
│   └── migrate-data.ts   # Migration script
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database schema definitions
└── data/                 # JSON data files
    └── Final_json_with_categories.json
```

## Backend Implementation

### 1. Storage Interface Pattern

We implemented a storage interface pattern to support both memory and database storage:

```typescript
export interface IStorage {
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyWithJobs(id: number, page?: number, limit?: number): Promise<(CompanyWithJobs & { pagination?: { total: number, hasMore: boolean } }) | undefined>;
  getJobs(page?: number, limit?: number): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  getJobsByCompany(companyId: number): Promise<Job[]>;
  getJobsByCategory(category: string, page?: number, limit?: number): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  getCategories(): Promise<string[]>;
  getJob(id: number): Promise<Job | undefined>;
  searchCompaniesAndJobs(query: string): Promise<{ companies: Company[], jobs: Job[] }>;
  createCompany(company: InsertCompany): Promise<Company>;
  createJob(job: InsertJob): Promise<Job>;
  loadDataFromJson(): Promise<void>;
}
```

### 2. Database Storage Implementation

The `DatabaseStorage` class implements the storage interface using PostgreSQL:

```typescript
export class DatabaseStorage implements IStorage {
  // Implementation details in database-storage.ts
}
```

## Database Schema

### Companies Table
```typescript
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }).notNull(),
  website: varchar("website", { length: 500 }),
  description: text("description"),
  logo: varchar("logo", { length: 500 }),
  jobCount: integer("job_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Jobs Table
```typescript
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  title: varchar("title", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  employmentType: varchar("employment_type", { length: 50 }),
  workMode: varchar("work_mode", { length: 50 }),
  category: varchar("category", { length: 100 }),
  isTechnical: varchar("is_technical", { length: 20 }),
  description: text("description"),
  requirements: text("requirements").array(),
  benefits: text("benefits").array(),
  skills: text("skills").array(),
  applyLink: varchar("apply_link", { length: 500 }),
  sourceUrl: varchar("source_url", { length: 500 }),
  postedDate: varchar("posted_date", { length: 100 }),
  deadline: varchar("deadline", { length: 100 }),
  salary: varchar("salary", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

## Data Migration Process

### 1. Migration Script Setup

The migration process is handled by `server/migrate-data.ts`:

```typescript
// Environment loading (manual .env parsing)
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

### 2. Data Processing Pipeline

The migration follows these steps:

1. **Environment Setup**: Load database connection string
2. **Connection Test**: Verify PostgreSQL connection
3. **Schema Creation**: Create tables if they don't exist
4. **Data Extraction**: Parse JSON data file
5. **Company Processing**: Insert companies with metadata
6. **Job Processing**: Filter and insert only technical jobs
7. **Batch Processing**: Handle large datasets with batching

### 3. Technical Jobs Filtering

Only jobs with `is_technical: "Technical"` are migrated:

```typescript
const technicalJobs = company_data.jobs?.filter((job: any) => job.is_technical === "Technical") || [];
```

### 4. Batch Processing for Large Datasets

To handle companies with thousands of jobs (like Accenture with 9,018 jobs):

```typescript
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
```

## API Endpoints

### Company Endpoints
- `GET /api/companies` - List all companies with job counts
- `GET /api/companies/:id` - Get specific company with paginated jobs

### Job Endpoints
- `GET /api/jobs` - Get paginated list of all technical jobs
- `GET /api/jobs/:id` - Get specific job details
- `GET /api/categories/:category/jobs` - Get jobs filtered by category

### Category & Search Endpoints
- `GET /api/categories` - Get all available job categories
- `GET /api/search?q=query` - Search companies and jobs

## Storage Implementation

### 1. Job Fetching Implementation

```typescript
async getJobs(page: number = 1, limit: number = 20): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
  const offset = (page - 1) * limit;
  
  // Get total count of technical jobs
  const totalResult = await db.select({ count: jobs.id }).from(jobs);
  const total = totalResult.length;
  
  // Get paginated technical jobs
  const allJobs = await db.select().from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);
    
  const hasMore = offset + limit < total;
  
  return { jobs: allJobs, total, hasMore };
}
```

### 2. Category-Based Filtering

```typescript
async getJobsByCategory(category: string, page: number = 1, limit: number = 20): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
  const offset = (page - 1) * limit;
  
  // Get total count of technical jobs in this category
  const totalResult = await db.select({ count: jobs.id }).from(jobs)
    .where(eq(jobs.category, category));
  const total = totalResult.length;
  
  // Get paginated technical jobs in this category
  const categoryJobs = await db.select().from(jobs)
    .where(eq(jobs.category, category))
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);
    
  const hasMore = offset + limit < total;
  
  return { jobs: categoryJobs, total, hasMore };
}
```

### 3. Search Implementation

```typescript
async searchCompaniesAndJobs(query: string): Promise<{ companies: Company[], jobs: Job[] }> {
  const searchPattern = `%${query.toLowerCase()}%`;
  
  const matchedCompanies = await db.select().from(companies)
    .where(or(
      like(companies.name, searchPattern),
      like(companies.industry, searchPattern)
    ));

  const matchedJobs = await db.select().from(jobs)
    .where(or(
      like(jobs.title, searchPattern),
      like(jobs.location, searchPattern),
      like(jobs.category, searchPattern)
    ));

  return { companies: matchedCompanies, jobs: matchedJobs };
}
```

## Category Filtering System

### Available Categories (20 total)
1. Administrative
2. Consulting
3. Customer Success/Support
4. Cybersecurity
5. Data Science/Analytics
6. Design/UX
7. DevOps/Infrastructure
8. Education
9. Finance/Accounting
10. HR/Recruiting
11. Healthcare
12. Legal
13. Management
14. Marketing
15. Operations
16. Product Management
17. Quality Assurance
18. Sales
19. Software Engineering
20. Other

### Category Extraction Logic
Categories are extracted from the JSON data and stored in the `category` field of each job.

## Technical Jobs Filtering

### Implementation
All database operations filter for technical jobs only:

```typescript
// Only technical jobs are migrated
const technicalJobs = company_data.jobs?.filter((job: any) => job.is_technical === "Technical") || [];

// Category listing only shows technical job categories
async getCategories(): Promise<string[]> {
  const result = await db.selectDistinct({ category: jobs.category }).from(jobs)
    .where(eq(jobs.isTechnical, "Technical"));
  return result.map(r => r.category).filter((cat): cat is string => cat !== null).sort();
}
```

## Deployment Guide

### 1. Environment Setup
Create `.env` file with PostgreSQL connection:
```
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### 2. Database Setup
```bash
# Install PostgreSQL locally or use cloud provider
# Create database
createdb ExiLead

# Run migration
npm run db:migrate
```

### 3. Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Production Build
```bash
# Build frontend
npm run build

# Start production server
npm start
```

## Migration Results

### Successfully Migrated Data
- **42 companies** from various industries
- **13,966 technical jobs** across 20 categories
- **Largest company**: Accenture with 9,018 technical jobs
- **Total processing time**: ~2-3 minutes with batch processing

### Key Companies Migrated
- Accenture (9,018 jobs)
- IBM (1,250 jobs)
- Amazon (1,228 jobs)
- Citi Bank (746 jobs)
- Goldman Sachs (644 jobs)
- And 37 more companies

### Performance Optimizations
1. **Batch Processing**: 100-job batches for large companies
2. **Progress Tracking**: Visual feedback for large migrations
3. **Memory Management**: Avoiding stack overflow on bulk inserts
4. **Database Indexing**: Automatic indexing on foreign keys and search fields

## API Response Examples

### Get Companies
```json
[
  {
    "id": 1,
    "name": "Mastercard",
    "industry": "Technology",
    "website": "https://careers.mastercard.com/us/en/search-results",
    "description": "Mastercard is a leading technology company...",
    "jobCount": 172,
    "createdAt": "2025-07-21T09:15:00Z"
  }
]
```

### Get Jobs by Category
```json
{
  "jobs": [
    {
      "id": 192,
      "companyId": 2,
      "title": "Solution Architect - AdTech, Amazon Advertising",
      "location": "Bengaluru, KA, IND",
      "employmentType": "Full-time",
      "workMode": "On-site",
      "category": "Consulting",
      "isTechnical": "Technical",
      "description": "Join Amazon as a Solution Architect...",
      "skills": ["AWS", "Architecture", "AdTech"],
      "createdAt": "2025-07-21T09:15:00Z"
    }
  ],
  "total": 156,
  "hasMore": true
}
```

This documentation provides a comprehensive overview of how the ExiLead job platform implements backend operations, data migration, and job fetching with category-based filtering for technical positions only.
