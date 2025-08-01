import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./database-storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Docker health checks
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Load initial data
  await storage.loadDataFromJson();

  // Get all companies
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get company with jobs (with pagination)
  app.get("/api/companies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // Higher default for company pages
      const category = req.query.category as string;
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 200) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }

      const company = await storage.getCompanyWithJobs(id, page, limit, category);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Search jobs within a specific company
  app.get("/api/companies/:id/search", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string;
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 200) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }

      const results = await storage.searchCompanyJobs(id, query, page, limit, category);
      res.json(results);
    } catch (error) {
      console.error('Company search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Get all jobs with pagination
  app.get("/api/jobs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }
      
      const result = await storage.getJobs(page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get job by apply link (URL encoded)
  app.get("/api/jobs/:applyLink(*)", async (req, res) => {
    try {
      const applyLink = decodeURIComponent(req.params.applyLink);
      if (!applyLink) {
        return res.status(400).json({ message: "Invalid apply link" });
      }

      const job = await storage.getJob(applyLink);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Also get company info
      const company = await storage.getCompany(job.companyId!);
      res.json({ ...job, company });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Search companies and jobs
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const results = await storage.searchCompaniesAndJobs(query);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Get jobs by category
  app.get("/api/categories/:category/jobs", async (req, res) => {
    try {
      const category = req.params.category;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      console.log(`Fetching jobs for category: ${category}, page: ${page}, limit: ${limit}`);
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }
      
      const result = await storage.getJobsByCategory(category, page, limit);
      console.log(`Found ${result.jobs.length} jobs for category ${category}`);
      res.json(result);
    } catch (error) {
      console.error('Error fetching jobs by category:', error);
      res.status(500).json({ message: "Failed to fetch jobs by category", error: String(error) });
    }
  });

  // Scraper Status Endpoints
  app.get("/api/scraper/status", async (req, res) => {
    try {
      const status = await storage.getScraperStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting scraper status:', error);
      res.status(500).json({ message: "Failed to fetch scraper status" });
    }
  });

  app.get("/api/scraper/runs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const runs = await storage.getScraperRuns(page, limit);
      res.json(runs);
    } catch (error) {
      console.error('Error getting scraper runs:', error);
      res.status(500).json({ message: "Failed to fetch scraper runs" });
    }
  });

  app.get("/api/scraper/config", async (req, res) => {
    try {
      const config = await storage.getScraperConfig();
      res.json(config);
    } catch (error) {
      console.error('Error getting scraper config:', error);
      res.status(500).json({ message: "Failed to fetch scraper config" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
