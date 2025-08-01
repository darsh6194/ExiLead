#!/usr/bin/env python3
"""
Database Setup Script for ExiLead
Initialize PostgreSQL database with required schema
"""

import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def setup_database():
    """Setup the database with required schema"""
    
    print("🗄️ EXILEAD DATABASE SETUP")
    print("=" * 50)
    
    try:
        # Get database URL
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("❌ DATABASE_URL not found in environment variables")
            print("💡 Please set DATABASE_URL in your .env file")
            print("   Example: DATABASE_URL=postgresql://user:password@localhost:5432/exilead")
            return False
        
        print(f"🔗 Connecting to database...")
        
        # Connect to database
        connection = psycopg2.connect(database_url)
        connection.autocommit = True
        
        print("✅ Database connection successful")
        
        # Read schema file
        schema_file = os.path.join(os.path.dirname(__file__), 'database_schema.sql')
        
        if not os.path.exists(schema_file):
            print(f"❌ Schema file not found: {schema_file}")
            return False
        
        print("📋 Reading database schema...")
        
        with open(schema_file, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # Execute schema
        print("🔨 Creating database schema...")
        
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
        
        print("✅ Database schema created successfully")
        
        # Verify tables were created
        print("🔍 Verifying table creation...")
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            
            tables = cursor.fetchall()
            
            print(f"📊 Created {len(tables)} tables:")
            for table in tables:
                print(f"  ✓ {table[0]}")
        
        # Verify views were created
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.views 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            
            views = cursor.fetchall()
            
            print(f"👁️ Created {len(views)} views:")
            for view in views:
                print(f"  ✓ {view[0]}")
        
        # Test basic functionality
        print("🧪 Testing basic functionality...")
        
        with connection.cursor() as cursor:
            # Test company insertion
            cursor.execute("""
                INSERT INTO companies (name, website) 
                VALUES ('Test Company', 'https://test.com')
                ON CONFLICT (name) DO NOTHING
            """)
            
            # Test job count trigger
            cursor.execute("SELECT job_count FROM companies WHERE name = 'Test Company'")
            result = cursor.fetchone()
            
            if result and result[0] == 0:
                print("✅ Database triggers working correctly")
            else:
                print("⚠️ Database triggers may not be working properly")
        
        connection.close()
        
        print("\n🎉 DATABASE SETUP COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        print("💡 You can now run the automated scraper:")
        print("   python automated_scraper.py")
        print("   python automated_scraper.py --stats-only")
        
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Setup error: {e}")
        return False

def test_database_connection():
    """Test if database connection is working"""
    
    print("🔍 TESTING DATABASE CONNECTION")
    print("=" * 40)
    
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("❌ DATABASE_URL not found")
            return False
        
        connection = psycopg2.connect(database_url)
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            print(f"✅ Connected to: {version}")
            
            # Test tables exist
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('companies', 'jobs')
            """)
            table_count = cursor.fetchone()[0]
            
            if table_count == 2:
                print("✅ Required tables exist")
            else:
                print("⚠️ Some required tables are missing")
                return False
        
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

def reset_database():
    """Reset database by dropping and recreating all tables"""
    
    print("🔥 RESETTING DATABASE")
    print("=" * 40)
    print("⚠️ This will DELETE ALL DATA!")
    
    confirm = input("Type 'RESET' to confirm: ")
    if confirm != 'RESET':
        print("❌ Reset cancelled")
        return False
    
    try:
        database_url = os.getenv('DATABASE_URL')
        connection = psycopg2.connect(database_url)
        connection.autocommit = True
        
        with connection.cursor() as cursor:
            # Drop tables in correct order (jobs first due to foreign key)
            cursor.execute("DROP TABLE IF EXISTS jobs CASCADE")
            cursor.execute("DROP TABLE IF EXISTS companies CASCADE")
            
            # Drop views
            cursor.execute("DROP VIEW IF EXISTS company_job_stats CASCADE")
            cursor.execute("DROP VIEW IF EXISTS category_stats CASCADE")
            cursor.execute("DROP VIEW IF EXISTS recent_jobs CASCADE")
            
            # Drop functions
            cursor.execute("DROP FUNCTION IF EXISTS update_company_timestamp() CASCADE")
            cursor.execute("DROP FUNCTION IF EXISTS update_job_timestamp() CASCADE")
            cursor.execute("DROP FUNCTION IF EXISTS update_company_job_count() CASCADE")
            cursor.execute("DROP FUNCTION IF EXISTS find_duplicate_jobs() CASCADE")
        
        connection.close()
        
        print("✅ Database reset complete")
        print("💡 Run setup again to recreate schema:")
        print("   python database_setup.py --setup")
        
        return True
        
    except Exception as e:
        print(f"❌ Reset failed: {e}")
        return False

def show_database_info():
    """Show database information and statistics"""
    
    print("📊 DATABASE INFORMATION")
    print("=" * 50)
    
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("❌ DATABASE_URL not found")
            return False
        
        connection = psycopg2.connect(database_url)
        
        with connection.cursor() as cursor:
            # Database version
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            print(f"Database: {version.split()[0]} {version.split()[1]}")
            
            # Table information
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            """)
            
            tables = cursor.fetchall()
            print(f"\n📋 Tables ({len(tables)}):")
            for schema, table, size in tables:
                print(f"  {table}: {size}")
            
            # Record counts
            cursor.execute("SELECT COUNT(*) FROM companies")
            company_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM jobs")
            job_count = cursor.fetchone()[0]
            
            print(f"\n📈 Records:")
            print(f"  Companies: {company_count:,}")
            print(f"  Jobs: {job_count:,}")
            
            # Recent activity
            cursor.execute("""
                SELECT COUNT(*) FROM jobs 
                WHERE created_at >= CURRENT_DATE
            """)
            today_jobs = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM jobs 
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            """)
            week_jobs = cursor.fetchone()[0]
            
            print(f"\n🕒 Recent Activity:")
            print(f"  Jobs added today: {today_jobs:,}")
            print(f"  Jobs added this week: {week_jobs:,}")
        
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ Error getting database info: {e}")
        return False

def main():
    """Main function with command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ExiLead Database Setup')
    parser.add_argument('--setup', action='store_true', help='Setup database schema')
    parser.add_argument('--test', action='store_true', help='Test database connection')
    parser.add_argument('--reset', action='store_true', help='Reset database (DELETE ALL DATA)')
    parser.add_argument('--info', action='store_true', help='Show database information')
    
    args = parser.parse_args()
    
    if args.setup:
        success = setup_database()
        if not success:
            exit(1)
    elif args.test:
        success = test_database_connection()
        if not success:
            exit(1)
    elif args.reset:
        success = reset_database()
        if not success:
            exit(1)
    elif args.info:
        success = show_database_info()
        if not success:
            exit(1)
    else:
        print("ExiLead Database Setup Tool")
        print("Usage:")
        print("  python database_setup.py --setup    # Setup database schema")
        print("  python database_setup.py --test     # Test database connection") 
        print("  python database_setup.py --info     # Show database info")
        print("  python database_setup.py --reset    # Reset database (DANGER!)")

if __name__ == "__main__":
    main()
