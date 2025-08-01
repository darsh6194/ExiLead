# PostgreSQL Setup Guide

## Prerequisites

1. **PostgreSQL Database**: You need a PostgreSQL database. You can use:
   - Local PostgreSQL installation
   - [Neon Database](https://neon.tech) (recommended for cloud)
   - [Supabase](https://supabase.com)
   - [Railway](https://railway.app)
   - [Vercel Postgres](https://vercel.com/storage/postgres)

## Setup Steps

### 1. Create Database

If using Neon Database:
1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project
3. Copy the connection string

### 2. Set Environment Variable

Create a `.env` file in the project root:

```bash
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

### 3. Push Database Schema

This creates the tables in your PostgreSQL database:

```bash
npm run db:push
```

### 4. Migrate JSON Data to PostgreSQL

This loads all the job data from `data/Final_json_with_categories.json` into PostgreSQL:

```bash
npm run db:migrate
```

### 5. Start the Application

```bash
npm run dev
```

## What the Migration Does

The `npm run db:migrate` command:

1. **Clears existing data** from the database
2. **Loads companies** from the JSON file
3. **Filters to only technical jobs** (where `is_technical: "Technical"`)
4. **Creates company records** with proper job counts
5. **Inserts all technical jobs** with proper categorization
6. **Sets up relationships** between companies and jobs

## Database Schema

### Companies Table
- `id` - Primary key
- `name` - Company name
- `industry` - Industry type
- `website` - Company website
- `description` - Company description
- `logo` - Logo URL
- `jobCount` - Number of technical jobs
- `createdAt` - Creation timestamp

### Jobs Table
- `id` - Primary key
- `companyId` - Foreign key to companies
- `title` - Job title
- `location` - Job location
- `employmentType` - Full-time, Part-time, etc.
- `workMode` - Remote, On-site, Hybrid
- `category` - Job category (Software Development, etc.)
- `isTechnical` - "Technical" or "Non-Technical"
- `description` - Job description
- `requirements` - Array of requirements
- `benefits` - Array of benefits
- `skills` - Array of required skills
- `applyLink` - Application URL
- `sourceUrl` - Source URL
- `postedDate` - When job was posted
- `deadline` - Application deadline
- `salary` - Salary information
- `createdAt` - Creation timestamp

## API Endpoints

After migration, these endpoints will use PostgreSQL:

- `GET /api/companies` - All companies
- `GET /api/companies/:id` - Company with jobs
- `GET /api/jobs` - All technical jobs (paginated)
- `GET /api/jobs/:id` - Specific job
- `GET /api/categories` - All job categories
- `GET /api/categories/:category/jobs` - Jobs by category
- `GET /api/search?q=query` - Search companies and jobs

## Performance Benefits

Using PostgreSQL provides:

- **Persistence**: Data survives server restarts
- **Scalability**: Handle large datasets efficiently
- **Relationships**: Proper foreign key constraints
- **Indexing**: Fast search and filtering
- **Transactions**: Data consistency
- **Backup**: Built-in backup and recovery

## Troubleshooting

### Connection Issues
- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Ensure SSL settings match your provider

### Migration Issues
- Check JSON file exists at `data/Final_json_with_categories.json`
- Verify database tables exist (run `npm run db:push` first)
- Check logs for specific error messages

### Data Issues
- Migration filters to only technical jobs
- Company job counts reflect only technical jobs
- Categories come from technical jobs only
