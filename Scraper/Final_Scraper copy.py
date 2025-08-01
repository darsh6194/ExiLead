# -*- coding: utf-8 -*-
"""
Windows Console Encoding Fix for Unicode Characters (Emojis)
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

from crawl4ai import BM25ContentFilter
from playwright.sync_api import sync_playwright
import json
import time
import re
import asyncio
import time
# Import the special case scraper
from crawl_ex import UniversalJobScraper
import google.generativeai as genai
import json as _json
from datetime import datetime
from urllib.parse import urlparse
from cookie_handler import CookieBannerHandler, apply_cookie_handling
import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ==========================================
# WINDOWS UNICODE SAFE PRINTING
# ==========================================
def safe_print(text):
    """Safe printing function that handles Unicode characters on Windows"""
    try:
        print(text)
    except UnicodeEncodeError:
        # Fallback: replace problematic characters with ASCII equivalents
        emoji_replacements = {
            '🚀': '[ROCKET]',
            '🎯': '[TARGET]', 
            '📊': '[CHART]',
            '✅': '[CHECK]',
            '❌': '[X]',
            '⚠️': '[WARNING]',
            '🕷️': '[SPIDER]',
            '🗄️': '[DATABASE]',
            '📋': '[CLIPBOARD]',
            '💡': '[BULB]',
            '🔍': '[SEARCH]',
            '⏭️': '[SKIP]',
            '🏢': '[BUILDING]',
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

# ==========================================
# CONFIGURATION FILE PATH
# ==========================================
COMPANIES_CONFIG_FILE = "multi_company_selectors.json"  # Path to the JSON file with company configurations

# Global settings
GLOBAL_CONFIG = {
    'max_jobs_per_company': 100000,  # Maximum jobs per company
    'headless': True,               # Set to True to run browser in background  
    'delay_between_companies': 2,   # Seconds to wait between companies
    'max_pages_fallback': 5000,       # Fallback max pages if not specified
    'scroll_pause': 2,              # Seconds to wait between scrolls
    'use_extension': False,         # Use browser extension for cookie handling
    'cookie_strategy': 'hide_and_accept',  # Cookie handling strategy: hide_only, click_only, hide_and_accept, hide_and_reject
}

# Database connection for duplicate checking
def get_db_connection():
    """Get database connection using environment variables"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            safe_print("⚠️ DATABASE_URL not found in environment variables")
            return None
        
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        safe_print(f"⚠️ Database connection failed: {e}")
        return None

def check_apply_link_exists(apply_link):
    """Check if apply_link already exists in the database"""
    if not apply_link or apply_link == 'N/A':
        return False
    
    try:
        conn = get_db_connection()
        if not conn:
            # If database connection fails, don't skip jobs
            safe_print("⚠️ Database unavailable, proceeding without duplicate check")
            return False
        
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM jobs WHERE apply_link = %s", (apply_link,))
            count = cursor.fetchone()[0]
            conn.close()
            
            if count > 0:
                safe_print(f"🔍 Duplicate apply_link found, skipping job: {apply_link}")
                return True
            return False
            
    except Exception as e:
        safe_print(f"⚠️ Error checking apply_link in database: {e}")
        # If database check fails, don't skip the job
        return False

async def handle_special_case_scraping(config, browser_config=None, cookie_handler=None):
    """Handle special case scraping using crawl_ex UniversalJobScraper with advanced browser configuration"""
    safe_print(f"🎯 Starting special case scraping for {config.get('company_name', 'Unknown')}")
    
    try:
        # Create UniversalJobScraper configuration from Final_Scraper config
        universal_config = {
            "company": config.get('company_name', 'Unknown'),
            "url": config['url'],
            "job_card": config.get('card_selector', '.job-card'),
            "title": config.get('title_selector', '.title'),
            "click_target": config.get('click_target', config.get('title_selector', '.title')),
            "location": config.get('location_selector', '.location'),
            "posted_selector": config.get('posted_selector', '.posted'),
            "pagination_selector": config.get('pagination_selector', '.pagination'),
            "pagination_type": config.get('pagination_type', 'Load_more'),
            "detail_container": config.get('detail_container', '.position-container'),
            "detail_selectors": {
                "title": [config.get('title_selector', '.title'), "h1", ".job-title"],
                "description": [config.get('description_selector', '.description'), ".position-job-description", "[data-automation-id='description']"],
                "requirements": [".qualifications", ".requirements", "[class*='requirement']"],
                "location": [config.get('location_selector', '.location'), "[class*='location']"],
                "employment_type": [".employment-type", "[class*='employment']"],
                "posted_date": [config.get('posted_selector', '.posted'), ".posted-date"]
            },
            # Pass browser configuration for advanced cookie handling
            "browser_config": browser_config,
            "cookie_handler": cookie_handler
        }
        
        # Initialize the Universal Job Scraper with browser configuration
        scraper = UniversalJobScraper(company_config=universal_config)
        
        # Scrape jobs using the crawl_ex method with advanced browser setup
        safe_print("🚀 Starting crawl_ex scraping with advanced browser configuration...")
        job_data = await scraper.scrape_jobs()
        
        if job_data:
            safe_print(f"✅ crawl_ex extracted {len(job_data)} jobs")
            
            # Convert crawl_ex format to Final_Scraper cleaned_job format (no Gemini processing here)
            cleaned_jobs = []
            for i, job in enumerate(job_data):
                safe_print(f"🔄 Preparing job {i+1}/{len(job_data)} for Gemini processing...")
                
                # Check for duplicates
                apply_link = job.get('apply_link', 'N/A')
                if check_apply_link_exists(apply_link):
                    safe_print(f"⏭️ Skipping duplicate job: {job.get('title', 'Unknown')}")
                    continue
                
                # Convert to Final_Scraper cleaned_job format (same as extract_and_clean_job_details output)
                cleaned_job_data = {
                    'title': job.get('title', 'N/A'),
                    'company': job.get('company', config.get('company_name', 'N/A')),
                    'location': job.get('location', 'N/A'),
                    'posted_date': job.get('posted_date', 'N/A'),
                    'apply_link': apply_link,
                    'description': job.get('description', 'N/A'),
                    'job_details_info': job.get('full_job_details', 'N/A'),
                    'source_url': config.get('url', 'N/A'),
                    'scraped_at': job.get('scraped_at', time.strftime('%Y-%m-%d %H:%M:%S')),
                    
                    # Additional fields from crawl_ex
                    'requirements': job.get('requirements', 'N/A'),
                    'employment_type': job.get('employment_type', 'N/A'),
                    'remote_work': job.get('remote_work', 'N/A'),
                    'salary': job.get('salary', 'N/A'),
                    'experience_level': job.get('experience_level', 'N/A'),
                    'department': job.get('department', 'N/A'),
                    'benefits': job.get('benefits', 'N/A'),
                    'skills': job.get('skills', 'N/A'),
                    'deadline': job.get('deadline', 'N/A'),
                    'job_id': job.get('job_id', 'N/A')
                }
                
                # Clean up description and job details (same as extract_and_clean_job_details)
                if cleaned_job_data['description'] != 'N/A':
                    cleaned_job_data['description'] = ' '.join(cleaned_job_data['description'].split())
                
                if cleaned_job_data['job_details_info'] != 'N/A':
                    cleaned_job_data['job_details_info'] = ' '.join(cleaned_job_data['job_details_info'].split())
                
                cleaned_jobs.append(cleaned_job_data)
                safe_print(f"✅ Prepared: {cleaned_job_data.get('title', 'Unknown')}")
            
            safe_print(f"🎉 Special case data preparation completed: {len(cleaned_jobs)} jobs ready for Gemini")
            return cleaned_jobs
            
        else:
            safe_print("⚠️ No jobs extracted by crawl_ex method")
            return []
            
    except Exception as e:
        safe_print(f"❌ Error in special case scraping: {str(e)}")
        return []

def scrape_special_case_company(config, overall_start_time, browser_config=None, cookie_handler=None):
    """Handle special case scraping for a company using crawl_ex method with advanced browser configuration"""
    company_name = config.get('company_name', config.get('company', 'Unknown'))
    start_time = datetime.now()
    
    try:
        safe_print(f"🚀 Starting special case scraping for {company_name} with advanced browser config")
        
        # Use asyncio to run the async crawl_ex method with browser configuration
        import asyncio
        import threading
        import concurrent.futures
        
        def run_async_in_thread():
            """Run async function in a separate thread with its own event loop"""
            return asyncio.run(handle_special_case_scraping(config, browser_config, cookie_handler))
        
        # Run the async function in a separate thread to avoid event loop conflicts
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_async_in_thread)
            cleaned_jobs_data = future.result(timeout=300)  # 5 minute timeout
        
        # Now process each cleaned job through the same Gemini pipeline as regular scraping
        processed_jobs = []
        for i, cleaned_job_data in enumerate(cleaned_jobs_data):
            safe_print(f"🤖 Processing job {i+1}/{len(cleaned_jobs_data)} with unified Gemini pipeline...")
            
            try:
                # Use the same Gemini processing as regular scraping
                GEMINI_API_KEY = os.getenv("GEMINI_KEY")
                if GEMINI_API_KEY:
                    import google.generativeai as genai
                    genai.configure(api_key=GEMINI_API_KEY)
                    model = genai.GenerativeModel('gemini-2.0-flash')
                    
                    # Create the same comprehensive prompt as regular scraping
                    gemini_prompt = f"""
You are a professional job data analyst. Analyze the following scraped job data and create a clean, structured JSON response.

RAW JOB DATA:
{json.dumps(cleaned_job_data, indent=2, ensure_ascii=False)}

TASK: Extract and structure the following information into a clean JSON format:

REQUIRED FIELDS:
- title: Job title (string)
- company: Company name (string)
- location: Job location (string)
- posted_date: When the job was posted (string, format: MM/DD/YYYY or "N/A")
- apply_link: Application URL (string)
- experience: Experience level required (string, e.g., "3-5 years", "N/A")
- job_id: Job identifier if available either check from the job details info or check in the URL  (string or number or null)
- department: Department/team (string or null)
- employment_type: Full-time, Part-time, Contract, etc. (string or null)
- experience_level: Entry, Mid, Senior, etc. (string or null)
- remote_work: Remote, Hybrid, On-site (string or null)
- salary: Salary information if available (string or null)
- deadline: Application deadline if available (string or null)

DETAILED FIELDS:
- description: Clean and Short job description (string)
- requirements: Array of required qualifications/skills
- preferred_qualifications: Array of preferred qualifications/skills
- responsibilities: Array of job responsibilities
- benefits: Array of benefits/perks
- skills: Array of technical skills mentioned
- tags: Array of relevant tags/categories

RULES:
1. Clean and normalize all text data
2. Convert lists to proper arrays
3. Use null for missing data (not "N/A")
4. Extract skills from requirements and description
5. Identify experience level from title and requirements
6. Determine employment type from description
7. Extract salary if mentioned
8. Parse dates into consistent format
9. Remove HTML tags and extra whitespace
10. Ensure all arrays are properly formatted

OUTPUT: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text.
"""
                    
                    response = model.generate_content(gemini_prompt)
                    cleaned_text = response.text if hasattr(response, 'text') else str(response)
                    
                    # Clean the response text
                    cleaned_text = cleaned_text.strip()
                    
                    # Remove markdown code blocks if present
                    if cleaned_text.startswith('```json'):
                        cleaned_text = cleaned_text[7:]
                    if cleaned_text.startswith('```'):
                        cleaned_text = cleaned_text[3:]
                    if cleaned_text.endswith('```'):
                        cleaned_text = cleaned_text[:-3]
                    
                    cleaned_text = cleaned_text.strip()
                    
                    try:
                        # Parse the JSON response
                        gemini_result = json.loads(cleaned_text)
                        
                        # Merge with original data, prioritizing Gemini results
                        final_job = cleaned_job_data.copy()
                        final_job.update(gemini_result)
                        
                        processed_jobs.append(final_job)
                        safe_print(f"✅ Successfully processed: {final_job.get('title', 'Unknown')}")
                        
                    except json.JSONDecodeError as e:
                        safe_print(f"⚠️ Gemini JSON parsing failed for job {i+1}: {e}")
                        # Fall back to original cleaned data
                        processed_jobs.append(cleaned_job_data)
                        
                else:
                    safe_print(f"⚠️ No GEMINI_KEY found, using raw cleaned data")
                    processed_jobs.append(cleaned_job_data)
                    
            except Exception as e:
                safe_print(f"❌ Error in unified Gemini processing for job {i+1}: {str(e)}")
                # Fall back to original cleaned data
                processed_jobs.append(cleaned_job_data)
        
        # Update the job count to reflect processed jobs
        jobs = processed_jobs
        
        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds()
        
        safe_print(f"🎉 Special case scraping completed for {company_name}")
        safe_print(f"📊 Results: {len(jobs)} jobs extracted in {total_time:.2f} seconds")
        
        return {
            "company_name": company_name,
            "config": config,
            "jobs": jobs,
            "start_time": start_time,
            "end_time": end_time,
            "pages_scraped": 1,  # crawl_ex handles all pages internally
            "errors": [],
            "timing_data": {
                "navigation": total_time * 0.3,  # Estimate
                "cookie_handling": total_time * 0.1,
                "page_load": total_time * 0.2,
                "extraction": total_time * 0.4,
                "total": total_time
            },
            "status": "completed",
            "statistics": {
                'total_job_cards_found': len(jobs),
                'skipped_duplicates': 0,  # Handled internally
                'skipped_extraction_errors': 0,
                'successful_extractions': len(jobs),
                'gemini_processing_errors': 0,
                'crawl4ai_errors': 0,
                'browser_closed_early': False,
                'special_case_used': True
            }
        }
        
    except Exception as e:
        safe_print(f"❌ Error in special case scraping for {company_name}: {str(e)}")
        end_time = datetime.now()
        
        return {
            "company_name": company_name,
            "config": config,
            "jobs": [],
            "start_time": start_time,
            "end_time": end_time,
            "pages_scraped": 0,
            "errors": [f"Special case scraping error: {str(e)}"],
            "timing_data": {"total": 0},
            "status": "failed",
            "statistics": {
                'total_job_cards_found': 0,
                'skipped_duplicates': 0,
                'skipped_extraction_errors': 0,
                'successful_extractions': 0,
                'gemini_processing_errors': 0,
                'crawl4ai_errors': 0,
                'browser_closed_early': False,
                'special_case_used': True
            }
        }

def aggregate_stats(overall_stats, page_stats):
    """Aggregate statistics from individual page extraction"""
    overall_stats['total_job_cards_found'] += page_stats['total_job_cards_found']
    overall_stats['skipped_duplicates'] += page_stats['skipped_duplicates']
    overall_stats['skipped_extraction_errors'] += page_stats['skipped_extraction_errors']
    overall_stats['successful_extractions'] += page_stats['successful_extractions']
    overall_stats['gemini_processing_errors'] += page_stats['gemini_processing_errors']
    overall_stats['crawl4ai_errors'] += page_stats['crawl4ai_errors']
    if page_stats['browser_closed_early']:
        overall_stats['browser_closed_early'] = True
    return overall_stats

# ==========================================
# EXAMPLE CONFIGURATIONS FOR DIFFERENT SITES
# ==========================================

# Google Careers Example:
# CONFIG = {
#     'company_name': 'Google',
#     'url': 'https://www.google.com/about/careers/applications/jobs/results?location=India&skills=Software',
#     'card_selector': '.Ln1EL',
#     'title_selector': '.QJPWVe',
#     'location_selector': '.r0wTof',
#     'posted_selector': '.Xsxa1e',
#     'link_selector': 'a',
#     'metadata_selector': '.r0wTof',  # If this contains both location and date
#     'use_metadata_parsing': True,    # Enable auto-parsing
#     'pagination_type': 'button_click',
#     'pagination_selector': '.WpHeLc.VfPpkd-mRLv6[aria-label="Go to next page"]',
#     'max_pages': 3,
#     'max_jobs': 50,
#     'headless': False,
# }

# Nokia Example with metadata parsing:
# CONFIG = {
#     'company_name': 'Nokia',
#     'url': 'https://fa-evmr-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs',
#     'card_selector': '.job-tile',
#     'title_selector': '.job-title',
#     'metadata_selector': '.job-info',  # Contains "Locations\nIndia\n\n\nPosting Dates07/16/2025"
#     'use_metadata_parsing': True,
#     'link_selector': 'a',
#     'pagination_type': 'button_click',
#     'pagination_selector': '.next-button',
#     'max_pages': 5,
#     'max_jobs': 100,
#     'headless': False,
# }

# LinkedIn Jobs Example:
# CONFIG = {
#     'url': 'https://www.linkedin.com/jobs/search/',
#     'card_selector': '.job-search-card',
#     'title_selector': '.job-search-card__title',
#     'location_selector': '.job-search-card__location',
#     'posted_selector': '.job-search-card__listdate',
#     'link_selector': 'a',
#     'pagination_type': 'button_click',
#     'pagination_selector': '.artdeco-pagination__button--next',
#     'max_pages': 5,
#     'max_jobs': 100,
#     'headless': False,
# }

# Amazon Jobs Example:
# CONFIG = {
#     'url': 'https://www.amazon.jobs/en/search?offset=0&result_limit=10&sort=relevant&category%5B%5D=software-development',
#     'card_selector': '.job',
#     'title_selector': '.job-title',
#     'location_selector': '.location-and-id',
#     'posted_selector': '.info',
#     'link_selector': 'a.read-more',
#     'pagination_type': 'button_click',
#     'pagination_selector': '.btn.circle.right',
#     'max_pages': 3,
#     'max_jobs': 50,
#     'headless': False,
# }

def load_companies_config(filename):
    """Load companies configuration from JSON file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            companies = json.load(f)
        safe_print(f"✅ Loaded configuration for {len(companies)} companies from {filename}")
        return companies
    except FileNotFoundError:
        safe_print(f"❌ Configuration file not found: {filename}")
        print("Please create a JSON file with company configurations.")
        return None
    except json.JSONDecodeError as e:
        safe_print(f"❌ Invalid JSON in {filename}: {e}")
        return None
    except Exception as e:
        safe_print(f"❌ Error loading {filename}: {e}")
        return None

def normalize_company_config(company_config):
    """Normalize company configuration to match expected format"""
    config = company_config.copy()
    
    # Map different field names to standard names
    field_mapping = {
        'job_card': 'card_selector',
        'title': 'title_selector', 
        'location': 'location_selector',
        'link': 'link_selector',
        'posted': 'posted_selector',
        'description': 'description_selector',
        'metadata': 'metadata_selector',
        'company': 'company_name'
    }
    
    # Apply field mapping
    for old_name, new_name in field_mapping.items():
        if old_name in config and new_name not in config:
            config[new_name] = config[old_name]
    
    # Check for special case flag
    config['special_case'] = config.get('special_case', False)
    
    # If special case, ensure required fields for crawl_ex integration
    if config.get('special_case', False):
        special_defaults = {
            'click_target': config.get('click_target', config.get('title_selector', '.title')),
            'detail_container': config.get('detail_container', '.position-container'),
            'pagination_type': config.get('pagination_type', 'Load_more')
        }
        for key, value in special_defaults.items():
            if key not in config:
                config[key] = value

    # Set defaults for missing fields
    defaults = {
        'card_selector': config.get('job_card', ''),
        'title_selector': config.get('title', ''),
        'location_selector': config.get('location', ''),
        'posted_selector': config.get('posted', ''),
        'description_selector': config.get('description', ''),
        'link_selector': config.get('link', ''),
        'metadata_selector': config.get('metadata', ''),
        'pagination_selector': config.get('pagination_selector', ''),
        'max_pages': config.get('max_pages', GLOBAL_CONFIG['max_pages_fallback']),
        'scroll_pause': GLOBAL_CONFIG['scroll_pause'],
        'max_jobs': GLOBAL_CONFIG['max_jobs_per_company'],
        'headless': GLOBAL_CONFIG['headless']
    }

    # Apply defaults for missing keys, but preserve explicit cookie_handling if set
    for key, value in defaults.items():
        if key not in config:
            config[key] = value

    # Ensure cookie_handling is preserved as boolean if present
    if 'cookie_handling' in company_config:
        config['cookie_handling'] = bool(company_config['cookie_handling'])

    # Set use_metadata_parsing: True if metadata_selector is present, unless explicitly set to False
    if 'use_metadata_parsing' not in config:
        config['use_metadata_parsing'] = bool(config.get('metadata_selector'))

    # Handle pagination_type mapping
    if config.get('pagination_type') == 'one_page':
        config['pagination_type'] = 'none'
        config['max_pages'] = 1
    elif config.get('pagination_type') == 'button':
        config['pagination_type'] = 'button_click'
    elif config.get('pagination_type') == 'scroll':
        config['pagination_type'] = 'infinite_scroll'

    return config

def print_company_config(config):
    """Print configuration for a single company"""
    print(f"Company: {config.get('company_name', config.get('company', 'Unknown'))}")
    print(f"URL: {config['url']}")
    print(f"Max Jobs: {config['max_jobs']}")
    print(f"Pagination Type: {config['pagination_type']}")
    print(f"Max Pages: {config.get('max_pages', 'N/A')}")
    print(f"Metadata Parsing: {config.get('use_metadata_parsing', False)}")
    print(f"Special Case (crawl_ex): {config.get('special_case', False)}")
    
    if config.get('special_case', False):
        print(f"Click Target: {config.get('click_target', 'N/A')}")
        print(f"Detail Container: {config.get('detail_container', 'N/A')}")
    
    print("\nSelectors:")
    print(f"  Card: {config['card_selector']}")
    print(f"  Title: {config['title_selector']}")
    
    if config.get('use_metadata_parsing', False):
        print(f"  Metadata Selector: {config.get('metadata_selector', 'N/A')} (auto-parsing enabled)")
    else:
        print(f"  Location: {config['location_selector']}")
        print(f"  Posted: {config['posted_selector']}")
        if config.get('metadata_selector'):
            print(f"  Metadata Selector: {config.get('metadata_selector')}")
    print(f"  Link: {config['link_selector']}")
    if config['pagination_type'] == 'button_click':
        print(f"  Pagination: {config.get('pagination_selector', 'N/A')}")
    print("-" * 60)

def handle_pagination(page, config, current_page):
    """Handle different types of pagination"""
    pagination_type = config.get('pagination_type', 'none')
    
    if pagination_type == 'button_click':
        return handle_button_pagination(page, config, current_page)
    elif pagination_type == 'infinite_scroll':
        return handle_infinite_scroll(page, config, current_page)
    elif pagination_type == 'url_param':
        return handle_url_param_pagination(page, config, current_page)
    else:
        return False

def handle_url_param_pagination(page, config, page_number):
    """Handle URL parameter-based pagination (e.g., ?page=2, ?startrow=25)"""
    print(f"   🔄 Attempting URL parameter pagination...")
    try:
        param = config.get('pagination_param', 'page')
        step = config.get('pagination_step', 1)
        current_url = page.url

        # Calculate next value based on step
        if param == 'startrow':
            next_value = (page_number - 1) * step + step
        elif param == 'page':
            next_value = page_number + 1
        elif param == 'p':
            next_value = page_number + 1
        elif param == 'jobOffset':
            next_value = (page_number - 1) * step + step
        else:
            next_value = page_number + 1

        # Update or add parameter to URL
        if f"{param}=" in current_url:
            import re
            new_url = re.sub(f'{param}=\\d+', f'{param}={next_value}', current_url)
        else:
            separator = '&' if '?' in current_url else '?'
            new_url = f"{current_url}{separator}{param}={next_value}"

        print(f"   ✓ Navigating to: {param}={next_value}")
        page.goto(new_url, wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(3000)

        # After navigation, check if any job cards are found
        card_selector = config.get('card_selector')
        job_cards = page.query_selector_all(card_selector) if card_selector else []
        jobs_found = len(job_cards)
        safe_print(f"   🔍 Found {jobs_found} job cards on page {page_number+1}")
        if jobs_found == 0:
            print(f"   ✓ No more jobs found, URL param pagination complete")
            return False

        return True
    except Exception as e:
        safe_print(f"   ⚠ URL pagination failed: {str(e)[:50]}, stopping")
        return False
def handle_button_pagination(page, config, current_page):
    """Handle button click pagination"""
    try:
        pagination_selector = config.get('pagination_selector')
        if not pagination_selector:
            print("No pagination selector provided for button_click type")
            return False
            
        # Look for next button
        next_button = page.query_selector(pagination_selector)
        if not next_button:
            print("Next button not found")
            return False
            
        # Check if button is disabled
        if next_button.get_attribute('disabled') or 'disabled' in (next_button.get_attribute('class') or ''):
            print("Next button is disabled")
            return False
            
        print(f"Clicking next page button (Page {current_page + 1})")
        next_button.click()
        
        # Wait for new job cards to load instead of networkidle
        try:
            page.wait_for_selector(config['card_selector'], timeout=10000)
            page.wait_for_timeout(1000)  # Brief additional wait
            print("New page job cards loaded")
        except:
            print("Warning: New page job cards not detected, continuing anyway")
        
        return True
        
    except Exception as e:
        print(f"Error with button pagination: {e}")
        return False

def handle_infinite_scroll(page, config, current_page):
    """Handle infinite scroll pagination - scroll until no more jobs load"""
    try:
        scroll_pause = config.get('scroll_pause', 2)
        
        # Get initial job count
        initial_count = len(page.query_selector_all(config['card_selector']))
        print(f"Starting infinite scroll with {initial_count} jobs visible")
        
        consecutive_no_load = 0
        max_consecutive_attempts = 3
        total_scrolls = 0
        max_scrolls = 20  # Safety limit
        
        while consecutive_no_load < max_consecutive_attempts and total_scrolls < max_scrolls:
            # Get current count before scroll
            before_scroll_count = len(page.query_selector_all(config['card_selector']))
            
            # Scroll to bottom
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            total_scrolls += 1
            
            # Wait for new content to potentially load
            page.wait_for_timeout(scroll_pause * 1000)
            
            # Wait for job cards to load instead of networkidle
            try:
                page.wait_for_selector(config['card_selector'], timeout=3000)
            except:
                pass  # Continue if job cards don't load
            
            # Check if new jobs loaded
            after_scroll_count = len(page.query_selector_all(config['card_selector']))
            
            if after_scroll_count > before_scroll_count:
                new_jobs_loaded = after_scroll_count - before_scroll_count
                print(f"Scroll {total_scrolls}: Loaded {new_jobs_loaded} more jobs (total: {after_scroll_count})")
                consecutive_no_load = 0  # Reset counter
            else:
                consecutive_no_load += 1
                print(f"Scroll {total_scrolls}: No new jobs loaded (attempt {consecutive_no_load}/{max_consecutive_attempts})")
        
        final_count = len(page.query_selector_all(config['card_selector']))
        total_new_jobs = final_count - initial_count
        
        if total_new_jobs > 0:
            print(f"Infinite scroll complete: Loaded {total_new_jobs} total new jobs via {total_scrolls} scrolls")
            return True
        else:
            print(f"No new jobs loaded after {total_scrolls} scroll attempts")
            return False
            
    except Exception as e:
        print(f"Error with infinite scroll: {e}")
        return False

def parse_metadata(metadata_text):
    """Parse metadata text to extract location and posted date"""
    import re
    
    location = 'N/A'
    posted_date = 'N/A'
    
    if not metadata_text:
        return location, posted_date
    
    # Clean up the text
    text = metadata_text.strip()
    
    # Common location patterns
    location_patterns = [
        r'(?i)(?:location[s]?[:\s]*)(.*?)(?:\n|posted|date|\d+/\d+|\d+ days?|\d+ hours?|$)',
        r'(?i)(.*?)(?:\s*\n|\s*posted|\s*date|\s*\d+/\d+|\s*\d+ days?|\s*\d+ hours?)',
        r'(?i)^([^(\n]*?)(?:\s*\([^)]*\))?(?:\s*\n|$)',  # First line, optional parentheses
    ]
    
    # Common date patterns
    date_patterns = [
        r'(?i)(?:posted|date)[:\s]*(\d{1,2}/\d{1,2}/\d{2,4})',
        r'(?i)(\d{1,2}/\d{1,2}/\d{2,4})',
        r'(?i)(\d+ days? ago)',
        r'(?i)(\d+ hours? ago)',
        r'(?i)(yesterday|today)',
        r'(?i)(?:posting dates?)(\d{1,2}/\d{1,2}/\d{2,4})',
    ]
    
    # Special handling for patterns like 'Posted Jul 22, 2025Chennai, India'
    special_match = re.match(r'Posted\s+([A-Za-z]{3,9} \d{1,2}, \d{4})(.*)', text)
    if special_match:
        posted_date = special_match.group(1).strip()
        location = special_match.group(2).strip(' ,')
        return location, posted_date

    # Enhanced parsing for statements like:
    # 'Bengaluru Full time Experience: 10-12 years Required Skill: SAP ABAP Development for HANA'
    # Extract location, experience, and skills
    exp_match = re.search(r'Experience[:\s]*([\w\-\s]+?years?)', text, re.IGNORECASE)
    skill_match = re.search(r'Required Skill[:\s]*(.+)', text, re.IGNORECASE)
    # Assume location is the first word(s) before 'Full time' or 'Experience:'
    loc_match = re.match(r'([^,\n]+?)(?:\s+Full time|\s+Experience:|\s+Required Skill:|$)', text)

    location_val = loc_match.group(1).strip() if loc_match else location
    experience_val = exp_match.group(1).strip() if exp_match else 'N/A'
    skills_val = skill_match.group(1).strip() if skill_match else 'N/A'

    # If we found either experience or skills, return them in a tuple (location, posted_date, experience, skills)
    if experience_val != 'N/A' or skills_val != 'N/A':
        # posted_date is not present in this pattern
        return location_val, 'N/A', experience_val, skills_val

    # Try to extract location
    for pattern in location_patterns:
        match = re.search(pattern, text)
        if match:
            potential_location = match.group(1).strip()
            # Filter out obvious non-location text
            if potential_location and not re.match(r'^\d+[/\-]\d+', potential_location):
                # Clean up common suffixes
                potential_location = re.sub(r'\s*\(.*?\)\s*$', '', potential_location)  # Remove parentheses
                potential_location = re.sub(r'\s*(hybrid|remote|on-?site)\s*$', '', potential_location, flags=re.IGNORECASE)
                if len(potential_location.strip()) > 0:
                    location = potential_location.strip()
                    break

    # Try to extract posted date
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            posted_date = match.group(1).strip()
            break

    return location, posted_date

def extract_and_clean_job_details(job_data, config):
    """Extract and clean job details for better Gemini processing"""
    cleaned_data = {
        'title': job_data.get('title', 'N/A'),
        'company': job_data.get('company', config.get('company_name', 'N/A')),
        'location': job_data.get('location', 'N/A'),
        'posted_date': job_data.get('posted_date', 'N/A'),
        'apply_link': job_data.get('apply_link', 'N/A'),
        'description': job_data.get('description', 'N/A'),
        'job_details_info': job_data.get('job_details_info', 'N/A'),
        'source_url': config.get('url', 'N/A')
    }
    
    # Clean up description and job details
    if cleaned_data['description'] != 'N/A':
        # Remove extra whitespace and normalize
        cleaned_data['description'] = ' '.join(cleaned_data['description'].split())
    
    if cleaned_data['job_details_info'] != 'N/A':
        # Clean up job details info
        cleaned_data['job_details_info'] = ' '.join(cleaned_data['job_details_info'].split())
    
    # Extract additional fields if available
    additional_fields = ['job_id', 'department', 'employment_type', 'experience_level', 
                        'remote_work', 'salary', 'deadline', 'requirements', 'benefits', 'skills']
    
    for field in additional_fields:
        if field in job_data and job_data[field] not in ['N/A', None, '']:
            cleaned_data[field] = job_data[field]
    
    return cleaned_data

def handle_dynamic_cookies(page, cookie_handler=None):
    """Handle cookies that may appear dynamically during scraping"""
    if not GLOBAL_CONFIG.get('use_extension', False) and cookie_handler:
        try:
            # Quick check for new cookie banners
            banners = cookie_handler.detect_cookie_banners(page)
            if banners:
                print(f"   🍪 Found {len(banners)} dynamic cookie banners, handling...")
                results = cookie_handler.handle_cookies_comprehensive(page, GLOBAL_CONFIG['cookie_strategy'])
                return True
        except Exception as e:
            safe_print(f"   ⚠️ Dynamic cookie handling failed: {e}")
    return False

def extract_job_data(page, config, existing_jobs=None, cookie_handler=None):
    """Extract job data using the provided selectors"""
    if existing_jobs is None:
        existing_jobs = []
    
    jobs = existing_jobs.copy()
    
    # Initialize statistics tracking
    stats = {
        'total_job_cards_found': 0,
        'skipped_duplicates': 0,
        'skipped_extraction_errors': 0,
        'successful_extractions': 0,
        'gemini_processing_errors': 0,
        'crawl4ai_errors': 0,
        'browser_closed_early': False
    }
    
    # Wait for job cards to be present instead of networkidle
    try:
        page.wait_for_selector(config['card_selector'], timeout=10000)
    except:
        print("Warning: Job cards not found, but continuing extraction")

    # Find all job cards with error handling
    try:
        job_cards = page.query_selector_all(config['card_selector'])
        stats['total_job_cards_found'] = len(job_cards)
        print(f"Found {len(job_cards)} job cards on current page")
    except Exception as e:
        print(f"Error finding job cards: {e}")
        return jobs, stats

    # Extract data from all job cards 
    browser_closed = False
    for i, card in enumerate(job_cards):
        # Stop if browser was closed
        if browser_closed:
            break
            
        # Handle dynamic cookies every 10 jobs
        if i > 0 and i % 10 == 0:
            handle_dynamic_cookies(page, cookie_handler)
            
        # Stop if we've reached max_jobs total (but let infinite scroll get all available jobs first)
        if len(jobs) >= config['max_jobs'] and config.get('pagination_type') != 'infinite_scroll':
            print(f"Reached maximum job limit of {config['max_jobs']}")
            break

        job_data = {}

        try:
            # Check if page is still valid before processing
            try:
                # Try to access a property to check if page is still alive
                _ = page.url
            except Exception:
                print("Page was closed, stopping extraction")
                browser_closed = True
                stats['browser_closed_early'] = True
                break
                
            # Extract title with error handling
            if config['title_selector']:
                try:
                    title_element = card.query_selector(config['title_selector'])
                    job_data['title'] = title_element.text_content().strip() if title_element else 'N/A'
                except Exception as e:
                    # Check if it's a browser closure error
                    error_msg = str(e).lower()
                    if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                        print("Browser was closed, stopping extraction")
                        browser_closed = True
                        break
                    print(f"Error extracting title for job {i + 1}: {e}")
                    job_data['title'] = 'N/A'
            else:
                job_data['title'] = 'N/A'

            # Add company name
            job_data['company'] = config.get('company_name', 'N/A')
            
            # Check if browser was closed in previous operations
            if browser_closed:
                break
            

            # Check if metadata parsing is enabled
            if config.get('use_metadata_parsing', False) and config.get('metadata_selector'):
                # Extract metadata and parse it
                try:
                    metadata_element = card.query_selector(config['metadata_selector'])
                    if metadata_element:
                        metadata_text = metadata_element.text_content().strip()
                        parsed = parse_metadata(metadata_text)
                        # Handle both 2-value and 4-value returns
                        if isinstance(parsed, tuple) and len(parsed) == 4:
                            parsed_location, parsed_posted_date, parsed_experience, parsed_skills = parsed
                            job_data['location'] = parsed_location
                            job_data['posted_date'] = parsed_posted_date
                            job_data['experience'] = parsed_experience
                            job_data['skills'] = parsed_skills
                        elif isinstance(parsed, tuple) and len(parsed) == 2:
                            parsed_location, parsed_posted_date = parsed
                            job_data['location'] = parsed_location
                            job_data['posted_date'] = parsed_posted_date
                        else:
                            job_data['location'] = 'N/A'
                            job_data['posted_date'] = 'N/A'
                        job_data['metadata_raw'] = metadata_text  # Store raw metadata for debugging
                    else:
                        job_data['location'] = 'N/A'
                        job_data['posted_date'] = 'N/A'
                        job_data['metadata_raw'] = 'N/A'
                except Exception as e:
                    # Check if it's a browser closure error
                    error_msg = str(e).lower()
                    if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                        print("Browser was closed, stopping extraction")
                        browser_closed = True
                        break
                    print(f"Error parsing metadata for job {i + 1}: {e}")
                    job_data['location'] = 'N/A'
                    job_data['posted_date'] = 'N/A'
                    job_data['metadata_raw'] = 'N/A'
            
            # Check if browser was closed in metadata parsing
            if browser_closed:
                break
            else:
                # Use individual selectors as before
                # Extract location
                if config['location_selector']:
                    try:
                        location_element = card.query_selector(config['location_selector'])
                        job_data['location'] = location_element.text_content().strip() if location_element else 'N/A'
                    except Exception as e:
                        # Check if it's a browser closure error
                        error_msg = str(e).lower()
                        if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                            print("Browser was closed, stopping extraction")
                            browser_closed = True
                            break
                        print(f"Error extracting location for job {i + 1}: {e}")
                        job_data['location'] = 'N/A'
                else:
                    job_data['location'] = 'N/A'

                # Extract posted date from posted_selector
                if config['posted_selector']:
                    try:
                        posted_element = card.query_selector(config['posted_selector'])
                        job_data['posted_date'] = posted_element.text_content().strip() if posted_element else 'N/A'
                    except Exception as e:
                        # Check if it's a browser closure error
                        error_msg = str(e).lower()
                        if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                            print("Browser was closed, stopping extraction")
                            browser_closed = True
                            break
                        print(f"Error extracting posted date for job {i + 1}: {e}")
                        job_data['posted_date'] = 'N/A'
                else:
                    job_data['posted_date'] = 'N/A'

                # Extract description from description_selector if available
                if config.get('description_selector'):
                    try:
                        description_element = card.query_selector(config['description_selector'])
                        job_data['description'] = description_element.text_content().strip() if description_element else 'N/A'
                    except Exception as e:
                        # Check if it's a browser closure error
                        error_msg = str(e).lower()
                        if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                            print("Browser was closed, stopping extraction")
                            browser_closed = True
                            break
                        print(f"Error extracting description for job {i + 1}: {e}")
                        job_data['description'] = 'N/A'
                else:
                    job_data['description'] = 'N/A'
            
            # Check if browser was closed in individual selectors
            if browser_closed:
                break

            # Extract link with error handling
            if config['link_selector']:
                try:
                    link_element = card.query_selector(config['link_selector'])
                    if link_element:
                        href = link_element.get_attribute('href')
                    else:
                        href = None
                except Exception as e:
                    # Check if it's a browser closure error
                    error_msg = str(e).lower()
                    if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                        print("Browser was closed, stopping extraction")
                        browser_closed = True
                        break
                    print(f"Error extracting link for job {i + 1}: {e}")
                    href = None
            else:
                # If no link_selector specified, try to get href from the card itself
                try:
                    href = card.get_attribute('href')
                except Exception as e:
                    # Check if it's a browser closure error
                    error_msg = str(e).lower()
                    if 'target page, context or browser has been closed' in error_msg or 'browser has been closed' in error_msg:
                        print("Browser was closed, stopping extraction")
                        browser_closed = True
                        break
                    print(f"Error extracting href from card for job {i + 1}: {e}")
                    href = None
            
            # Check if browser was closed in link extraction
            if browser_closed:
                break

            if href:
                company_name = config.get('company_name', '').lower()
                # Special handling for Google careers
                if company_name == 'google':
                    # Handle both '/jobs' and 'jobs/' at the start
                    if href.startswith('/jobs'):
                        job_data['apply_link'] = "https://www.google.com/about/careers/applications" + href
                    elif href.startswith('jobs/'):
                        job_data['apply_link'] = "https://www.google.com/about/careers/applications/" + href
                    elif href.startswith('/'):
                        from urllib.parse import urljoin, urlparse
                        parsed_url = urlparse(config['url'])
                        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
                        job_data['apply_link'] = urljoin(base_url, href)
                    else:
                        job_data['apply_link'] = href
                else:
                    if href.startswith('/'):
                        from urllib.parse import urljoin, urlparse
                        parsed_url = urlparse(config['url'])
                        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
                        job_data['apply_link'] = urljoin(base_url, href)
                    else:
                        job_data['apply_link'] = href
            else:
                job_data['apply_link'] = 'N/A'
                
            # Check if apply_link already exists in database - skip if duplicate
            if check_apply_link_exists(job_data.get('apply_link')):
                stats['skipped_duplicates'] += 1
                safe_print(f"⏭️ Skipping duplicate job {i + 1}: {job_data.get('title', 'Unknown')} - apply_link already exists")
                continue
                
            # Visit job details page and scrape its HTML with better error handling
            job_details_info = 'N/A'
            apply_link = job_data.get('apply_link', None)
            if apply_link and apply_link != 'N/A':
                try:
                    import asyncio
                    from crawl4ai import AsyncWebCrawler
                    from crawl4ai.content_filter_strategy import BM25ContentFilter
                    from crawl4ai.async_configs import CrawlerRunConfig
                    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
                    async def crawl_job_details(url):
                        bm25_filter = BM25ContentFilter(
                            user_query="Job Description, Responsibilities, Skills, Requirements",
                            bm25_threshold=1.2,
                            language="english")

                        markdowngen = DefaultMarkdownGenerator(content_filter=bm25_filter, options={"ignore_links": True, "images": True, "code_blocks": True})
                        run_config = CrawlerRunConfig(markdown_generator=markdowngen, magic=True,page_timeout=50000, simulate_user=True, override_navigator=True)
                        async with AsyncWebCrawler() as crawler:
                            result = await crawler.arun(url=url, config=run_config)
                            return result.markdown
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            import nest_asyncio
                            nest_asyncio.apply()
                            job_details_info = loop.run_until_complete(crawl_job_details(apply_link))
                        else:
                            job_details_info = loop.run_until_complete(crawl_job_details(apply_link))
                    except Exception as e:
                        print(f"Error running crawl4ai event loop for job {i+1}: {e}")
                        stats['crawl4ai_errors'] += 1
                        job_details_info = 'N/A'
                except Exception as e:
                    print(f"Error scraping job details with crawl4ai for job {i+1}: {e}")
                    stats['crawl4ai_errors'] += 1
                    job_details_info = 'N/A'
            job_data['job_details_info'] = job_details_info

            

            # Add standard fields with N/A defaults (but don't overwrite existing values)
            standard_fields = {
                'salary': 'N/A',
                'employment_type': 'N/A', 
                'experience_level': 'N/A',
                'department': 'N/A',
                'requirements': 'N/A',
                'benefits': 'N/A',
                'deadline': 'N/A',
                'job_id': 'N/A',
                'tags': 'N/A',
                'skills': 'N/A',
                'remote_work': 'N/A',
                'scraped_at': datetime.now().isoformat(),
                'source_url': config['url']
            }

            # Only add fields that don't already exist
            for key, value in standard_fields.items():
                if key not in job_data:
                    job_data[key] = value

            # Ensure description and posted_date exist if not set by metadata parsing
            if 'description' not in job_data:
                job_data['description'] = 'N/A'
            if 'posted_date' not in job_data:
                job_data['posted_date'] = 'N/A'
            
            # --- Gemini AI enrichment ---
            cleaned_job = None
            try:
                import google.generativeai as genai
                import json as _json
                import os
                GEMINI_API_KEY = os.getenv("GEMINI_KEY")  # TODO: Set your actual key
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                # Clean and prepare job data for Gemini processing
                cleaned_job_data = extract_and_clean_job_details(job_data, config)
                
                # Create a comprehensive prompt for better job detail extraction
                gemini_prompt = f"""
You are a professional job data analyst. Analyze the following scraped job data and create a clean, structured JSON response.

RAW JOB DATA:
{json.dumps(cleaned_job_data, indent=2, ensure_ascii=False)}

TASK: Extract and structure the following information into a clean JSON format:

REQUIRED FIELDS:
- title: Job title (string)
- company: Company name (string)
- location: Job location (string)
- posted_date: When the job was posted (string, format: MM/DD/YYYY or "N/A")
- apply_link: Application URL (string)
- experience: Experience level required (string, e.g., "3-5 years", "N/A")
- job_id: Job identifier if available either check from the job details info or check in the URL  (string or number or null)
- department: Department/team (string or null)
- employment_type: Full-time, Part-time, Contract, etc. (string or null)
- experience_level: Entry, Mid, Senior, etc. (string or null)
- remote_work: Remote, Hybrid, On-site (string or null)
- salary: Salary information if available (string or null)
- deadline: Application deadline if available (string or null)

DETAILED FIELDS:
- description: Clean and Short job description (string)
- requirements: Array of required qualifications/skills
- preferred_qualifications: Array of preferred qualifications/skills
- responsibilities: Array of job responsibilities
- benefits: Array of benefits/perks
- skills: Array of technical skills mentioned
- tags: Array of relevant tags/categories

RULES:
1. Clean and normalize all text data
2. Convert lists to proper arrays
3. Use null for missing data (not "N/A")
4. Extract skills from requirements and description
5. Identify experience level from title and requirements
6. Determine employment type from description
7. Extract salary if mentioned
8. Parse dates into consistent format
9. Remove HTML tags and extra whitespace
10. Ensure all arrays are properly formatted

OUTPUT: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text.
"""
                
                response = model.generate_content(gemini_prompt)
                cleaned_text = response.text if hasattr(response, 'text') else str(response)
                
                # Save raw Gemini response for debugging
                with open("gemini_response.json", "w", encoding="utf-8") as f:
                    f.write(cleaned_text)
                
                # Clean the response text
                cleaned_text = cleaned_text.strip()
                
                # Remove markdown code blocks if present
                if cleaned_text.startswith('```json'):
                    cleaned_text = cleaned_text[7:]
                elif cleaned_text.startswith('```'):
                    cleaned_text = cleaned_text[3:]
                
                if cleaned_text.endswith('```'):
                    cleaned_text = cleaned_text[:-3]
                
                # Try to parse the JSON
                try:
                    cleaned_job = _json.loads(cleaned_text)
                    
                    # Validate and ensure required fields exist
                    required_fields = ['title', 'company', 'location', 'posted_date', 'apply_link']
                    for field in required_fields:
                        if field not in cleaned_job:
                            cleaned_job[field] = job_data.get(field, 'N/A')
                    
                    # Add metadata
                    cleaned_job['scraped_at'] = datetime.now().isoformat()
                    cleaned_job['source_url'] = config['url']
                    cleaned_job['job_details_info'] = job_data.get('job_details_info', 'N/A')
                    
                    # Ensure arrays are properly formatted
                    array_fields = ['requirements', 'preferred_qualifications', 'responsibilities', 'benefits', 'skills', 'tags']
                    for field in array_fields:
                        if field in cleaned_job:
                            if isinstance(cleaned_job[field], str):
                                # Convert string to array if it's a comma-separated list
                                if ',' in cleaned_job[field]:
                                    cleaned_job[field] = [item.strip() for item in cleaned_job[field].split(',') if item.strip()]
                                else:
                                    cleaned_job[field] = [cleaned_job[field]] if cleaned_job[field] != 'N/A' else []
                            elif not isinstance(cleaned_job[field], list):
                                cleaned_job[field] = []
                        else:
                            cleaned_job[field] = []
                    
                    safe_print(f"✅ Successfully processed job: {cleaned_job.get('title', 'Unknown')}")
                    
                except Exception as e:
                    safe_print(f"❌ JSON parsing error: {e}")
                    stats['gemini_processing_errors'] += 1
                    # Fallback: create a basic structured job from raw data
                    cleaned_job = {
                        'title': job_data.get('title', 'N/A'),
                        'company': job_data.get('company', 'N/A'),
                        'location': job_data.get('location', 'N/A'),
                        'posted_date': job_data.get('posted_date', 'N/A'),
                        'apply_link': job_data.get('apply_link', 'N/A'),
                        'description': job_data.get('description', 'N/A'),
                        'requirements': [],
                        'preferred_qualifications': [],
                        'responsibilities': [],
                        'benefits': [],
                        'skills': [],
                        'tags': [],
                        'job_id': job_data.get('job_id', None),
                        'department': job_data.get('department', None),
                        'employment_type': job_data.get('employment_type', None),
                        'experience_level': job_data.get('experience_level', None),
                        'remote_work': job_data.get('remote_work', None),
                        'salary': job_data.get('salary', None),
                        'deadline': job_data.get('deadline', None),
                        'scraped_at': datetime.now().isoformat(),
                        'source_url': config['url'],
                        'job_details_info': job_data.get('job_details_info', 'N/A'),
                        'gemini_error': f"JSON parsing failed: {e}",
                        'raw_gemini_response': cleaned_text
                    }
                    
            except Exception as e:
                safe_print(f"❌ Gemini API error: {e}")
                stats['gemini_processing_errors'] += 1
                # Fallback: create structured job from raw data
                cleaned_job = {
                    'title': job_data.get('title', 'N/A'),
                    'company': job_data.get('company', 'N/A'),
                    'location': job_data.get('location', 'N/A'),
                    'posted_date': job_data.get('posted_date', 'N/A'),
                    'apply_link': job_data.get('apply_link', 'N/A'),
                    'description': job_data.get('description', 'N/A'),
                    'requirements': [],
                    'preferred_qualifications': [],
                    'responsibilities': [],
                    'benefits': [],
                    'skills': [],
                    'tags': [],
                    'job_id': job_data.get('job_id', None),
                    'department': job_data.get('department', None),
                    'employment_type': job_data.get('employment_type', None),
                    'experience_level': job_data.get('experience_level', None),
                    'remote_work': job_data.get('remote_work', None),
                    'salary': job_data.get('salary', None),
                    'deadline': job_data.get('deadline', None),
                    'scraped_at': datetime.now().isoformat(),
                    'source_url': config['url'],
                    'job_details_info': job_data.get('job_details_info', 'N/A'),
                    'gemini_error': f"Gemini API failed: {e}"
                }

            # Add the cleaned job to the results
            jobs.append(cleaned_job)
            stats['successful_extractions'] += 1
                
            

        except Exception as e:
            print(f"Error processing job card {i + 1}: {e}")
            stats['skipped_extraction_errors'] += 1
            continue
        print(f"\n=== EXTRACTION STATISTICS ===")
    safe_print(f"📊 Job Cards Found: {stats['total_job_cards_found']}")
    safe_print(f"✅ Successfully Extracted: {stats['successful_extractions']}")
    safe_print(f"⏭️ Skipped (Duplicates): {stats['skipped_duplicates']}")
    safe_print(f"❌ Skipped (Extraction Errors): {stats['skipped_extraction_errors']}")
    print(f"🔄 Crawl4AI Errors: {stats['crawl4ai_errors']}")
    print(f"🤖 Gemini Processing Errors: {stats['gemini_processing_errors']}")
    if stats['browser_closed_early']:
        safe_print(f"⚠️ Browser was closed early during extraction")
    safe_print(f"📈 Success Rate: {(stats['successful_extractions'] / max(stats['total_job_cards_found'], 1) * 100):.1f}%")
    print("-" * 60)
    
    for job in jobs:
        
        print(f"Job #{job.get('index', 'N/A')}")
        print(f"Title: {job.get('title', 'N/A')}")
        print(f"Location: {job.get('location', 'N/A')}")
        print(f"Posted Date: {job.get('posted_date', 'N/A')}")
        print(f"Link: {job.get('apply_link', 'N/A')}")
        print("-" * 80)

    return jobs, stats
    
    

def save_results(jobs, config, start_time, end_time, pages_scraped, errors, timing_data, filename="job_scraper_results.json"):
    """Save results in the specified format"""
    try:
        company_name = config.get('company_name', 'Unknown')
       
        # Create the structured output
        output = {
            "companies": {
                company_name: {
                    "company": company_name,
                    "url": config['url'],
                    "status": "success" if not errors else "partial_success",
                    "start_time": start_time.isoformat(),
                    "jobs": jobs,
                    "pagination_info": {
                        "pages_scraped": pages_scraped,
                        "total_jobs_found": len(jobs),
                        "pagination_type": config.get('pagination_type', 'none')
                    },
                    "timing": timing_data,
                    "errors": errors,
                    "end_time": end_time.isoformat()
                }
            }
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to: {filename}")
        
    except Exception as e:
        print(f"Error saving results: {e}")

def scrape_single_company(page, config, overall_start_time, cookie_handler=None, browser_config=None):
    """Scrape jobs for a single company"""
    company_name = config.get('company_name', config.get('company', 'Unknown'))
    
    # Check if this is a special case that should use crawl_ex method
    if config.get('special_case', False):
        safe_print(f"🎯 Special case detected for {company_name} - using crawl_ex method")
        return scrape_special_case_company(config, overall_start_time, browser_config, cookie_handler)
    
    # Initialize tracking variables for this company
    start_time = datetime.now()
    errors = []
    timing_data = {
        "navigation": 0,
        "cookie_handling": 0,
        "page_load": 0,
        "captcha_handling": 0,
        "total": 0
    }
    
    print(f"\n{'='*80}")
    print(f"SCRAPING: {company_name}")
    print(f"{'='*80}")
    print_company_config(config)
    
    try:
        # Track navigation time
        nav_start = time.time()
        print(f"\nNavigating to: {config['url']}")
        
        # Add better navigation handling
        try:
            page.goto(config['url'], wait_until='domcontentloaded', timeout=30000)
            safe_print("✅ Page loaded successfully")
            
            # Handle cookies if not using extension
            if not GLOBAL_CONFIG.get('use_extension', False):
                try:
                    print(f"🍪 Applying cookie handling strategy: {GLOBAL_CONFIG['cookie_strategy']}")
                    cookie_results = apply_cookie_handling(page, GLOBAL_CONFIG['cookie_strategy'])
                    
                    banners_found = len(cookie_results.get('detected_banners', []))
                    hidden_count = cookie_results.get('hide_stats', {}).get('hidden_count', 0)
                    clicked_count = cookie_results.get('click_stats', {}).get('clicked_count', 0)
                    
                    if banners_found > 0:
                        safe_print(f"   🎯 Detected {banners_found} cookie banners")
                        if hidden_count > 0:
                            print(f"   🙈 Hidden {hidden_count} cookie elements")
                        if clicked_count > 0:
                            print(f"   👆 Clicked {clicked_count} cookie buttons")
                    else:
                        print(f"   ✨ No cookie banners detected")
                        
                except Exception as e:
                    safe_print(f"   ⚠️ Cookie handling failed: {e}")
                    errors.append(f"Cookie handling error: {e}")
            
        except Exception as e:
            print(f"Navigation failed: {e}")
            errors.append(f"Navigation error: {e}")
            return {
                "company_name": company_name,
                "config": config,
                "jobs": [],
                "start_time": start_time,
                "end_time": datetime.now(),
                "pages_scraped": 0,
                "errors": errors,
                "timing_data": timing_data,
                "status": "failed"
            }

        # Wait for job cards to load instead of networkidle
        try:
            page.wait_for_selector(config['card_selector'], timeout=15000)
            print("Job cards loaded successfully")
            page.wait_for_timeout(2000)  # Brief additional wait
        except Exception as e:
            print(f"Warning: Job cards selector not found: {e}")
            errors.append(f"Job cards not found: {e}")
        
        nav_end = time.time()
        timing_data["navigation"] = round(nav_end - nav_start, 2)
        timing_data["page_load"] = timing_data["navigation"]  # Same for this case
        
        all_jobs = []
        current_page = 0
        max_pages = config.get('max_pages', 1)
        
        # Initialize statistics aggregation
        overall_stats = {
            'total_job_cards_found': 0,
            'skipped_duplicates': 0,
            'skipped_extraction_errors': 0,
            'successful_extractions': 0,
            'gemini_processing_errors': 0,
            'crawl4ai_errors': 0,
            'browser_closed_early': False
        }
        
        # Track total scraping time
        scraping_start = time.time()
        
        # Handle infinite scroll differently from button pagination
        if config.get('pagination_type') == 'infinite_scroll':
            print(f"\n--- Scraping with Infinite Scroll ---")
            
            try:
                # For infinite scroll, do all scrolling first, then extract all data
                print("Starting infinite scroll to load all jobs...")
                handle_infinite_scroll(page, config, 0)
                
                # Now extract all jobs from the fully loaded page
                all_jobs, page_stats = extract_job_data(page, config, all_jobs, cookie_handler)
                overall_stats = aggregate_stats(overall_stats, page_stats)
                current_page = 1  # Count as 1 "page" for reporting
                
                print(f"Infinite scroll complete. Total jobs collected: {len(all_jobs)}")
                
            except Exception as e:
                error_msg = f"Error during infinite scroll: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
                
                # Try to extract whatever jobs are currently visible
                try:
                    all_jobs, page_stats = extract_job_data(page, config, all_jobs, cookie_handler)
                    overall_stats = aggregate_stats(overall_stats, page_stats)
                except Exception as extract_error:
                    print(f"Failed to extract jobs after infinite scroll error: {extract_error}")
                    errors.append(f"Job extraction failed: {extract_error}")
                
        else:
            # Handle button pagination or no pagination
            while current_page < max_pages and len(all_jobs) < config['max_jobs']:
                print(f"\n--- Scraping Page {current_page + 1} ---")
                
                try:
                    # Check if page is still valid
                    try:
                        # Try to access a property to check if page is still alive
                        _ = page.url
                    except Exception:
                        print("Page was closed, stopping scraping")
                        break
                        
                    # Extract job data from current page
                    all_jobs, page_stats = extract_job_data(page, config, all_jobs, cookie_handler)
                    overall_stats = aggregate_stats(overall_stats, page_stats)
                    
                    print(f"Total jobs collected so far: {len(all_jobs)}")
                    
                    # Check if we've reached max jobs
                    if len(all_jobs) >= config['max_jobs']:
                        print(f"Reached maximum job limit of {config['max_jobs']}")
                        break
                    
                    # Try to go to next page
                    current_page += 1
                    if current_page < max_pages and config.get('pagination_type') != 'none':
                        print(f"Attempting to go to page {current_page + 1}...")
                        
                        # Handle pagination
                        pagination_success = handle_pagination(page, config, current_page)
                        
                        if not pagination_success:
                            print("No more pages available or pagination failed")
                            break
                    else:
                        if config.get('pagination_type') == 'none':
                            print("Single page scraping - stopping here")
                        else:
                            print(f"Reached maximum page limit of {max_pages}")
                        break
                        
                except Exception as e:
                    error_msg = f"Error on page {current_page + 1}: {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)
                    break
        
        scraping_end = time.time()
        timing_data["total"] = round(scraping_end - nav_start, 2)
        
        # End time
        end_time = datetime.now()
        
        # Display results for this company
        print(f"\n=== {company_name} SCRAPING COMPLETED ===")
        print(f"Total pages scraped: {current_page}")
        print(f"Total jobs found: {len(all_jobs)}")
        print(f"Total time: {timing_data['total']} seconds")
        
        # Display detailed statistics
        safe_print(f"\n📊 DETAILED STATISTICS FOR {company_name}")
        print(f"{'='*60}")
        safe_print(f"🔍 Job Cards Found: {overall_stats['total_job_cards_found']}")
        safe_print(f"✅ Successfully Extracted: {overall_stats['successful_extractions']}")
        safe_print(f"⏭️ Skipped (Duplicates): {overall_stats['skipped_duplicates']}")
        safe_print(f"❌ Skipped (Extraction Errors): {overall_stats['skipped_extraction_errors']}")
        print(f"🔄 Crawl4AI Errors: {overall_stats['crawl4ai_errors']}")
        print(f"🤖 Gemini Processing Errors: {overall_stats['gemini_processing_errors']}")
        if overall_stats['browser_closed_early']:
            safe_print(f"⚠️ Browser was closed early during extraction")
        
        success_rate = (overall_stats['successful_extractions'] / max(overall_stats['total_job_cards_found'], 1) * 100)
        duplicate_rate = (overall_stats['skipped_duplicates'] / max(overall_stats['total_job_cards_found'], 1) * 100)
        
        safe_print(f"📈 Success Rate: {success_rate:.1f}%")
        print(f"🔄 Duplicate Rate: {duplicate_rate:.1f}%")
        print(f"⚡ Processing Rate: {overall_stats['total_job_cards_found'] / max(timing_data['total'], 1):.1f} jobs/second")
        print(f"{'='*60}")
        
        return {
            "company_name": company_name,
            "config": config,
            "jobs": all_jobs,
            "start_time": start_time,
            "end_time": end_time,
            "pages_scraped": current_page,
            "errors": errors,
            "timing_data": timing_data,
            "statistics": overall_stats,
            "status": "success" if not errors else "partial_success"
        }
        
    except Exception as e:
        error_msg = f"Critical error during scraping {company_name}: {str(e)}"
        print(error_msg)
        errors.append(error_msg)
        
        end_time = datetime.now()
        timing_data["total"] = round(time.time() - time.mktime(start_time.timetuple()), 2)
        
        return {
            "company_name": company_name,
            "config": config,
            "jobs": all_jobs if 'all_jobs' in locals() else [],
            "start_time": start_time,
            "end_time": end_time,
            "pages_scraped": current_page if 'current_page' in locals() else 0,
            "errors": errors,
            "timing_data": timing_data,
            "statistics": overall_stats if 'overall_stats' in locals() else {
                'total_job_cards_found': 0,
                'skipped_duplicates': 0, 
                'skipped_extraction_errors': 0,
                'successful_extractions': 0,
                'gemini_processing_errors': 0,
                'crawl4ai_errors': 0,
                'browser_closed_early': False
            },
            "status": "failed"
        }

def save_multi_company_results(all_results, overall_start_time, overall_end_time, filename="multi_company_job_results.json"):
    """Save results for all companies in the structured format"""
    try:
        # Calculate overall statistics
        overall_session_stats = {
            'total_job_cards_found': 0,
            'total_skipped_duplicates': 0,
            'total_skipped_extraction_errors': 0,
            'total_successful_extractions': 0,
            'total_gemini_processing_errors': 0,
            'total_crawl4ai_errors': 0,
            'companies_with_browser_errors': 0
        }
        
        for result in all_results:
            if 'statistics' in result:
                stats = result['statistics']
                overall_session_stats['total_job_cards_found'] += stats['total_job_cards_found']
                overall_session_stats['total_skipped_duplicates'] += stats['skipped_duplicates']
                overall_session_stats['total_skipped_extraction_errors'] += stats['skipped_extraction_errors']
                overall_session_stats['total_successful_extractions'] += stats['successful_extractions']
                overall_session_stats['total_gemini_processing_errors'] += stats['gemini_processing_errors']
                overall_session_stats['total_crawl4ai_errors'] += stats['crawl4ai_errors']
                if stats['browser_closed_early']:
                    overall_session_stats['companies_with_browser_errors'] += 1
        
        # Create the structured output
        output = {
            "scraping_session": {
                "start_time": overall_start_time.isoformat(),
                "session_id": f"session_{overall_start_time.strftime('%Y%m%d_%H%M%S')}",
                "status": "completed",
                "total_companies": len(all_results),
                "completed_companies": len([r for r in all_results if r["status"] in ["success", "partial_success"]]),
                "successful_companies": len([r for r in all_results if r["status"] == "success"]),
                "total_jobs_scraped": sum(len(r["jobs"]) for r in all_results),
                "end_time": overall_end_time.isoformat(),
                "total_duration_seconds": (overall_end_time - overall_start_time).total_seconds(),
                "session_statistics": overall_session_stats
            },
            "companies": {}
        }
        
        # Add each company's results
        for result in all_results:
            company_name = result["company_name"]
            
            # Filter out jobs with Gemini errors and create clean job list
            clean_jobs = []
            gemini_errors = []
            
            for job in result["jobs"]:
                if "gemini_error" in job:
                    gemini_errors.append({
                        "job_title": job.get("title", "Unknown"),
                        "error": job["gemini_error"],
                        "raw_response": job.get("raw_gemini_response", "")
                    })
                else:
                    # Only include successfully processed jobs
                    clean_jobs.append(job)
            
            output["companies"][company_name] = {
                "company": company_name,
                "url": result["config"]["url"],
                "status": result["status"],
                "start_time": result["start_time"].isoformat(),
                "jobs": clean_jobs,  # Only Gemini-cleaned jobs
                "pagination_info": {
                    "pages_scraped": result["pages_scraped"],
                    "total_jobs_found": len(result["jobs"]),
                    "successful_jobs": len(clean_jobs),
                    "failed_jobs": len(gemini_errors),
                    "pagination_type": result["config"].get("pagination_type", "none")
                },
                "timing": result["timing_data"],
                "errors": result["errors"],
                "gemini_processing_errors": gemini_errors,
                "statistics": result.get("statistics", {}),  # Include detailed statistics
                "end_time": result["end_time"].isoformat()
            }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        safe_print(f"\n✅ All results saved to: {filename}")
        
        # Calculate Gemini processing statistics
        total_jobs = sum(len(r["jobs"]) for r in all_results)
        total_clean_jobs = sum(len([j for j in r["jobs"] if "gemini_error" not in j]) for r in all_results)
        total_gemini_errors = total_jobs - total_clean_jobs
        
        # Print comprehensive session summary
        safe_print(f"\n🎯 COMPREHENSIVE SESSION SUMMARY")
        print(f"{'='*80}")
        safe_print(f"📊 Overall Statistics:")
        print(f"  Total Job Cards Found: {overall_session_stats['total_job_cards_found']}")
        print(f"  Successfully Extracted: {overall_session_stats['total_successful_extractions']}")
        print(f"  Skipped (Duplicates): {overall_session_stats['total_skipped_duplicates']}")
        print(f"  Skipped (Extraction Errors): {overall_session_stats['total_skipped_extraction_errors']}")
        print(f"  Crawl4AI Errors: {overall_session_stats['total_crawl4ai_errors']}")
        print(f"  Gemini Processing Errors: {overall_session_stats['total_gemini_processing_errors']}")
        print(f"  Companies with Browser Issues: {overall_session_stats['companies_with_browser_errors']}")
        
        # Calculate rates
        total_cards = overall_session_stats['total_job_cards_found']
        if total_cards > 0:
            success_rate = (overall_session_stats['total_successful_extractions'] / total_cards * 100)
            duplicate_rate = (overall_session_stats['total_skipped_duplicates'] / total_cards * 100)
            error_rate = (overall_session_stats['total_skipped_extraction_errors'] / total_cards * 100)
            
            safe_print(f"\n📈 Processing Rates:")
            print(f"  Success Rate: {success_rate:.1f}%")
            print(f"  Duplicate Rate: {duplicate_rate:.1f}%")
            print(f"  Error Rate: {error_rate:.1f}%")
            print(f"  Processing Speed: {total_cards / max((overall_end_time - overall_start_time).total_seconds(), 1):.1f} jobs/second")
        
        print(f"\n� Gemini Processing Summary:")
        print(f"  Total jobs processed: {total_jobs}")
        print(f"  Successfully cleaned: {total_clean_jobs}")
        print(f"  Gemini processing errors: {total_gemini_errors}")
        print(f"  Gemini success rate: {(total_clean_jobs/total_jobs*100):.1f}%" if total_jobs > 0 else "  Gemini success rate: 0%")
        print(f"{'='*80}")
        
        return True
        
    except Exception as e:
        safe_print(f"❌ Error saving results: {e}")
        return False

def main():
    """Main function to run the multi-company job scraper"""
    
    safe_print("🚀 Multi-Company Job Scraper")
    safe_print("=" * 80)
    
    # Load companies configuration
    companies_config = load_companies_config(COMPANIES_CONFIG_FILE)
    if not companies_config:
        print("\nPlease create a JSON file with the following structure:")
        print("""
[
  {
    "company": "Atlassian",
    "url": "https://www.atlassian.com/company/careers/all-jobs",
    "job_card": "tbody tr",
    "title": "td:first-child a",
    "link": "td:first-child a", 
    "location": "td:nth-child(2)",
    "pagination_type": "one_page"
  },
  {
    "company": "Next Company",
    "url": "...",
    ...
  }
]
        """)
        return
    
    overall_start_time = datetime.now()
    all_results = []
    
    safe_print(f"\n📊 Starting scraping for {len(companies_config)} companies...")
    print(f"Global Settings:")
    print(f"  Max jobs per company: {GLOBAL_CONFIG['max_jobs_per_company']}")
    print(f"  Headless mode: {GLOBAL_CONFIG['headless']}")
    print(f"  Delay between companies: {GLOBAL_CONFIG['delay_between_companies']} seconds")
    
    with sync_playwright() as p:
        extension_path = r"C:\Programs\Playwright Scrapper 2\idcac_extension"  # Path to unpacked extension
        
        # Configure browser launch based on cookie handling preference
        if GLOBAL_CONFIG['use_extension'] and not GLOBAL_CONFIG['headless']:
            # Use extension-based cookie handling (requires non-headless mode)
            context_options = {
                'user_data_dir': "/tmp/playwright-profile",  # Persistent User Profile
                'headless': GLOBAL_CONFIG['headless'],
                'args': [
                    f"--disable-extensions-except={extension_path}", 
                    f"--load-extension={extension_path}",
                    "--disable-web-security",
                    "--disable-features=VizDisplayCompositor",
                    "--no-sandbox",
                    "--disable-dev-shm-usage"
                ]
            }
            safe_print(f"🔧 Using browser extension for cookie handling")
        else:
            # Use module-based cookie handling (works in headless mode)
            context_options = {
                'headless': GLOBAL_CONFIG['headless'],
                'args': [
                    "--disable-web-security",
                    "--disable-features=VizDisplayCompositor", 
                    "--no-sandbox",
                    "--disable-dev-shm-usage"
                ]
            }
            safe_print(f"🔧 Using Python module for cookie handling (Strategy: {GLOBAL_CONFIG['cookie_strategy']})")
        
        try:
            if GLOBAL_CONFIG['use_extension'] and not GLOBAL_CONFIG['headless']:
                context = p.chromium.launch_persistent_context(**context_options)
                page = context.new_page()
            else:
                browser = p.chromium.launch(**context_options)
                context = browser.new_context()
                page = context.new_page()
            
            # Initialize cookie handler if not using extension
            cookie_handler = None
            if not GLOBAL_CONFIG['use_extension']:
                cookie_handler = CookieBannerHandler()
                safe_print(f"✅ Cookie handler module initialized")
            
            # Set better page options
            page.set_default_timeout(30000)  # 30 second timeout
            page.set_default_navigation_timeout(30000)
            
            # Add error handling for page events
            page.on("pageerror", lambda err: print(f"Page error: {err}"))
            page.on("crash", lambda: print("Page crashed"))
            
        except Exception as e:
            safe_print(f"❌ Failed to create browser context: {e}")
            return

        try:
            for i, company_config in enumerate(companies_config):
                try:
                    # Normalize the configuration
                    normalized_config = normalize_company_config(company_config)
                    
                    # Create browser configuration object
                    browser_config = {
                        'extension_path': extension_path,
                        'context_options': context_options,
                        'use_extension': GLOBAL_CONFIG['use_extension'],
                        'headless': GLOBAL_CONFIG['headless']
                    }
                    
                    # Scrape this company
                    result = scrape_single_company(page, normalized_config, overall_start_time, cookie_handler, browser_config)
                    all_results.append(result)
                    
                    # Add delay between companies (except for the last one)
                    if i < len(companies_config) - 1:
                        delay = GLOBAL_CONFIG['delay_between_companies']
                        print(f"\n⏱️ Waiting {delay} seconds before next company...")
                        time.sleep(delay)
                        
                except Exception as e:
                    safe_print(f"❌ Error processing company {company_config.get('company', 'Unknown')}: {e}")
                    # Add a failed result
                    all_results.append({
                        "company_name": company_config.get('company', 'Unknown'),
                        "config": company_config,
                        "jobs": [],
                        "start_time": datetime.now(),
                        "end_time": datetime.now(),
                        "pages_scraped": 0,
                        "errors": [str(e)],
                        "timing_data": {"total": 0},
                        "status": "failed"
                    })
                    continue
                    
        finally:
            try:
                if GLOBAL_CONFIG['use_extension'] and not GLOBAL_CONFIG['headless']:
                    context.close()
                    safe_print("✅ Browser context closed successfully")
                else:
                    context.close()
                    browser.close()
                    safe_print("✅ Browser closed successfully")
            except Exception as e:
                safe_print(f"⚠️ Error closing browser: {e}")
    
    overall_end_time = datetime.now()
    
    # Display final summary
    print(f"\n{'='*80}")
    safe_print("🎉 MULTI-COMPANY SCRAPING COMPLETED")
    print(f"{'='*80}")
    
    total_companies = len(all_results)
    successful_companies = len([r for r in all_results if r["status"] == "success"])
    partial_companies = len([r for r in all_results if r["status"] == "partial_success"])
    failed_companies = len([r for r in all_results if r["status"] == "failed"])
    total_jobs = sum(len(r["jobs"]) for r in all_results)
    total_time = (overall_end_time - overall_start_time).total_seconds()
    
    safe_print(f"📊 SUMMARY:")
    print(f"  Total companies processed: {total_companies}")
    print(f"  Successful: {successful_companies}")
    print(f"  Partial success: {partial_companies}")
    print(f"  Failed: {failed_companies}")
    print(f"  Total jobs scraped: {total_jobs:,}")
    print(f"  Total time: {total_time:.2f} seconds ({total_time/60:.1f} minutes)")
    
    if total_jobs > 0:
        print(f"  Average jobs per company: {total_jobs/total_companies:.1f}")
        print(f"  Jobs per minute: {total_jobs/(total_time/60):.1f}")
    
    # Show company-wise summary
    safe_print(f"\n📋 COMPANY-WISE RESULTS:")
    print(f"{'Company':<25} {'Status':<15} {'Jobs':<8} {'Pages':<6} {'Time':<8}")
    print("-" * 70)
    
    for result in all_results:
        company_name = result["company_name"][:24]  # Truncate long names
        status = result["status"]
        job_count = len(result["jobs"])
        pages = result["pages_scraped"]
        duration = result["timing_data"].get("total", 0)
        
        print(f"{company_name:<25} {status:<15} {job_count:<8} {pages:<6} {duration:<8.1f}s")
    
    # Save results
    timestamp = overall_start_time.strftime("%Y%m%d_%H%M%S")
    filename = f"multi_company_results_{timestamp}.json"
    save_multi_company_results(all_results, overall_start_time, overall_end_time, filename)
    
    safe_print(f"\n✅ Results saved to: {filename}")
    safe_print("🎯 Ready for job categorization!")
    
    # Wait for user input before closing
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
