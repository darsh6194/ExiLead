import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FilterState } from "@/lib/types"
import { useQuery } from "@tanstack/react-query"

interface FiltersBarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

export function FiltersBar({ filters, onFiltersChange }: FiltersBarProps) {
  // Fetch categories from API
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch("/api/categories")
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      return response.json()
    },
  })

  // Filter out unwanted categories from the UI
  const excludedCategories = ["Education", "HR/Recruiting", "Human Resources", "Legal/Compliance", "Healthcare", "Sales", "Administrative"]
  const filteredCategories = categories.filter(category => !excludedCategories.includes(category))

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      category: "all",
      skills: [],
    })
  }

  const hasActiveFilters = (filters.category && filters.category !== "all") || 
                          filters.skills.length > 0

  return (
    <div className="bg-card border-b border-border sticky top-20 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Category Filter */}
          <Select value={filters.category} onValueChange={(value) => updateFilter("category", value)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {filteredCategories.map((category: string) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-google-blue">
              Clear All
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
