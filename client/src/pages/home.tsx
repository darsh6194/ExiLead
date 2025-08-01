import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation } from "wouter"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { CompanyCard } from "@/components/company-card"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { useDebouncedSearch } from "@/hooks/use-debounced-search"
import type { Company } from "@shared/schema"
import type { ViewMode, SortOption } from "@/lib/types"

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortBy, setSortBy] = useState<SortOption>("jobCount")
  const [, navigate] = useLocation()

  const debouncedSearch = useDebouncedSearch(searchQuery)

  const { data: companies, isLoading, error } = useQuery({
    queryKey: ["/api/companies"],
    select: (data: Company[]) => data || [],
  })

  const { data: searchResults } = useQuery({
    queryKey: ["/api/search", debouncedSearch],
    enabled: debouncedSearch.length > 0, // Search starts from 1 character
    queryFn: async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}`)
      if (!response.ok) throw new Error('Search failed')
      return response.json()
    },
    select: (data: { companies: Company[], jobs: any[] }) => data,
  })

  const filteredAndSortedCompanies = useMemo(() => {
    let result = companies || []

    // Use search results if searching
    if (debouncedSearch && searchResults) {
      result = searchResults.companies
    }

    // Apply filters (if we had more detailed company data, we would filter here)
    // For now, we'll just return the companies as-is

    // Sort companies
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "jobCount":
          return (b.jobCount || 0) - (a.jobCount || 0)
        case "name":
          return a.name.localeCompare(b.name)
        case "recent":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        default:
          return 0
      }
    })

    return result
  }, [companies, searchResults, debouncedSearch, sortBy])

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
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Companies</h2>
            <p className="text-google-gray">Please try again later or contact support if the problem persists.</p>
          </div>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-medium text-google-dark">Companies Hiring</h2>
            <p className="text-google-gray mt-1">
              {isLoading ? "Loading..." : `${filteredAndSortedCompanies.length} companies with open positions`}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-google-gray">Sort by:</span>
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jobCount">Most Jobs</SelectItem>
                <SelectItem value="recent">Recently Posted</SelectItem>
                <SelectItem value="name">Company Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Companies Grid/List */}
        {isLoading ? (
          <LoadingSkeleton count={8} viewMode={viewMode} />
        ) : filteredAndSortedCompanies.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-google-dark mb-2">No Companies Found</h3>
            <p className="text-google-gray">
              {debouncedSearch ? 
                `No companies match your search for "${debouncedSearch}"` : 
                "No companies are currently available"
              }
            </p>
          </div>
        ) : (
          <>
            <div className={
              viewMode === "grid" 
                ? "grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "space-y-6"
            }>
              {filteredAndSortedCompanies.map((company, index) => (
                <Link key={company.id} href={`/company/${company.id}`}>
                  <CompanyCard
                    company={company}
                    onClick={() => {}}
                    viewMode={viewMode}
                    index={index}
                  />
                </Link>
              ))}
            </div>

            {/* Load More Button - hidden until pagination is implemented */}
            {false && (
              <div className="text-center mt-8">
                <Button variant="outline" className="border-google-blue text-google-blue hover:bg-google-blue hover:text-white">
                  Load More Companies
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
