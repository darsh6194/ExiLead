# 🤖 ExiLead Automated Pipeline

**Automated Web Scraping with Direct Database Integration**

The ExiLead Automated Pipeline combines web scraping, AI-powered job analysis, and direct database storage into a seamless, production-ready system.

## 🌟 Features

- **🕷️ Intelligent Web Scraping**: Multi-company job scraping with pagination support
- **🧠 AI-Powered Analysis**: Gemini 2.0 Flash integration for job data extraction
- **🗄️ Direct Database Storage**: Automatic PostgreSQL integration with duplicate prevention
- **📊 Comprehensive Analytics**: Real-time statistics and detailed reporting
- **🔄 Automated Pipeline**: One-command operation from scraping to database storage
- **⚡ Performance Optimized**: Efficient duplicate checking and batch processing

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Scraper   │───▶│   AI Processing  │───▶│    Database     │
│   Final_Scraper │    │   Gemini 2.0     │    │   PostgreSQL    │
│                 │    │   Flash          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   • Multi-company         • Job analysis          • Duplicate prevention
   • Pagination           • Data extraction        • Structured storage
   • Dynamic content      • Categorization         • Analytics views
```

## 🚀 Quick Start

### 1. Database Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Setup your .env file with database connection
echo "DATABASE_URL=postgresql://user:password@localhost:5432/exilead" > .env

# Initialize database schema
python database_setup.py --setup
```

### 2. Run Automated Pipeline

```bash
# Run complete pipeline (scraping + database save)
python automated_scraper.py

# Run with custom companies file
python automated_scraper.py --companies my_companies.json

# Run scraping only (no auto-save to database)
python automated_scraper.py --no-auto-save
```

### 3. Monitor Results

```bash
# View database statistics
python automated_scraper.py --stats-only

# View database information
python database_setup.py --info
```

## 📁 File Structure

```
Scraper/
├── automated_scraper.py         # Main automated pipeline
├── database_pipeline.py         # Database integration module
├── database_setup.py           # Database setup and management
├── database_schema.sql          # PostgreSQL schema definition
├── Final_Scraper.py            # Core web scraper (existing)
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
└── README_AUTOMATED_PIPELINE.md
```

## 🛠️ Available Commands

### Automated Scraper
```bash
# Full pipeline with auto-save to database
python automated_scraper.py

# Custom companies file
python automated_scraper.py --companies companies.json

# Skip automatic database save
python automated_scraper.py --no-auto-save

# Keep JSON results file after database save
python automated_scraper.py --keep-json

# Show current database statistics only
python automated_scraper.py --stats-only

# Run database pipeline on existing JSON file
python automated_scraper.py --pipeline-only results.json
```

### Database Management
```bash
# Setup database schema
python database_setup.py --setup

# Test database connection
python database_setup.py --test

# Show database information and statistics
python database_setup.py --info

# Reset database (⚠️ DELETES ALL DATA)
python database_setup.py --reset
```

### Manual Database Pipeline
```bash
# Save existing JSON results to database
python database_pipeline.py multi_company_job_results.json

# Save and delete JSON file after
python database_pipeline.py results.json --delete
```

## 🗄️ Database Schema

### Companies Table
```sql
companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    website VARCHAR(500),
    industry VARCHAR(100),
    job_count INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### Jobs Table
```sql
jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    title VARCHAR(255),
    location VARCHAR(255),
    employment_type VARCHAR(50),
    work_mode VARCHAR(50),
    category VARCHAR(100),
    is_technical VARCHAR(10),
    description TEXT,
    requirements JSONB,
    skills JSONB,
    apply_link VARCHAR(1000) UNIQUE,
    created_at TIMESTAMP,
    ...
)
```

### Available Views
- `company_job_stats`: Statistics per company
- `category_stats`: Job distribution by category
- `recent_jobs`: Jobs added in last 7 days

## 📊 Sample Output

```
🤖 AUTOMATED SCRAPER WITH DATABASE INTEGRATION
================================================================================
🕷️ Starting web scraper...
Command: python Final_Scraper.py

🕷️ SCRAPER COMPLETED in 125.30 seconds
================================================================================

🗄️ STARTING DATABASE SAVE PROCESS
================================================================================

🏢 Processing TechCorp
----------------------------------------
✅ Saved job: Senior Software Engineer (ID: 1)
✅ Saved job: Data Scientist (ID: 2)
⏭️ Job already exists, skipping: Product Manager

📊 DATABASE SAVE SUMMARY:
  Total Jobs Processed: 47
  Successfully Saved: 35
  Skipped (Duplicates): 8
  Errors: 4
  Success Rate: 74.5%

🎯 COMPLETE PIPELINE SUMMARY
================================================================================
⏱️ Timing:
  Scraping Time: 125.30 seconds
  Database Save Time: 12.45 seconds
  Total Pipeline Time: 137.75 seconds
📊 Final Results:
  Total Jobs Processed: 47
  Successfully Saved to DB: 35
  Skipped (Duplicates): 8
  Overall Success Rate: 74.5%
================================================================================

📊 CURRENT DATABASE STATISTICS
============================================================
🏢 Total Companies: 12
💼 Total Jobs: 245
🆕 Jobs Added (Last 24h): 35

🏷️ Top Job Categories:
  Software Development: 98 jobs
  Data & Analytics: 67 jobs
  DevOps & Infrastructure: 34 jobs
============================================================
```

## 🔧 Configuration

### Environment Variables (.env)
```env
# Required
DATABASE_URL=postgresql://username:password@localhost:5432/exilead

# Optional
GEMINI_API_KEY=your_gemini_api_key_here
SCRAPER_DELAY=2
MAX_PAGES_PER_COMPANY=10
```

### Companies Configuration (companies.json)
```json
{
  "TechCorp": {
    "base_url": "https://techcorp.com/careers/",
    "max_pages": 5
  },
  "DataSoft": {
    "base_url": "https://datasoft.com/jobs/",
    "max_pages": 3
  }
}
```

## 📈 Performance Features

### Duplicate Prevention
- **Apply Link Checking**: Prevents re-scraping existing jobs
- **Database-Level Constraints**: Ensures data integrity
- **Graceful Fallback**: Continues processing if database check fails

### Efficient Processing
- **Batch Operations**: Groups database operations for better performance
- **Indexed Queries**: Fast lookups using optimized database indexes
- **Memory Management**: Processes large datasets without memory issues

### Comprehensive Logging
- **Real-time Progress**: Shows processing status as jobs are handled
- **Detailed Statistics**: Tracks success rates, duplicates, and errors
- **Error Handling**: Logs issues without stopping the entire process

## 🚦 Error Handling

### Database Connection Issues
- Graceful fallback to JSON-only mode
- Automatic retry mechanisms
- Clear error messages and recovery instructions

### Scraping Failures
- Individual job failure doesn't stop batch processing
- Detailed error logging for debugging
- Statistics track success/failure rates

### Data Validation
- Schema validation before database insertion
- Handles missing or malformed data gracefully
- Comprehensive data cleaning and normalization

## 🔍 Monitoring & Analytics

### Database Views
```sql
-- Company statistics with job counts
SELECT * FROM company_job_stats;

-- Category distribution
SELECT * FROM category_stats;

-- Recent activity (last 7 days)
SELECT * FROM recent_jobs;

-- Find duplicate jobs
SELECT * FROM find_duplicate_jobs();
```

### Performance Monitoring
- Track scraping duration per company
- Monitor database save performance
- Analyze duplicate detection efficiency
- Success rate tracking across runs

## 🛡️ Best Practices

### Production Deployment
1. **Environment Setup**: Use production database credentials
2. **Scheduling**: Set up cron jobs for regular scraping
3. **Monitoring**: Implement log monitoring and alerting
4. **Backup**: Regular database backups before major runs

### Data Quality
1. **Validation**: Review scraped data quality regularly
2. **Deduplication**: Monitor duplicate detection effectiveness
3. **Categorization**: Validate AI-powered job categorization
4. **Cleanup**: Regular cleanup of outdated job postings

### Security
1. **Credentials**: Store database credentials securely
2. **Access Control**: Limit database access permissions
3. **API Keys**: Secure Gemini API key storage
4. **Network**: Use secure database connections

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check database URL
python database_setup.py --test

# Verify PostgreSQL is running
systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS
```

**No Results File Found**
- Check if Final_Scraper.py completed successfully
- Verify output file naming convention
- Look for error messages in scraper output

**High Duplicate Rate**
- Normal for frequent scraping of same companies
- Check if apply_link extraction is working correctly
- Review database for data quality issues

### Debug Mode
```bash
# Run with verbose output
python automated_scraper.py --keep-json

# Check individual components
python database_setup.py --info
python database_pipeline.py results.json
```

## 🔄 Integration Examples

### Scheduled Scraping (Cron)
```bash
# Add to crontab for daily scraping at 2 AM
0 2 * * * cd /path/to/scraper && python automated_scraper.py >> scraper.log 2>&1
```

### API Integration
```python
from automated_scraper import run_scraper_with_db_integration

# Programmatic usage
success = run_scraper_with_db_integration(
    companies_file="custom_companies.json",
    auto_save=True,
    keep_json=False
)
```

## 📞 Support

For issues, questions, or contributions:
1. Check the troubleshooting section above
2. Review error logs for specific issues
3. Test individual components separately
4. Verify database connectivity and schema

---

**🎯 The ExiLead Automated Pipeline - From Web to Database in One Command!**
