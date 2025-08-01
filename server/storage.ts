import { companies, jobs, type Company, type Job, type InsertCompany, type InsertJob, type CompanyWithJobs } from "@shared/schema";
import fs from 'fs';
import path from 'path';

export interface IStorage {
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyWithJobs(id: number, page?: number, limit?: number): Promise<(CompanyWithJobs & { pagination?: { total: number, hasMore: boolean } }) | undefined>;
  getJobs(page?: number, limit?: number): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  getJobsByCompany(companyId: number): Promise<Job[]>;
  getJobsByCategory(category: string, page?: number, limit?: number): Promise<{ jobs: Job[], total: number, hasMore: boolean }>;
  getCategories(): Promise<string[]>;
  getJob(applyLink: string): Promise<Job | undefined>;
  searchCompaniesAndJobs(query: string): Promise<{ companies: Company[], jobs: Job[] }>;
  createCompany(company: InsertCompany): Promise<Company>;
  createJob(job: InsertJob): Promise<Job>;
  loadDataFromJson(): Promise<void>;
}

export class MemStorage implements IStorage {
  private companies: Map<number, Company>;
  private jobs: Map<string, Job>; // Changed to string key for applyLink
  private currentCompanyId: number;

  constructor() {
    this.companies = new Map();
    this.jobs = new Map();
    this.currentCompanyId = 1;
  }

  async loadDataFromJson(): Promise<void> {
    try {
      const dataPath = path.resolve(process.cwd(), 'data/Final_json_with_categories.json');
      if (fs.existsSync(dataPath)) {
        const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        
        // Clear existing data
        this.companies.clear();
        this.jobs.clear();
        this.currentCompanyId = 1;

        // Load companies and jobs from JSON
        if (jsonData.companies) {
          for (const [companyName, companyData] of Object.entries(jsonData.companies as any)) {
            const company_data = companyData as any;
            // Extract industry from company name or set default
            let industry = "Technology";
            if (companyName.toLowerCase().includes("bank") || companyName.toLowerCase().includes("financial")) {
              industry = "Financial Services";
            } else if (companyName.toLowerCase().includes("health") || companyName.toLowerCase().includes("medical")) {
              industry = "Healthcare";
            } else if (companyName.toLowerCase().includes("retail") || companyName.toLowerCase().includes("consumer")) {
              industry = "Retail";
            }

            // Count only technical jobs for this company
            const technicalJobsCount = company_data.jobs ? 
              company_data.jobs.filter((job: any) => job.is_technical === "Technical").length : 0;

            const company: Company = {
              id: this.currentCompanyId++,
              name: company_data.company || companyName,
              industry: industry,
              website: company_data.url || "",
              description: `${company_data.company || companyName} is a leading ${industry.toLowerCase()} company with multiple open positions across various locations.`,
              logo: "",
              jobCount: technicalJobsCount,
              createdAt: new Date(),
            };
            
            this.companies.set(company.id, company);

            // Load jobs for this company
            if (company_data.jobs && Array.isArray(company_data.jobs)) {
              for (const jobData of company_data.jobs) {
                // Parse employment type from title or use default
                let employmentType = "Full-time";
                if (jobData.title?.toLowerCase().includes("intern")) {
                  employmentType = "Internship";
                } else if (jobData.title?.toLowerCase().includes("contract")) {
                  employmentType = "Contract";
                } else if (jobData.title?.toLowerCase().includes("part-time")) {
                  employmentType = "Part-time";
                }

                // Parse work mode from location or remote field
                let workMode = "On-site";
                if (jobData.remote_work === "Yes" || jobData.location?.toLowerCase().includes("remote")) {
                  workMode = "Remote";
                } else if (jobData.location?.toLowerCase().includes("hybrid")) {
                  workMode = "Hybrid";
                }

                // Parse skills from title (common tech skills)
                const skillsFromTitle = [];
                const techSkills = ["java", "python", "javascript", "react", "node", "aws", "azure", "sql", "mongodb", "kubernetes", "docker", "spring", "angular", "vue", "typescript", "golang", "c++", "c#", ".net", "php", "ruby", "scala", "kotlin"];
                for (const skill of techSkills) {
                  if (jobData.title?.toLowerCase().includes(skill)) {
                    skillsFromTitle.push(skill.charAt(0).toUpperCase() + skill.slice(1));
                  }
                }

                const job: Job = {
                  applyLink: jobData.apply_link || "",
                  companyId: company.id,
                  title: jobData.title || "Software Engineer",
                  location: jobData.location || "Not specified",
                  employmentType: employmentType,
                  experience: null,
                  experienceLevel: null,
                  workMode: workMode,
                  category: jobData.category || "Other",
                  isTechnical: jobData.is_technical || "Technical",
                  description: jobData.description && jobData.description !== "N/A" ? jobData.description : `Join ${company.name} as a ${jobData.title}. We are looking for talented professionals to join our team.`,
                  jobId: null,
                  department: null,
                  remoteWork: jobData.remote_work || null,
                  salary: jobData.salary && jobData.salary !== "N/A" ? jobData.salary : null,
                  deadline: jobData.deadline && jobData.deadline !== "N/A" ? jobData.deadline : null,
                  postedDate: jobData.posted_date && jobData.posted_date !== "N/A" ? jobData.posted_date : "Recently posted",
                  requirements: jobData.requirements && jobData.requirements !== "N/A" ? (Array.isArray(jobData.requirements) ? jobData.requirements : [jobData.requirements]) : null,
                  preferredQualifications: null,
                  responsibilities: null,
                  benefits: jobData.benefits && jobData.benefits !== "N/A" ? (Array.isArray(jobData.benefits) ? jobData.benefits : [jobData.benefits]) : null,
                  skills: skillsFromTitle.length > 0 ? skillsFromTitle : null,
                  tags: null,
                  sourceUrl: jobData.source_url || null,
                  scrapedAt: null,
                  jobDetailsInfo: null,
                  createdAt: new Date(),
                };
                
                // Only add technical jobs
                if (jobData.is_technical === "Technical") {
                  this.jobs.set(job.applyLink, job);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading data from JSON:', error);
    }
  }

  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanyWithJobs(id: number, page: number = 1, limit: number = 20): Promise<(CompanyWithJobs & { pagination?: { total: number, hasMore: boolean } }) | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;

    const allCompanyTechnicalJobs = Array.from(this.jobs.values()).filter(job => 
      job.companyId === id && job.isTechnical === "Technical"
    );
    const total = allCompanyTechnicalJobs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const jobs = allCompanyTechnicalJobs.slice(startIndex, endIndex);
    const hasMore = endIndex < total;
    
    return {
      ...company,
      jobs,
      pagination: { total, hasMore },
    };
  }

  async getJobs(page: number = 1, limit: number = 20): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
    const allTechnicalJobs = Array.from(this.jobs.values()).filter(job => job.isTechnical === "Technical");
    const total = allTechnicalJobs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const jobs = allTechnicalJobs.slice(startIndex, endIndex);
    const hasMore = endIndex < total;
    
    return { jobs, total, hasMore };
  }

  async getJobsByCompany(companyId: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => 
      job.companyId === companyId && job.isTechnical === "Technical"
    );
  }

  async getJobsByCategory(category: string, page: number = 1, limit: number = 20): Promise<{ jobs: Job[], total: number, hasMore: boolean }> {
    const allCategoryJobs = Array.from(this.jobs.values()).filter(job => 
      job.isTechnical === "Technical" && 
      job.category && job.category.toLowerCase() === category.toLowerCase()
    );
    const total = allCategoryJobs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const jobs = allCategoryJobs.slice(startIndex, endIndex);
    const hasMore = endIndex < total;
    
    return { jobs, total, hasMore };
  }

  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();
    const validCompanyIds = new Set(Array.from(this.companies.keys()));
    const excludedCategories = ["Education", "HR/Recruiting", "Human Resources", "Legal/Compliance", "Healthcare", "Sales", "Administrative"];
    
    Array.from(this.jobs.values()).forEach(job => {
      // Only include categories from jobs that belong to valid companies and are not excluded
      if (job.category && 
          job.isTechnical === "Technical" && 
          job.companyId && 
          validCompanyIds.has(job.companyId) &&
          !excludedCategories.includes(job.category)) {
        categories.add(job.category);
      }
    });
    return Array.from(categories).sort();
  }

  async getJob(applyLink: string): Promise<Job | undefined> {
    return this.jobs.get(applyLink);
  }

  async searchCompaniesAndJobs(query: string): Promise<{ companies: Company[], jobs: Job[] }> {
    const lowerQuery = query.toLowerCase();
    
    const matchedCompanies = Array.from(this.companies.values()).filter(company =>
      company.name.toLowerCase().includes(lowerQuery) ||
      (company.industry && company.industry.toLowerCase().includes(lowerQuery))
    );

    const matchedJobs = Array.from(this.jobs.values()).filter(job =>
      (job.isTechnical === "Technical") && (
        job.title.toLowerCase().includes(lowerQuery) ||
        (job.location && job.location.toLowerCase().includes(lowerQuery)) ||
        (job.category && job.category.toLowerCase().includes(lowerQuery)) ||
        (job.skills && job.skills.some(skill => skill.toLowerCase().includes(lowerQuery)))
      )
    );

    return { companies: matchedCompanies, jobs: matchedJobs };
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = this.currentCompanyId++;
    const company: Company = { 
      ...insertCompany, 
      id,
      industry: insertCompany.industry || null,
      website: insertCompany.website || null,
      description: insertCompany.description || null,
      logo: insertCompany.logo || null,
      jobCount: insertCompany.jobCount || 0,
      createdAt: new Date(),
    };
    this.companies.set(id, company);
    return company;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const job: Job = { 
      ...insertJob, 
      applyLink: insertJob.applyLink,
      companyId: insertJob.companyId || null,
      location: insertJob.location || null,
      employmentType: insertJob.employmentType || null,
      experience: insertJob.experience || null,
      experienceLevel: insertJob.experienceLevel || null,
      workMode: insertJob.workMode || null,
      category: insertJob.category || null,
      isTechnical: insertJob.isTechnical || null,
      description: insertJob.description || null,
      jobId: insertJob.jobId || null,
      department: insertJob.department || null,
      remoteWork: insertJob.remoteWork || null,
      salary: insertJob.salary || null,
      deadline: insertJob.deadline || null,
      postedDate: insertJob.postedDate || null,
      requirements: insertJob.requirements as string[] || null,
      preferredQualifications: insertJob.preferredQualifications as string[] || null,
      responsibilities: insertJob.responsibilities as string[] || null,
      benefits: insertJob.benefits as string[] || null,
      skills: insertJob.skills as string[] || null,
      tags: insertJob.tags as string[] || null,
      sourceUrl: insertJob.sourceUrl || null,
      scrapedAt: insertJob.scrapedAt || null,
      jobDetailsInfo: insertJob.jobDetailsInfo || null,
      createdAt: new Date(),
    };
    this.jobs.set(job.applyLink, job);
    
    // Update company job count only for technical jobs
    if (job.isTechnical === "Technical") {
      const company = this.companies.get(insertJob.companyId!);
      if (company) {
        company.jobCount = (company.jobCount || 0) + 1;
        this.companies.set(company.id, company);
      }
    }
    
    return job;
  }
}

export const storage = new MemStorage();
