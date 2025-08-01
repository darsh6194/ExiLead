# Job Openings Platform

## Overview

This is a modern, responsive web-based Job Openings Platform built for service-based enterprises. The application displays company listings with their job openings, providing search and filtering capabilities for job seekers. The platform features a clean, Google-inspired design with both grid and list views for companies, detailed job listings, and modal-based job details.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: Radix UI primitives with custom shadcn/ui components
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Data Storage**: In-memory storage with JSON file initialization
- **API Pattern**: RESTful API with structured error handling

### Project Structure
The application follows a monorepo structure with clear separation:
- `client/` - Frontend React application
- `server/` - Backend Express.js API
- `shared/` - Shared TypeScript types and database schema
- `data/` - Initial job data in JSON format

## Key Components

### Frontend Components
- **Header**: Navigation with search, theme toggle, and view mode switching
- **CompanyCard**: Displays company information in grid or list format
- **JobCard**: Shows individual job postings with key details
- **JobDetailModal**: Full job details in a modal overlay
- **FiltersBar**: Advanced filtering by location, employment type, and work mode
- **LoadingSkeleton**: Animated loading states for better UX

### Backend Components
- **Storage Layer**: Abstracted storage interface with in-memory implementation
- **Routes**: RESTful endpoints for companies, jobs, and search
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Data Loading**: Automatic JSON data initialization on server start

### Database Schema
- **Companies Table**: Stores company information (name, industry, website, description)
- **Jobs Table**: Job postings linked to companies with detailed information
- **Relationships**: One-to-many relationship between companies and jobs

## Data Flow

1. **Initial Load**: Server loads company and job data from JSON file into memory
2. **Client Requests**: Frontend makes API calls to fetch companies and jobs
3. **Search/Filter**: Real-time search and filtering through debounced queries
4. **Job Details**: Modal-based job detail views with company context
5. **Apply Actions**: External links to company application pages

### API Endpoints
- `GET /api/companies` - List all companies with job counts
- `GET /api/companies/:id` - Get specific company with all jobs
- `GET /api/jobs` - List all jobs across companies
- `GET /api/jobs/:id` - Get specific job details
- `GET /api/search?q=query` - Search companies and jobs

## External Dependencies

### Frontend Dependencies
- **UI Library**: Radix UI components for accessibility
- **Styling**: Tailwind CSS for utility-first styling
- **Animations**: Framer Motion for smooth transitions
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: date-fns for date manipulation
- **Icons**: Lucide React for consistent iconography

### Backend Dependencies
- **Database**: Drizzle ORM with PostgreSQL dialect
- **Validation**: Zod for runtime type checking
- **Development**: tsx for TypeScript execution
- **Build**: esbuild for server bundling

### Development Tools
- **TypeScript**: Full type safety across the stack
- **Vite**: Fast development server and build tool
- **PostCSS**: CSS processing with Tailwind
- **ESLint**: Code linting and formatting

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite builds the React application to `dist/public`
2. **Backend Build**: esbuild bundles the Express server to `dist/index.js`
3. **Static Assets**: Frontend assets served by Express in production

### Environment Configuration
- **Development**: Uses tsx for hot reloading and Vite dev server
- **Production**: Serves built assets with Express static middleware
- **Database**: Requires `DATABASE_URL` environment variable for PostgreSQL connection

### Scripts
- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build both frontend and backend for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run db:migrate` - Load JSON data into PostgreSQL database

The application is designed to be easily deployable to platforms like Replit, Vercel, or similar hosting services that support Node.js applications with PostgreSQL databases.