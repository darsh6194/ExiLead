import { useState, useEffect, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/header"
import { FiltersBar } from "@/components/filters-bar"
import { JobCard } from "@/components/job-card"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { JobDetailModal } from "@/components/job-detail-modal"
import type { Job, Company } from "@shared/schema"
import type { FilterState, ViewMode } from "@/lib/types"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function Jobs() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearchQuery, setActiveSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState<Job & { company?: Company } | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    skills: [],
  })

  const pageSize = 24

  // Optimized manual search - only triggers when user explicitly searches
  const handleSearch = useCallback(() => {
    setActiveSearchQuery(searchQuery.trim())
    setCurrentPage(1)
  }, [searchQuery])

  // Clear search functionality
  const handleClearSearch = useCallback(() => {
    setSearchQuery("")
    setActiveSearchQuery("")
    setCurrentPage(1)
  }, [])

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeSearchQuery, filters])

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
    staleTime: 5 * 60 * 1000, // 5 minutes - cache data for better performance
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    notifyOnChangeProps: ['data', 'isLoading'], // Only notify on essential changes
  })

  const { data: searchResults, isLoading: isSearchLoading, isFetching: isSearchFetching } = useQuery({
    queryKey: ["/api/search", activeSearchQuery],
    enabled: activeSearchQuery.length > 0, // Only search when there's an active search
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(activeSearchQuery)}`, {
        signal, // Enable request cancellation
      })
      if (!response.ok) throw new Error('Search failed')
      return response.json()
    },
    select: (data: { companies: Company[], jobs: Job[] }) => data,
    staleTime: 5 * 60 * 1000, // 5 minutes - longer cache for search results
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2, // Reduce retries
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    notifyOnChangeProps: ['data', 'isLoading'], // Only notify on data/loading changes
  })

  // Get companies for job company info
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    select: (data: Company[]) => data || [],
  })

  const getCompanyForJob = (companyId: number) => {
    return companies?.find(c => c.id === companyId)
  }

  // Optimized loading state that handles both search and regular loading
  const isLoadingJobs = useMemo(() => {
    if (activeSearchQuery.length > 0) {
      return isSearchLoading || isSearchFetching
    }
    return isLoading
  }, [activeSearchQuery, isSearchLoading, isSearchFetching, isLoading])

  const jobsToDisplay = useMemo(() => {
    if (activeSearchQuery && searchResults) {
      let jobs = searchResults.jobs || []
      // Apply category filter to search results
      if (filters.category && filters.category !== "all") {
        jobs = jobs.filter(job => 
          job.category && job.category.toLowerCase() === filters.category.toLowerCase()
        )
      }
      return jobs
    }
    return jobsData?.jobs || []
  }, [activeSearchQuery, searchResults, jobsData, filters.category])

  const totalJobs = useMemo(() => {
    if (activeSearchQuery && searchResults) {
      let jobs = searchResults.jobs || []
      // Apply category filter to search results for count
      if (filters.category && filters.category !== "all") {
        jobs = jobs.filter(job => 
          job.category && job.category.toLowerCase() === filters.category.toLowerCase()
        )
      }
      return jobs.length
    }
    return jobsData?.total || 0
  }, [activeSearchQuery, searchResults, jobsData, filters.category])

  const hasMorePages = useMemo(() => {
    if (activeSearchQuery) return false // No pagination for search results
    return jobsData?.hasMore || false
  }, [activeSearchQuery, jobsData])

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
          onSearch={handleSearch}
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
        onSearch={handleSearch}
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
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-medium text-google-dark">
              Job Opportunities
            </h1>
            {activeSearchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSearch}
                className="text-sm"
              >
                Clear Search
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">
            {activeSearchQuery ? (
              isSearchLoading || isSearchFetching ? 
                `Searching for "${activeSearchQuery}"...` :
                `Found ${jobsToDisplay.length} jobs matching "${activeSearchQuery}"`
            ) : (
              `Showing ${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalJobs)} of ${totalJobs.toLocaleString()} jobs`
            )}
          </p>
        </div>

        {/* Jobs Grid */}
        {isLoadingJobs ? (
          <LoadingSkeleton count={pageSize} viewMode="list" />
        ) : jobsToDisplay.length === 0 ? (
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-google-dark mb-2">
                No jobs found
              </h3>
              <p className="text-muted-foreground">
                {activeSearchQuery 
                  ? `No jobs match your search "${activeSearchQuery}". Try adjusting your search terms.`
                  : "No jobs available at the moment."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-6">
              {jobsToDisplay.map((job, index) => (
                <div
                  key={job.applyLink}
                  className="animate-fade-in"
                  style={{
                    animationDelay: `${Math.min(index * 25, 500)}ms`, // Reduced delay for faster loading
                    opacity: 0,
                    animationFillMode: 'forwards'
                  }}
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
            {!activeSearchQuery && (currentPage > 1 || hasMorePages) && (
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
          </>
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
