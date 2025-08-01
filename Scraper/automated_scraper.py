#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automated Scraper with Database Integration
Combines web scraping with direct database storage
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

import subprocess
import json
import time
from datetime import datetime
from database_pipeline import DatabasePipeline, save_scraper_results_to_db

def safe_print(text):
    """Safe printing function that handles Unicode characters on Windows"""
    try:
        print(text)
    except UnicodeEncodeError:
        # Fallback: replace problematic characters with ASCII equivalents
        emoji_replacements = {
            '🤖': '[ROBOT]',
            '🕷️': '[SPIDER]',
            '📄': '[DOCUMENT]',
            '⚠️': '[WARNING]',
            '❌': '[X]',
            '📁': '[FOLDER]',
            '🗄️': '[DATABASE]',
            '🎯': '[TARGET]',
            '⏱️': '[TIMER]',
            '📊': '[CHART]',
            '✅': '[CHECK]',
            '💡': '[BULB]',
            '🏢': '[BUILDING]',
            '💼': '[BRIEFCASE]',
            '🆕': '[NEW]',
            '🏷️': '[TAG]',
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

def run_scraper_with_db_integration(companies_file=None, auto_save=True, keep_json=False):
    """
    Run the Final_Scraper.py and automatically save results to database
    
    Args:
        companies_file: Path to companies.json file (optional)
        auto_save: Whether to automatically save to database after scraping
        keep_json: Whether to keep the JSON results file after database save
    """
    
    safe_print("🤖 AUTOMATED SCRAPER WITH DATABASE INTEGRATION")
    print("=" * 80)
    
    # Set up scraper command
    scraper_command = [sys.executable, "Final_Scraper.py"]
    
    if companies_file:
        scraper_command.extend(["--companies", companies_file])
    
    # Run the scraper
    safe_print("🕷️ Starting web scraper...")
    print(f"Command: {' '.join(scraper_command)}")
    print("-" * 80)
    
    start_time = time.time()
    
    try:
        # Run scraper process with real-time output
        safe_print("🚀 Starting Final_Scraper.py with real-time output...")
        print("-" * 80)
        
        # Use Popen for real-time output streaming with proper encoding
        process = subprocess.Popen(
            scraper_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            encoding='utf-8',
            errors='replace',  # Replace problematic characters
            bufsize=1,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        # Stream output in real-time
        output_lines = []
        try:
            while True:
                try:
                    output = process.stdout.readline()
                    if output == '' and process.poll() is not None:
                        break
                    if output:
                        # Use safe_print for output that might contain emojis
                        safe_print(output.strip())
                        output_lines.append(output)
                except UnicodeDecodeError as e:
                    # Handle any remaining encoding issues
                    safe_print(f"[Encoding issue in output: {e}]")
                    continue
        except KeyboardInterrupt:
            safe_print("\n⚠️ KEYBOARD INTERRUPT DETECTED (Ctrl+C)")
            safe_print("🔄 Gracefully stopping scraper...")
            safe_print("💡 TIP: Let the scraper complete fully to save results to database!")
            safe_print("📝 If scraping is done, results will still be saved to JSON file.")
            
            process.terminate()
            try:
                process.wait(timeout=10)
                safe_print("✅ Scraper stopped gracefully")
            except subprocess.TimeoutExpired:
                safe_print("⚠️ Force killing scraper process...")
                process.kill()
                safe_print("❌ Process force killed - some data may be lost")
            
            # Still try to find and process any results file that was created
            safe_print("\n🔍 Checking if any results were saved before interruption...")
            results_file = find_latest_results_file()
            if results_file and auto_save:
                safe_print(f"📁 Found partial results: {results_file}")
                safe_print("🤖 Attempting to save partial results to database...")
                # Continue execution to process what we have
            else:
                safe_print("❌ No results file found - nothing to save")
                return False
        
        # Wait for process to complete
        process.wait()
        
        scraper_duration = time.time() - start_time
        full_output = ''.join(output_lines)
        
        safe_print(f"\n🕷️ SCRAPER COMPLETED in {scraper_duration:.2f} seconds")
        print("=" * 80)
        
        if process.returncode != 0:
            safe_print(f"❌ Scraper failed with exit code: {process.returncode}")
            return False
        
        # Find the results file
        safe_print("🔍 Looking for results file...")
        results_file = find_latest_results_file()
        
        if not results_file:
            safe_print("❌ No results file found after scraping")
            return False
        
        safe_print(f"📁 Found results file: {results_file}")
        
        # Check if file has content
        try:
            with open(results_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'companies' in data:
                    total_jobs = sum(len(company_data.get('jobs', [])) for company_data in data['companies'].values())
                    safe_print(f"📊 Results file contains {total_jobs} jobs from {len(data['companies'])} companies")
                else:
                    safe_print("⚠️ Results file format may be different")
        except Exception as e:
            safe_print(f"⚠️ Could not analyze results file: {e}")
        
        if auto_save:
            safe_print("\n🗄️ STARTING DATABASE SAVE PROCESS")
            safe_print("📝 This will save new jobs to the database and skip duplicates...")
            print("=" * 80)
            
            # Save to database
            db_start_time = time.time()
            stats = save_scraper_results_to_db(results_file, delete_file_after=not keep_json)
            db_duration = time.time() - db_start_time
            
            if stats:
                total_duration = time.time() - start_time
                
                safe_print(f"\n🎯 COMPLETE PIPELINE SUMMARY")
                print("=" * 80)
                safe_print(f"⏱️ Timing:")
                print(f"  Scraping Time: {scraper_duration:.2f} seconds")
                print(f"  Database Save Time: {db_duration:.2f} seconds")
                print(f"  Total Pipeline Time: {total_duration:.2f} seconds")
                safe_print(f"📊 Final Results:")
                print(f"  Total Jobs Processed: {stats['total_jobs']}")
                print(f"  Successfully Saved to DB: {stats['saved_jobs']}")
                print(f"  Skipped (Duplicates): {stats['skipped_duplicates']}")
                print(f"  Errors: {stats['errors']}")
                print(f"  Overall Success Rate: {(stats['saved_jobs'] / max(stats['total_jobs'], 1) * 100):.1f}%")
                print("=" * 80)
                
                return True
            else:
                safe_print("❌ Database save failed")
                return False
        else:
            safe_print(f"✅ Scraping completed. Results saved to: {results_file}")
            safe_print("💡 To save to database, run:")
            print(f"   python database_pipeline.py {results_file}")
            return True
            
    except Exception as e:
        safe_print(f"❌ Pipeline error: {e}")
        return False

def find_latest_results_file():
    """Find the most recent results file"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    safe_print("🔍 Searching for results files...")
    
    # Common result file patterns
    patterns = [
        "multi_company_job_results.json",
        "job_results.json",
        "scraper_results.json"
    ]
    
    # Look for files with these patterns
    for pattern in patterns:
        file_path = os.path.join(current_dir, pattern)
        if os.path.exists(file_path):
            safe_print(f"✅ Found standard results file: {pattern}")
            return file_path
    
    # Look for timestamped files created by Final_Scraper.py
    try:
        # Pattern: multi_company_results_YYYYMMDD_HHMMSS.json
        import glob
        timestamped_files = glob.glob(os.path.join(current_dir, "multi_company_results_*.json"))
        if timestamped_files:
            # Return the most recent one
            timestamped_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            latest_file = timestamped_files[0]
            filename = os.path.basename(latest_file)
            safe_print(f"✅ Found timestamped results file: {filename}")
            return latest_file
    except Exception as e:
        safe_print(f"⚠️ Error searching for timestamped files: {e}")
    
    # Look for any JSON files with "results" in the name
    try:
        json_files = [f for f in os.listdir(current_dir) 
                     if f.endswith('.json') and 'result' in f.lower()]
        
        if json_files:
            # Return the most recently modified
            json_files.sort(key=lambda x: os.path.getmtime(os.path.join(current_dir, x)), reverse=True)
            latest_file = json_files[0]
            safe_print(f"✅ Found generic results file: {latest_file}")
            return os.path.join(current_dir, latest_file)
    except Exception as e:
        safe_print(f"⚠️ Error searching for generic results files: {e}")
    
    # List all JSON files for debugging
    try:
        all_json_files = [f for f in os.listdir(current_dir) if f.endswith('.json')]
        if all_json_files:
            safe_print(f"📋 Available JSON files in directory:")
            for f in all_json_files:
                safe_print(f"   - {f}")
        else:
            safe_print("📋 No JSON files found in directory")
    except Exception as e:
        safe_print(f"⚠️ Error listing JSON files: {e}")
    
    safe_print("❌ No suitable results file found")
    return None

def show_database_stats():
    """Show current database statistics"""
    try:
        db_pipeline = DatabasePipeline()
        
        with db_pipeline.connection.cursor() as cursor:
            # Get company count
            cursor.execute("SELECT COUNT(*) FROM companies")
            company_count = cursor.fetchone()[0]
            
            # Get job count
            cursor.execute("SELECT COUNT(*) FROM jobs") 
            job_count = cursor.fetchone()[0]
            
            # Get recent jobs (last 24 hours)
            cursor.execute("""
                SELECT COUNT(*) FROM jobs 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            """)
            recent_jobs = cursor.fetchone()[0]
            
            # Get top categories
            cursor.execute("""
                SELECT category, COUNT(*) as count
                FROM jobs
                GROUP BY category
                ORDER BY count DESC
                LIMIT 5
            """)
            top_categories = cursor.fetchall()
            
            safe_print(f"\n📊 CURRENT DATABASE STATISTICS")
            print("=" * 60)
            safe_print(f"🏢 Total Companies: {company_count}")
            safe_print(f"💼 Total Jobs: {job_count}")
            safe_print(f"🆕 Jobs Added (Last 24h): {recent_jobs}")
            safe_print(f"\n🏷️ Top Job Categories:")
            for category, count in top_categories:
                print(f"  {category}: {count} jobs")
            print("=" * 60)
        
        db_pipeline.close()
        
    except Exception as e:
        safe_print(f"❌ Error getting database stats: {e}")

def main():
    """Main function with command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Automated Scraper with Database Integration')
    parser.add_argument('--companies', help='Path to companies.json file')
    parser.add_argument('--no-auto-save', action='store_true', 
                       help='Skip automatic database save')
    parser.add_argument('--keep-json', action='store_true',
                       help='Keep JSON results file after database save')
    parser.add_argument('--stats-only', action='store_true',
                       help='Show database statistics only')
    parser.add_argument('--pipeline-only', help='Run database pipeline on existing JSON file')
    
    args = parser.parse_args()
    
    if args.stats_only:
        show_database_stats()
        return
    
    if args.pipeline_only:
        if not os.path.exists(args.pipeline_only):
            safe_print(f"❌ File not found: {args.pipeline_only}")
            sys.exit(1)
        
        stats = save_scraper_results_to_db(args.pipeline_only, delete_file_after=not args.keep_json)
        if stats:
            safe_print("✅ Pipeline completed successfully!")
        else:
            safe_print("❌ Pipeline failed!")
            sys.exit(1)
        return
    
    # Run full pipeline
    success = run_scraper_with_db_integration(
        companies_file=args.companies,
        auto_save=not args.no_auto_save,
        keep_json=args.keep_json
    )
    
    if success:
        safe_print("\n✅ AUTOMATED PIPELINE COMPLETED SUCCESSFULLY!")
        show_database_stats()
    else:
        safe_print("\n❌ PIPELINE FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    main()
