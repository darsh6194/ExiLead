import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  website: text("website"),
  description: text("description"),
  logo: text("logo"),
  jobCount: integer("job_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  applyLink: text("apply_link").primaryKey().notNull(),
  companyId: integer("company_id").references(() => companies.id),
  title: text("title").notNull(),
  location: text("location"),
  employmentType: text("employment_type"),
  experienceLevel: text("experience_level"),
  workMode: text("work_mode"), // remote, onsite, hybrid
  category: text("category"),
  isTechnical: text("is_technical"),
  description: text("description"),
  
  // Enhanced fields from scraper
  jobId: text("job_id"), // External job ID (e.g., "R-238503")
  department: text("department"),
  remoteWork: text("remote_work"), // Remote/Hybrid/On-site
  salary: text("salary"),
  deadline: text("deadline"),
  postedDate: text("posted_date"),
  
  // JSON arrays for structured data
  requirements: jsonb("requirements").$type<string[]>(),
  preferredQualifications: jsonb("preferred_qualifications").$type<string[]>(),
  responsibilities: jsonb("responsibilities").$type<string[]>(),
  benefits: jsonb("benefits").$type<string[]>(),
  skills: jsonb("skills").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>(),
  
  // Links and metadata
  sourceUrl: text("source_url"),
  scrapedAt: timestamp("scraped_at"),
  jobDetailsInfo: text("job_details_info"), // Full HTML content from job page
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Enhanced types for scraper integration
export type ScrapedJob = {
  title: string;
  company: string;
  location: string;
  posted_date: string;
  apply_link: string;
  job_id?: string | null;
  department?: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  remote_work?: string | null;
  salary?: string | null;
  deadline?: string | null;
  description: string;
  requirements: string[];
  preferred_qualifications: string[];
  responsibilities: string[];
  benefits: string[];
  skills: string[];
  tags: string[];
  source_url: string;
  scraped_at: string;
  job_details_info: string;
};

// Extended types for frontend use
export type CompanyWithJobs = Company & {
  jobs: Job[];
};

export type JobWithCompany = Job & {
  company: Company;
};
