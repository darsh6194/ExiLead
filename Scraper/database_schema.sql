-- ExiLead Database Schema
-- PostgreSQL schema for storing scraped job data

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(500),
    description TEXT,
    logo_url VARCHAR(500),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    headquarters VARCHAR(255),
    job_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    employment_type VARCHAR(50), -- Full-time, Part-time, Contract, etc.
    experience_level VARCHAR(50), -- Entry-level, Mid-level, Senior, etc.
    work_mode VARCHAR(50), -- Remote, Hybrid, On-site
    category VARCHAR(100), -- Software Development, Data & Analytics, etc.
    is_technical VARCHAR(10) DEFAULT 'No', -- Yes/No
    description TEXT,
    job_id VARCHAR(100), -- Company's internal job ID
    department VARCHAR(100),
    remote_work VARCHAR(50),
    salary VARCHAR(255),
    deadline DATE,
    posted_date DATE,
    requirements JSONB, -- Array of requirements
    preferred_qualifications JSONB, -- Array of preferred qualifications
    responsibilities JSONB, -- Array of responsibilities
    benefits JSONB, -- Array of benefits
    skills JSONB, -- Array of required skills
    tags JSONB, -- Array of tags
    apply_link VARCHAR(1000) NOT NULL UNIQUE, -- Primary unique identifier
    source_url VARCHAR(1000), -- URL where job was scraped from
    scraped_at TIMESTAMP,
    job_details_info TEXT, -- Additional metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_apply_link ON jobs(apply_link);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_is_technical ON jobs(is_technical);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Update trigger for companies.updated_at
CREATE OR REPLACE FUNCTION update_company_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_timestamp
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_company_timestamp();

-- Update trigger for jobs.updated_at
CREATE OR REPLACE FUNCTION update_job_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_timestamp
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_timestamp();

-- Function to automatically update company job_count
CREATE OR REPLACE FUNCTION update_company_job_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update job count for the affected company(ies)
    IF TG_OP = 'INSERT' THEN
        UPDATE companies 
        SET job_count = (SELECT COUNT(*) FROM jobs WHERE company_id = NEW.company_id)
        WHERE id = NEW.company_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE companies 
        SET job_count = (SELECT COUNT(*) FROM jobs WHERE company_id = OLD.company_id)
        WHERE id = OLD.company_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If company_id changed, update both old and new companies
        IF OLD.company_id != NEW.company_id THEN
            UPDATE companies 
            SET job_count = (SELECT COUNT(*) FROM jobs WHERE company_id = OLD.company_id)
            WHERE id = OLD.company_id;
        END IF;
        UPDATE companies 
        SET job_count = (SELECT COUNT(*) FROM jobs WHERE company_id = NEW.company_id)
        WHERE id = NEW.company_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update company job counts
CREATE TRIGGER trigger_update_company_job_count_insert
    AFTER INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_company_job_count();

CREATE TRIGGER trigger_update_company_job_count_delete
    AFTER DELETE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_company_job_count();

CREATE TRIGGER trigger_update_company_job_count_update
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_company_job_count();

-- View for job statistics by company
CREATE OR REPLACE VIEW company_job_stats AS
SELECT 
    c.id,
    c.name,
    c.website,
    c.job_count,
    COUNT(j.id) as actual_job_count,
    COUNT(CASE WHEN j.is_technical = 'Yes' THEN 1 END) as technical_jobs,
    COUNT(CASE WHEN j.work_mode = 'Remote' THEN 1 END) as remote_jobs,
    COUNT(CASE WHEN j.work_mode = 'Hybrid' THEN 1 END) as hybrid_jobs,
    COUNT(CASE WHEN j.work_mode = 'On-site' THEN 1 END) as onsite_jobs,
    c.created_at,
    c.updated_at
FROM companies c
LEFT JOIN jobs j ON c.id = j.company_id
GROUP BY c.id, c.name, c.website, c.job_count, c.created_at, c.updated_at;

-- View for category statistics
CREATE OR REPLACE VIEW category_stats AS
SELECT 
    category,
    COUNT(*) as job_count,
    COUNT(CASE WHEN is_technical = 'Yes' THEN 1 END) as technical_count,
    COUNT(CASE WHEN work_mode = 'Remote' THEN 1 END) as remote_count,
    COUNT(DISTINCT company_id) as company_count
FROM jobs
GROUP BY category
ORDER BY job_count DESC;

-- View for recent jobs (last 7 days)
CREATE OR REPLACE VIEW recent_jobs AS
SELECT 
    j.id,
    j.title,
    c.name as company_name,
    j.location,
    j.work_mode,
    j.category,
    j.is_technical,
    j.apply_link,
    j.created_at
FROM jobs j
JOIN companies c ON j.company_id = c.id
WHERE j.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY j.created_at DESC;

-- Function to get duplicate jobs by apply_link
CREATE OR REPLACE FUNCTION find_duplicate_jobs()
RETURNS TABLE(apply_link VARCHAR, count BIGINT, job_titles TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.apply_link,
        COUNT(*) as count,
        STRING_AGG(j.title, ', ') as job_titles
    FROM jobs j
    GROUP BY j.apply_link
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data (optional - for testing)
-- INSERT INTO companies (name, website) VALUES 
-- ('TechCorp', 'https://techcorp.com'),
-- ('DataSoft', 'https://datasoft.com'),
-- ('CloudInc', 'https://cloudinc.com');

COMMENT ON TABLE companies IS 'Stores information about companies that post jobs';
COMMENT ON TABLE jobs IS 'Stores scraped job postings with detailed information';
COMMENT ON VIEW company_job_stats IS 'Provides statistics about jobs per company';
COMMENT ON VIEW category_stats IS 'Provides statistics about jobs per category';
COMMENT ON VIEW recent_jobs IS 'Shows jobs added in the last 7 days';
