import { useState, useRef, useEffect } from "react"
import { useParams, Link, useLocation } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ExternalLink, Briefcase, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { JobCard } from "@/components/job-card"
import { JobDetailModal } from "@/components/job-detail-modal"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { CompanyLogo } from "@/components/company-logo"
import { SearchBar, SearchResults } from "@/components/search-bar"
import { FiltersBar } from "@/components/filters-bar"
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination"
import type { CompanyWithJobs, Job } from "@shared/schema"
import type { FilterState } from "@/lib/types"

export default function CompanyDetail() {
  const { id } = useParams()
  const [, navigate] = useLocation()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Debug useEffect to track currentPage changes
  useEffect(() => {
    console.log('🔄 currentPage state changed to:', currentPage);
  }, [currentPage]);

  const [isClearing, setIsClearing] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const lastClearTime = useRef(0)
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    skills: [],
  })
  const jobsPerPage = 20

  // Fetch company info (header) only once
  const { data: company, isLoading: isCompanyLoading, error } = useQuery({
    queryKey: ["/api/companies", id, "info"],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/companies/${id}?page=1&limit=1`)
      if (!response.ok) {
        throw new Error('Failed to fetch company info')
      }
      return response.json()
    },
    select: (data: CompanyWithJobs) => ({
      id: data.id,
      name: data.name,
      industry: data.industry,
      website: data.website,
      description: data.description,
      logo: data.logo,
      jobCount: data.jobCount,
      createdAt: (data as any).createdAt ?? null,
    }),
  })

  // Fetch jobs/search results (reloads on search/filter/page)
  const { data: jobsData, isLoading: isJobsLoading, isFetching } = useQuery({
    queryKey: [
      "/api/companies", 
      id, 
      "jobs", 
      searchQuery.trim() || "none", // Use "none" instead of empty string to avoid instability
      currentPage, 
      jobsPerPage, 
      filters.category
    ],
    enabled: !!id,
    staleTime: 0, // Force refetch every time (for debugging)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: (previousData) => previousData, // Keep previous data during loading to prevent flicker
    queryFn: async () => {
      const isSearching = searchQuery.trim().length > 0;
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: jobsPerPage.toString(),
      });
      
      if (isSearching) {
        params.append("q", searchQuery.trim());
      }
      
      if (filters.category && filters.category !== "all") {
        params.append("category", filters.category);
      }
      
      // Always use the same endpoint pattern to avoid React Query cache conflicts
      const endpoint = `/api/companies/${id}${isSearching ? '/search' : ''}`;
      const response = await fetch(`${endpoint}?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to ${isSearching ? 'search' : 'fetch'} company jobs`)
      }
      return response.json()
    },
    select: (data: { jobs: Job[], total: number, hasMore: boolean, pagination?: { total: number, hasMore: boolean } }) => data,
  })

  const displayCompany = company;
  const displayJobs = jobsData?.jobs || [];
  const totalJobs = jobsData?.total || jobsData?.pagination?.total || 0;
  const hasMore = jobsData?.hasMore || jobsData?.pagination?.hasMore || false;
  const isCurrentlyLoading = isJobsLoading || isFetching || isTransitioning;

  // Calculate pagination info
  const totalPages = Math.ceil((totalJobs || 0) / jobsPerPage)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Debug pagination state
  console.log('🔍 Pagination Debug:', {
    currentPage,
    totalPages,
    totalJobs,
    jobsPerPage,
    hasNextPage,
    hasPrevPage,
    hasMore, // from API
    displayJobsCount: displayJobs?.length || 0,
    isLoading: isCurrentlyLoading,
    rawJobsData: jobsData, // Full API response
    queryKey: ["/api/companies", id, "jobs", searchQuery.trim() || "none", currentPage, jobsPerPage, filters.category]
  })

  // Reset to page 1 when search query changes
  const handleSearchChange = (query: string) => {
    console.log('Search query changed to:', query) // Debug log
    console.log('Previous search query was:', searchQuery) // Debug log
    
    // Only reset page if the search query actually changed
    if (query !== searchQuery) {
      setSearchQuery(query)
      if (currentPage !== 1) {
        console.log('🔄 Resetting page to 1 due to search change') // Debug log
        setCurrentPage(1)
      }
    }
  }

  // Clear search function
  const handleClearSearch = () => {
    console.log('Clear search called') // Debug log
    
    // Debounce: prevent multiple calls within 500ms
    const now = Date.now()
    if (now - lastClearTime.current < 500) {
      console.log('Clear search blocked - too frequent') // Debug log
      return
    }
    lastClearTime.current = now
    
    // Prevent multiple calls by checking if already clearing or if search is already empty
    if (isClearing || !searchQuery.trim()) {
      console.log('Clear search blocked - already clearing or empty') // Debug log
      return
    }
    
    console.log('Executing clear search') // Debug log
    
    // Set clearing and transitioning states
    setIsClearing(true)
    setIsTransitioning(true)
    
    // Clear search with smooth transition
    setTimeout(() => {
      setSearchQuery("")
      setCurrentPage(1)
      
      // Reset clearing state after a short delay
      setTimeout(() => {
        setIsClearing(false)
        setIsTransitioning(false)
      }, 400)
    }, 100)
  }  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const handlePageChange = (page: number) => {
    console.log(`🔥 handlePageChange called: from ${currentPage} to ${page}`) // Debug log
    console.log('🔍 hasNextPage:', hasNextPage, 'hasPrevPage:', hasPrevPage) // Debug log
    console.log('🔍 totalPages:', totalPages, 'totalJobs:', totalJobs) // Debug log
    console.log('Current search query before page change:', searchQuery) // Debug log
    setCurrentPage(page)
    // Don't clear search when changing pages - keep the search context
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setIsModalOpen(true)
  }

  const handleApplyClick = (applyLink: string) => {
    window.open(applyLink, "_blank", "noopener,noreferrer")
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedJob(null)
  }

  const handleMindmapClick = () => {
    if (displayCompany?.name) {
      navigate(`/mindmap?company=${encodeURIComponent(displayCompany.name)}`)
    }
  }

  if (isCompanyLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="h-6 w-32 bg-muted rounded animate-skeleton mb-8"></div>
          </div>
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex items-start space-x-6">
                <div className="w-20 h-20 bg-muted rounded-xl animate-skeleton"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-8 bg-muted rounded animate-skeleton w-64"></div>
                  <div className="h-5 bg-muted rounded animate-skeleton w-48"></div>
                  <div className="h-4 bg-muted rounded animate-skeleton w-full"></div>
                  <div className="flex space-x-6 pt-2">
                    <div className="h-4 bg-muted rounded animate-skeleton w-32"></div>
                    <div className="h-4 bg-muted rounded animate-skeleton w-40"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <LoadingSkeleton count={6} viewMode="list" />
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-destructive mb-2">Company Not Found</h2>
            <p className="text-google-gray mb-4">The company you're looking for doesn't exist or has been removed.</p>
            <Link href="/">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Companies
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="text-google-blue hover:text-google-blue-light">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Companies
            </Button>
          </Link>
        </div>

        {/* Company Header */}
        <Card className="mb-10 bg-card border border-border shadow-sm">
          <CardContent className="p-10">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-6 flex-1">
                <CompanyLogo 
                  companyName={displayCompany?.name || ""} 
                  size="xl" 
                  className="flex-shrink-0"
                />
                <div className="flex-1">
                  <h1 className="text-3xl font-normal text-google-dark">{displayCompany?.name}</h1>
                  <p className="text-google-gray text-lg mt-1">
                    {displayCompany?.industry || "Technology"} 
                    {displayCompany?.website && " • "}
                    {displayCompany?.website && (
                      <a 
                        href={displayCompany?.website || ""} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-google-blue hover:text-google-blue-light"
                      >
                        Visit Website
                        <ExternalLink className="w-4 h-4 ml-1 inline" />
                      </a>
                    )}
                  </p>
                  {displayCompany?.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {displayCompany.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-6 mt-4">
                    <span className="text-sm text-google-gray flex items-center">
                      <Briefcase className="w-4 h-4 mr-1" />
                      {totalJobs} open position{totalJobs !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Mindmap Button */}
              <div className="flex-shrink-0 ml-6">
                <Button
                  onClick={handleMindmapClick}
                  variant="outline"
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-purple-500 text-white border-purple-500 hover:from-purple-700 hover:to-purple-600 hover:border-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Jobs Mindmap
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-google-dark">
              Open Positions
              {totalPages > 1 && (
                <span className="text-sm font-normal text-google-gray ml-2">
                  (Page {currentPage} of {totalPages})
                </span>
              )}
            </h2>
            <p className="text-sm text-google-gray">
              {searchQuery 
                ? `${displayJobs?.length || 0} of ${totalJobs || 0} positions match "${searchQuery}"`
                : `Showing ${displayJobs?.length || 0} of ${totalJobs || 0} position${totalJobs !== 1 ? 's' : ''}`
              }
            </p>
          </div>

          {/* Search Bar for Jobs */}
            <SearchBar
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="flex-1"
            />          {/* Filters Bar */}
          <div className="sticky top-0 z-10 bg-background pb-4">
            <FiltersBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          </div>

          <SearchResults
            query={searchQuery}
            totalResults={jobsData?.total || 0}
            isSearching={isJobsLoading}
            disabled={isTransitioning}
            onClearSearch={() => {
              console.log('Clear search clicked from SearchResults') // Debug log
              // Add guard to prevent multiple calls
              if (searchQuery.trim() && !isTransitioning) {
                handleClearSearch()
              }
            }}
          />
          
          {/* Results Section - Butter Smooth Content Loading */}
          <div className="relative min-h-[400px]">
            {/* Smooth Loading Overlay */}
            {(isTransitioning || (isFetching && !isJobsLoading)) && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg transition-all duration-300">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-google-blue"></div>
                  <p className="text-sm text-google-gray">Loading results...</p>
                </div>
              </div>
            )}
            
            {/* Content with smooth transitions */}
            <div className={`transition-all duration-300 ${
              isTransitioning || (isFetching && !isJobsLoading) 
                ? 'opacity-30 scale-[0.99] blur-sm' 
                : 'opacity-100 scale-100 blur-0'
            }`}>
              {isJobsLoading && !jobsData ? (
                <LoadingSkeleton count={6} viewMode="list" />
              ) : !displayJobs || displayJobs.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-google-dark mb-2">
                    {searchQuery ? 'No Matching Positions' : 'No Open Positions'}
                  </h3>
                  <p className="text-google-gray">
                    {searchQuery 
                      ? `No positions match your search for "${searchQuery}". Try different keywords.`
                      : "This company doesn't have any open positions at the moment."
                    }
                  </p>
                  {searchQuery && (
                    <Button 
                      variant="outline" 
                      onClick={handleClearSearch}
                      className="mt-4"
                      disabled={isTransitioning}
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {displayJobs?.map((job: Job, index: number) => (
                    <div
                      key={job.applyLink}
                      className="transform transition-all duration-300"
                      style={{
                        transitionDelay: `${index * 50}ms`
                      }}
                    >
                      <JobCard
                        job={job}
                        onJobClick={() => handleJobClick(job)}
                        onApplyClick={handleApplyClick}
                        index={index}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => hasPrevPage && handlePageChange(currentPage - 1)}
                      className={!hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {/* Page Numbers */}
                  {(() => {
                    const pages = []
                    const showPages = 5 // Show 5 page numbers at most
                    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2))
                    let endPage = Math.min(totalPages, startPage + showPages - 1)
                    
                    // Adjust start page if we're near the end
                    if (endPage - startPage < showPages - 1) {
                      startPage = Math.max(1, endPage - showPages + 1)
                    }
                    
                    // First page + ellipsis
                    if (startPage > 1) {
                      pages.push(
                        <PaginationItem key={1}>
                          <PaginationLink 
                            onClick={() => handlePageChange(1)}
                            isActive={currentPage === 1}
                            className="cursor-pointer"
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                      )
                      if (startPage > 2) {
                        pages.push(
                          <PaginationItem key="start-ellipsis">
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                    }
                    
                    // Page numbers
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink 
                            onClick={() => handlePageChange(i)}
                            isActive={currentPage === i}
                            className="cursor-pointer"
                          >
                            {i}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    }
                    
                    // Ellipsis + last page
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pages.push(
                          <PaginationItem key="end-ellipsis">
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                      pages.push(
                        <PaginationItem key={totalPages}>
                          <PaginationLink 
                            onClick={() => handlePageChange(totalPages)}
                            isActive={currentPage === totalPages}
                            className="cursor-pointer"
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    }
                    
                    return pages
                  })()}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => {
                        console.log('🚀 Next button clicked!', { hasNextPage, currentPage, totalPages });
                        console.log('🔍 About to call handlePageChange with:', currentPage + 1);
                        handlePageChange(currentPage + 1);
                      }}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        {/* Job Detail Modal */}
        <JobDetailModal
          job={selectedJob}
          company={company}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onApply={handleApplyClick}
        />
      </div>
    </div>
  )
}
