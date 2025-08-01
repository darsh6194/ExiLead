#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Pipeline for Final_Scraper
Automatically saves scraped jobs to PostgreSQL database
"""

import os
import sys
import io

# Fix Windows console encoding issues
if sys.platform == 'win32':
    # Set environment variable to force UTF-8 encoding
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    
    # Reconfigure stdout and stderr to use UTF-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
    
    # Fallback for older Python versions
    if not hasattr(sys.stdout, 'reconfigure'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import psycopg2
from datetime import datetime
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

def safe_print(text):
    """Safe printing function that handles Unicode characters on Windows"""
    try:
        print(text)
    except UnicodeEncodeError:
        # Fallback: replace problematic characters with ASCII equivalents
        emoji_replacements = {
            '✅': '[CHECK]',
            '❌': '[X]',
            '⚠️': '[WARNING]',
            '🗄️': '[DATABASE]',
            '📊': '[CHART]',
            '🏢': '[BUILDING]',
            '⏭️': '[SKIP]',
            '🚀': '[ROCKET]',
            '📁': '[FOLDER]',
            '🎯': '[TARGET]',
            '🗑️': '[TRASH]',
            '🔒': '[LOCK]',
            '=': '='
        }
        
        safe_text = text
        for emoji, replacement in emoji_replacements.items():
            safe_text = safe_text.replace(emoji, replacement)
        
        try:
            print(safe_text)
        except UnicodeEncodeError:
            # Ultimate fallback: encode to ASCII
            print(safe_text.encode('ascii', 'replace').decode('ascii'))

class DatabasePipeline:
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        """Establish connection to PostgreSQL database"""
        try:
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                raise Exception("DATABASE_URL not found in environment variables")
            
            self.connection = psycopg2.connect(database_url)
            print("✅ Database connection established")
            return True
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            print("🔒 Database connection closed")
    
    def ensure_company_exists(self, company_name, source_url=None):
        """Ensure company exists in database, create if not exists"""
        try:
            with self.connection.cursor() as cursor:
                # Check if company exists
                cursor.execute("SELECT id FROM companies WHERE name = %s", (company_name,))
                result = cursor.fetchone()
                
                if result:
                    return result[0]
                
                # Create new company
                cursor.execute("""
                    INSERT INTO companies (name, website, created_at)
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (company_name, source_url, datetime.now()))
                
                company_id = cursor.fetchone()[0]
                self.connection.commit()
                print(f"✅ Created new company: {company_name} (ID: {company_id})")
                return company_id
                
        except Exception as e:
            print(f"❌ Error ensuring company exists: {e}")
            self.connection.rollback()
            return None
    
    def job_exists(self, apply_link):
        """Check if job already exists in database"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("SELECT apply_link FROM jobs WHERE apply_link = %s", (apply_link,))
                return cursor.fetchone() is not None
        except Exception as e:
            print(f"❌ Error checking job existence: {e}")
            return False
    
    def save_job(self, job_data):
        """Save a single job to the database"""
        try:
            # Ensure company exists
            company_name = job_data.get('company', 'Unknown')
            source_url = job_data.get('source_url')
            company_id = self.ensure_company_exists(company_name, source_url)
            
            if not company_id:
                print(f"❌ Failed to get company ID for {company_name}")
                return False
            
            # Check if job already exists
            apply_link = job_data.get('apply_link')
            if not apply_link or apply_link == 'N/A':
                print(f"⚠️ Skipping job without valid apply_link: {job_data.get('title', 'Unknown')}")
                return False
            
            if self.job_exists(apply_link):
                print(f"⏭️ Job already exists: {job_data.get('title', 'Unknown')}")
                return False
            
            with self.connection.cursor() as cursor:
                # Insert job with apply_link as primary key
                cursor.execute("""
                    INSERT INTO jobs (
                        apply_link, company_id, title, location, employment_type, experience_level,
                        work_mode, category, is_technical, description, job_id,
                        department, remote_work, salary, deadline, posted_date,
                        requirements, preferred_qualifications, responsibilities,
                        benefits, skills, tags, source_url,
                        scraped_at, job_details_info, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s
                    )
                    RETURNING apply_link
                """, (
                    apply_link,
                    company_id,
                    job_data.get('title', 'N/A'),
                    job_data.get('location', 'N/A'),
                    job_data.get('employment_type'),
                    job_data.get('experience_level'),
                    job_data.get('remote_work'),  # work_mode
                    self.categorize_job(job_data.get('title', ''), job_data.get('description', '')),
                    self.is_technical_job(job_data.get('title', ''), job_data.get('description', '')),
                    job_data.get('description', 'N/A'),
                    job_data.get('job_id'),
                    job_data.get('department'),
                    job_data.get('remote_work'),
                    job_data.get('salary'),
                    job_data.get('deadline'),
                    job_data.get('posted_date'),
                    json.dumps(job_data.get('requirements', [])) if job_data.get('requirements') else None,
                    json.dumps(job_data.get('preferred_qualifications', [])) if job_data.get('preferred_qualifications') else None,
                    json.dumps(job_data.get('responsibilities', [])) if job_data.get('responsibilities') else None,
                    json.dumps(job_data.get('benefits', [])) if job_data.get('benefits') else None,
                    json.dumps(job_data.get('skills', [])) if job_data.get('skills') else None,
                    json.dumps(job_data.get('tags', [])) if job_data.get('tags') else None,
                    source_url,
                    job_data.get('scraped_at', datetime.now().isoformat()),
                    job_data.get('job_details_info'),
                    datetime.now()
                ))
                
                job_apply_link = cursor.fetchone()[0]
                self.connection.commit()
                print(f"✅ Saved job: {job_data.get('title', 'Unknown')} (Apply Link: {job_apply_link})")
                return job_apply_link
                
        except Exception as e:
            print(f"❌ Error saving job: {e}")
            self.connection.rollback()
            return False
    
    def save_jobs_batch(self, jobs_list):
        """Save multiple jobs to database"""
        stats = {
            'total_jobs': len(jobs_list),
            'saved_jobs': 0,
            'skipped_duplicates': 0,
            'errors': 0
        }
        
        print(f"\n🗄️ SAVING {len(jobs_list)} JOBS TO DATABASE")
        print("=" * 60)
        
        for i, job_data in enumerate(jobs_list, 1):
            print(f"Processing job {i}/{len(jobs_list)}: {job_data.get('title', 'Unknown')}")
            
            # Skip jobs with Gemini errors (fallback jobs)
            if 'gemini_error' in job_data:
                print(f"⚠️ Skipping job with Gemini error: {job_data.get('title', 'Unknown')}")
                stats['errors'] += 1
                continue
            
            # Check if already exists
            apply_link = job_data.get('apply_link')
            if self.job_exists(apply_link):
                print(f"⏭️ Job already exists, skipping: {job_data.get('title', 'Unknown')}")
                stats['skipped_duplicates'] += 1
                continue
            
            # Save job
            result = self.save_job(job_data)
            if result:
                stats['saved_jobs'] += 1
            else:
                stats['errors'] += 1
        
        # Update company job counts
        self.update_company_job_counts()
        
        print(f"\n📊 DATABASE SAVE SUMMARY:")
        print(f"  Total Jobs Processed: {stats['total_jobs']}")
        print(f"  Successfully Saved: {stats['saved_jobs']}")
        print(f"  Skipped (Duplicates): {stats['skipped_duplicates']}")
        print(f"  Errors: {stats['errors']}")
        print(f"  Success Rate: {(stats['saved_jobs'] / max(stats['total_jobs'], 1) * 100):.1f}%")
        print("=" * 60)
        
        return stats
    
    def update_company_job_counts(self):
        """Update job_count for all companies"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE companies 
                    SET job_count = (
                        SELECT COUNT(*) 
                        FROM jobs 
                        WHERE jobs.company_id = companies.id
                    )
                """)
                self.connection.commit()
                print("✅ Updated company job counts")
        except Exception as e:
            print(f"❌ Error updating company job counts: {e}")
            self.connection.rollback()
    
    def categorize_job(self, title, description):
        """Categorize job based on title and description"""
        title_lower = title.lower()
        desc_lower = description.lower()
        
        # Software Development
        if any(keyword in title_lower for keyword in ['software', 'developer', 'engineer', 'programming', 'coding']):
            return 'Software Development'
        
        # Data & Analytics
        if any(keyword in title_lower for keyword in ['data', 'analyst', 'analytics', 'scientist', 'ml', 'ai']):
            return 'Data & Analytics'
        
        # DevOps & Infrastructure
        if any(keyword in title_lower for keyword in ['devops', 'infrastructure', 'cloud', 'aws', 'azure', 'sre']):
            return 'DevOps & Infrastructure'
        
        # Product & Design
        if any(keyword in title_lower for keyword in ['product', 'design', 'ux', 'ui', 'manager']):
            return 'Product & Design'
        
        # Sales & Marketing
        if any(keyword in title_lower for keyword in ['sales', 'marketing', 'business']):
            return 'Sales & Marketing'
        
        # Operations
        if any(keyword in title_lower for keyword in ['operations', 'support', 'customer']):
            return 'Operations'
        
        return 'Other'
    
    def is_technical_job(self, title, description):
        """Determine if job is technical"""
        technical_keywords = [
            'software', 'developer', 'engineer', 'programming', 'coding',
            'data', 'analyst', 'scientist', 'ml', 'ai', 'devops',
            'infrastructure', 'cloud', 'aws', 'azure', 'technical',
            'architect', 'backend', 'frontend', 'fullstack', 'api'
        ]
        
        title_lower = title.lower()
        return any(keyword in title_lower for keyword in technical_keywords) and 'Yes' or 'No'


def save_scraper_results_to_db(results_file, delete_file_after=False):
    """Load scraper results from JSON file and save to database"""
    
    try:
        # Load results from JSON file
        with open(results_file, 'r', encoding='utf-8') as f:
            results = json.load(f)
        
        # Initialize database pipeline
        db_pipeline = DatabasePipeline()
        
        total_stats = {
            'total_companies': 0,
            'total_jobs': 0,
            'saved_jobs': 0,
            'skipped_duplicates': 0,
            'errors': 0
        }
        
        print(f"🚀 AUTOMATED DATABASE PIPELINE STARTED")
        print(f"📁 Loading results from: {results_file}")
        print("=" * 80)
        
        # Process each company's results
        if 'companies' in results:
            companies_data = results['companies']
            total_stats['total_companies'] = len(companies_data)
            
            for company_name, company_data in companies_data.items():
                print(f"\n🏢 Processing {company_name}")
                print("-" * 40)
                
                jobs = company_data.get('jobs', [])
                if not jobs:
                    print(f"⚠️ No jobs found for {company_name}")
                    continue
                
                # Save jobs for this company
                company_stats = db_pipeline.save_jobs_batch(jobs)
                
                # Aggregate stats
                total_stats['total_jobs'] += company_stats['total_jobs']
                total_stats['saved_jobs'] += company_stats['saved_jobs'] 
                total_stats['skipped_duplicates'] += company_stats['skipped_duplicates']
                total_stats['errors'] += company_stats['errors']
        
        # Final summary
        print(f"\n🎯 PIPELINE COMPLETION SUMMARY")
        print("=" * 80)
        print(f"📊 Overall Statistics:")
        print(f"  Companies Processed: {total_stats['total_companies']}")
        print(f"  Total Jobs Processed: {total_stats['total_jobs']}")
        print(f"  Successfully Saved: {total_stats['saved_jobs']}")
        print(f"  Skipped (Duplicates): {total_stats['skipped_duplicates']}")
        print(f"  Errors: {total_stats['errors']}")
        print(f"  Overall Success Rate: {(total_stats['saved_jobs'] / max(total_stats['total_jobs'], 1) * 100):.1f}%")
        print("=" * 80)
        
        # Close database connection
        db_pipeline.close()
        
        # Delete file if requested
        if delete_file_after:
            os.remove(results_file)
            print(f"🗑️ Deleted results file: {results_file}")
        
        return total_stats
        
    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        return None


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python database_pipeline.py <results_file.json> [--delete]")
        print("Example: python database_pipeline.py multi_company_job_results.json")
        sys.exit(1)
    
    results_file = sys.argv[1]
    delete_after = '--delete' in sys.argv
    
    if not os.path.exists(results_file):
        print(f"❌ Results file not found: {results_file}")
        sys.exit(1)
    
    # Run the pipeline
    stats = save_scraper_results_to_db(results_file, delete_after)
    
    if stats:
        print(f"\n✅ Pipeline completed successfully!")
    else:
        print(f"\n❌ Pipeline failed!")
        sys.exit(1)
