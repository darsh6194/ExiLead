# ExiLead API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Currently, no authentication is required for API endpoints.

## Endpoints

### Companies

#### GET /companies
Get a list of all companies with their job counts.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Mastercard",
    "industry": "Technology",
    "website": "https://careers.mastercard.com/us/en/search-results",
    "description": "Mastercard is a leading technology company with multiple open positions across various locations.",
    "logo": "",
    "jobCount": 172,
    "createdAt": "2025-07-21T09:15:00.000Z",
    "updatedAt": "2025-07-21T09:15:00.000Z"
  }
]
```

#### GET /companies/:id
Get a specific company with its jobs (paginated).

**Parameters:**
- `id` (path): Company ID
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 50)

**Response:**
```json
{
  "id": 1,
  "name": "Mastercard",
  "industry": "Technology",
  "website": "https://careers.mastercard.com/us/en/search-results",
  "description": "Mastercard is a leading technology company...",
  "logo": "",
  "jobCount": 172,
  "createdAt": "2025-07-21T09:15:00.000Z",
  "updatedAt": "2025-07-21T09:15:00.000Z",
  "jobs": [
    {
      "id": 1,
      "companyId": 1,
      "title": "Senior Software Engineer",
      "location": "New York, NY",
      "employmentType": "Full-time",
      "workMode": "Hybrid",
      "category": "Software Engineering",
      "isTechnical": "Technical",
      "description": "We are looking for a Senior Software Engineer...",
      "requirements": ["5+ years experience", "Java", "Spring Boot"],
      "benefits": ["Health insurance", "401k", "Remote work"],
      "skills": ["Java", "Spring", "AWS"],
      "applyLink": "https://careers.mastercard.com/apply/123",
      "sourceUrl": "https://careers.mastercard.com/job/123",
      "postedDate": "2025-07-15",
      "deadline": "2025-08-15",
      "salary": "$120,000 - $150,000",
      "createdAt": "2025-07-21T09:15:00.000Z",
      "updatedAt": "2025-07-21T09:15:00.000Z"
    }
  ],
  "pagination": {
    "total": 172,
    "hasMore": true
  }
}
```

### Jobs

#### GET /jobs
Get a paginated list of all technical jobs.

**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)

**Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "companyId": 1,
      "title": "Senior Software Engineer",
      "location": "New York, NY",
      "employmentType": "Full-time",
      "workMode": "Hybrid",
      "category": "Software Engineering",
      "isTechnical": "Technical",
      "description": "We are looking for a Senior Software Engineer...",
      "requirements": ["5+ years experience", "Java", "Spring Boot"],
      "benefits": ["Health insurance", "401k", "Remote work"],
      "skills": ["Java", "Spring", "AWS"],
      "applyLink": "https://careers.mastercard.com/apply/123",
      "sourceUrl": "https://careers.mastercard.com/job/123",
      "postedDate": "2025-07-15",
      "deadline": "2025-08-15",
      "salary": "$120,000 - $150,000",
      "createdAt": "2025-07-21T09:15:00.000Z",
      "updatedAt": "2025-07-21T09:15:00.000Z"
    }
  ],
  "total": 13966,
  "hasMore": true
}
```

#### GET /jobs/:id
Get a specific job with company information.

**Parameters:**
- `id` (path): Job ID

**Response:**
```json
{
  "id": 1,
  "companyId": 1,
  "title": "Senior Software Engineer",
  "location": "New York, NY",
  "employmentType": "Full-time",
  "workMode": "Hybrid",
  "category": "Software Engineering",
  "isTechnical": "Technical",
  "description": "We are looking for a Senior Software Engineer...",
  "requirements": ["5+ years experience", "Java", "Spring Boot"],
  "benefits": ["Health insurance", "401k", "Remote work"],
  "skills": ["Java", "Spring", "AWS"],
  "applyLink": "https://careers.mastercard.com/apply/123",
  "sourceUrl": "https://careers.mastercard.com/job/123",
  "postedDate": "2025-07-15",
  "deadline": "2025-08-15",
  "salary": "$120,000 - $150,000",
  "createdAt": "2025-07-21T09:15:00.000Z",
  "updatedAt": "2025-07-21T09:15:00.000Z",
  "company": {
    "id": 1,
    "name": "Mastercard",
    "industry": "Technology",
    "website": "https://careers.mastercard.com/us/en/search-results",
    "description": "Mastercard is a leading technology company...",
    "logo": "",
    "jobCount": 172
  }
}
```

### Categories

#### GET /categories
Get all available job categories (only for technical jobs).

**Response:**
```json
[
  "Administrative",
  "Consulting", 
  "Customer Success/Support",
  "Cybersecurity",
  "Data Science/Analytics",
  "Design/UX",
  "DevOps/Infrastructure",
  "Education",
  "Finance/Accounting",
  "HR/Recruiting",
  "Healthcare",
  "Legal",
  "Management",
  "Marketing",
  "Operations",
  "Product Management",
  "Quality Assurance",
  "Sales",
  "Software Engineering",
  "Other"
]
```

#### GET /categories/:category/jobs
Get jobs filtered by category with pagination.

**Parameters:**
- `category` (path): Category name (URL encoded)
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)

**Example Request:**
```
GET /categories/Software%20Engineering/jobs?page=1&limit=5
```

**Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "companyId": 1,
      "title": "Senior Software Engineer",
      "location": "New York, NY",
      "employmentType": "Full-time",
      "workMode": "Hybrid",
      "category": "Software Engineering",
      "isTechnical": "Technical",
      "description": "We are looking for a Senior Software Engineer...",
      "requirements": ["5+ years experience", "Java", "Spring Boot"],
      "benefits": ["Health insurance", "401k", "Remote work"],
      "skills": ["Java", "Spring", "AWS"],
      "applyLink": "https://careers.mastercard.com/apply/123",
      "sourceUrl": "https://careers.mastercard.com/job/123",
      "postedDate": "2025-07-15",
      "deadline": "2025-08-15",
      "salary": "$120,000 - $150,000",
      "createdAt": "2025-07-21T09:15:00.000Z",
      "updatedAt": "2025-07-21T09:15:00.000Z"
    }
  ],
  "total": 3245,
  "hasMore": true
}
```

### Search

#### GET /search
Search companies and jobs by query string.

**Parameters:**
- `q` (query): Search query string

**Example Request:**
```
GET /search?q=software%20engineer
```

**Response:**
```json
{
  "companies": [
    {
      "id": 1,
      "name": "Mastercard",
      "industry": "Technology",
      "website": "https://careers.mastercard.com/us/en/search-results",
      "description": "Mastercard is a leading technology company...",
      "logo": "",
      "jobCount": 172,
      "createdAt": "2025-07-21T09:15:00.000Z",
      "updatedAt": "2025-07-21T09:15:00.000Z"
    }
  ],
  "jobs": [
    {
      "id": 1,
      "companyId": 1,
      "title": "Senior Software Engineer",
      "location": "New York, NY",
      "employmentType": "Full-time",
      "workMode": "Hybrid",
      "category": "Software Engineering",
      "isTechnical": "Technical",
      "description": "We are looking for a Senior Software Engineer...",
      "requirements": ["5+ years experience", "Java", "Spring Boot"],
      "benefits": ["Health insurance", "401k", "Remote work"],
      "skills": ["Java", "Spring", "AWS"],
      "applyLink": "https://careers.mastercard.com/apply/123",
      "sourceUrl": "https://careers.mastercard.com/job/123",
      "postedDate": "2025-07-15",
      "deadline": "2025-08-15",
      "salary": "$120,000 - $150,000",
      "createdAt": "2025-07-21T09:15:00.000Z",
      "updatedAt": "2025-07-21T09:15:00.000Z"
    }
  ]
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "message": "Invalid company ID"
}
```

### 404 Not Found
```json
{
  "message": "Job not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Failed to fetch companies"
}
```

## Field Descriptions

### Company Fields
- `id`: Unique identifier for the company
- `name`: Company name
- `industry`: Industry sector (Technology, Financial Services, Healthcare, Retail)
- `website`: Company careers page URL
- `description`: Brief description of the company
- `logo`: Logo URL (currently empty)
- `jobCount`: Number of technical jobs available
- `createdAt`: Record creation timestamp
- `updatedAt`: Record last update timestamp

### Job Fields
- `id`: Unique identifier for the job
- `companyId`: Reference to the company
- `title`: Job title
- `location`: Job location (city, state, country)
- `employmentType`: Type of employment (Full-time, Part-time, Contract, Internship)
- `workMode`: Work arrangement (On-site, Remote, Hybrid)
- `category`: Job category (one of 20 predefined categories)
- `isTechnical`: Whether the job is technical ("Technical" or "Non-Technical")
- `description`: Detailed job description
- `requirements`: Array of job requirements
- `benefits`: Array of company benefits
- `skills`: Array of required/preferred skills
- `applyLink`: Direct application URL
- `sourceUrl`: Original job posting URL
- `postedDate`: When the job was posted
- `deadline`: Application deadline (if specified)
- `salary`: Salary range (if specified)
- `createdAt`: Record creation timestamp
- `updatedAt`: Record last update timestamp

## Data Statistics

### Current Database Contents
- **Total Companies**: 42
- **Total Technical Jobs**: 13,966
- **Available Categories**: 20
- **Largest Company**: Accenture (9,018 technical jobs)
- **Industries Covered**: Technology, Financial Services, Healthcare, Retail

### Top Companies by Job Count
1. Accenture - 9,018 jobs
2. IBM - 1,250 jobs  
3. Amazon - 1,228 jobs
4. Citi Bank - 746 jobs
5. Goldman Sachs - 644 jobs

### Job Distribution by Category
The jobs are distributed across 20 categories, with Software Engineering, Consulting, and Data Science/Analytics being the most common categories.

## Rate Limiting
Currently, no rate limiting is implemented. In production, consider implementing rate limiting to prevent abuse.

## CORS
CORS is configured to allow all origins in development. Adjust for production deployment.

## Caching
No caching is currently implemented. Consider adding Redis or in-memory caching for frequently accessed data in production.
