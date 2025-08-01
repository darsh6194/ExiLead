import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/header"
import { FiltersBar } from "@/components/filters-bar"
import { JobCard } from "@/components/job-card"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { JobDetailModal } from "@/components/job-detail-modal"
import { useDebouncedSearch } from "@/hooks/use-debounced-search"
import type { Job, Company } from "@shared/schema"
import type { FilterState, ViewMode } from "@/lib/types"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function Jobs() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState<Job & { company?: Company } | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    skills: [],
  })

  const debouncedSearch = useDebouncedSearch(searchQuery)
  const pageSize = 24

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, filters])

  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ["/api/jobs", currentPage, pageSize, filters.category],
    queryFn: async () => {
      if (filters.category && filters.category !== "all") {
        const response = await fetch(`/api/categories/${encodeURIComponent(filters.category)}/jobs?page=${currentPage}&limit=${pageSize}`)
        if (!response.ok) throw new Error('Failed to fetch jobs by category')
        return response.json()
      } else {
        const response = await fetch(`/api/jobs?page=${currentPage}&limit=${pageSize}`)
        if (!response.ok) throw new Error('Failed to fetch jobs')
        return response.json()
      }
    },
    select: (data: { jobs: Job[], total: number, hasMore: boolean }) => data,
  })

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["/api/search", debouncedSearch],
    enabled: debouncedSearch.length > 0,
    select: (data: { companies: Company[], jobs: Job[] }) => data,
  })

  // Get companies for job company info
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    select: (data: Company[]) => data || [],
  })

  const getCompanyForJob = (companyId: number) => {
    return companies?.find(c => c.id === companyId)
  }

  const isLoadingJobs = useMemo(() => {
    if (debouncedSearch) {
      return isSearchLoading
    }
    return isLoading
  }, [debouncedSearch, isSearchLoading, isLoading])

  const jobsToDisplay = useMemo(() => {
    if (debouncedSearch && searchResults) {
      return searchResults.jobs
    }
    return jobsData?.jobs || []
  }, [debouncedSearch, searchResults, jobsData])

  const totalJobs = useMemo(() => {
    if (debouncedSearch && searchResults) {
      return searchResults.jobs.length
    }
    return jobsData?.total || 0
  }, [debouncedSearch, searchResults, jobsData])

  const hasMorePages = useMemo(() => {
    if (debouncedSearch) return false
    return jobsData?.hasMore || false
  }, [debouncedSearch, jobsData])

  const handleJobClick = (job: Job) => {
    const company = getCompanyForJob(job.companyId!)
    setSelectedJob({ ...job, company })
  }

  const handleApplyClick = (applyLink: string) => {
    if (applyLink) {
      window.open(applyLink, '_blank')
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (hasMorePages) {
      setCurrentPage(currentPage + 1)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-lg text-muted-foreground">
                Failed to load jobs. Please try again later.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <FiltersBar 
        filters={filters}
        onFiltersChange={setFilters}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Jobs Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-medium text-google-dark">
              Job Opportunities
            </h1>
            {debouncedSearch && isSearchLoading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            {debouncedSearch ? (
              isSearchLoading ? (
                `Searching for "${debouncedSearch}"...`
              ) : (
                `Found ${jobsToDisplay.length} jobs matching "${debouncedSearch}"`
              )
            ) : (
              `Showing ${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalJobs)} of ${totalJobs.toLocaleString()} jobs`
            )}
          </p>
        </div>

        {/* Jobs Grid */}
        {isLoadingJobs ? (
          <div className="space-y-6">
            <LoadingSkeleton count={pageSize} viewMode="list" />
            {debouncedSearch && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Searching for "{debouncedSearch}"...
                </p>
              </div>
            )}
          </div>
        ) : jobsToDisplay.length === 0 ? (
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-google-dark mb-2">
                No jobs found
              </h3>
              <p className="text-muted-foreground">
                {debouncedSearch 
                  ? `No jobs match your search "${debouncedSearch}". Try adjusting your search terms.`
                  : "No jobs available at the moment."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="transition-all duration-300 ease-in-out">
            <div className="space-y-6">
              {jobsToDisplay.map((job, index) => (
                <div 
                  key={job.applyLink || `job-${index}`}
                  className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <JobCard
                    job={job}
                    companyName={getCompanyForJob(job.companyId!)?.name}
                    onJobClick={() => handleJobClick(job)}
                    onApplyClick={handleApplyClick}
                    index={index}
                  />
                </div>
              ))}
            </div>

            {/* Pagination - only show for non-search results */}
            {!debouncedSearch && (currentPage > 1 || hasMorePages) && (
              <div className="flex justify-center items-center space-x-4 mt-12">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </Button>

                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Page {currentPage}</span>
                  {totalJobs > 0 && (
                    <span>of {Math.ceil(totalJobs / pageSize)}</span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!hasMorePages}
                  className="flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          isOpen={true}
          job={selectedJob}
          company={selectedJob.company}
          onClose={() => setSelectedJob(null)}
          onApply={handleApplyClick}
        />
      )}
    </div>
  )
}
