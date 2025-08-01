import React, { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useDebouncedSearch } from "@/hooks/use-debounced-search"

interface SearchBarProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  onSearch?: () => void
  className?: string
  showClearButton?: boolean
  minLength?: number
  manualSearch?: boolean
}

export function SearchBar({ 
  placeholder = "Search...", 
  value, 
  onChange, 
  onClear,
  onSearch,
  className = "",
  showClearButton = true,
  minLength = 1,
  manualSearch = false
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const debouncedValue = useDebouncedSearch(localValue, 300)

  useEffect(() => {
    // If in manual search mode, don't trigger automatic searches
    if (manualSearch) {
      return
    }
    
    // Otherwise, use automatic debounced search
    if (debouncedValue.length >= minLength || debouncedValue.length === 0) {
      onChange(debouncedValue)
    }
  }, [debouncedValue, onChange, minLength, manualSearch])

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleClear = () => {
    setLocalValue("")
    // In manual search mode, just call onChange and onClear directly
    if (manualSearch) {
      onChange("")
      onClear?.()
    } else {
      // In automatic mode, call onChange immediately
      onChange("")
      onClear?.()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && manualSearch) {
      onSearch?.()
    }
  }

  const handleSearchClick = () => {
    if (manualSearch) {
      onSearch?.()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    
    // In manual search mode, update parent immediately for input display
    if (manualSearch) {
      onChange(newValue)
    }
  }

  return (
    <div className={`relative ${className}`}>
      {manualSearch ? (
        // Manual search with clickable search icon
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSearchClick}
          className="absolute left-1 top-1/2 transform -translate-y-1/2 p-1 h-8 w-8 hover:bg-muted z-10"
        >
          <Search className="w-4 h-4 text-muted-foreground hover:text-primary" />
        </Button>
      ) : (
        // Regular search icon (non-clickable)
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      )}
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className={`${manualSearch ? 'pl-10 pr-10' : 'pl-10 pr-10'} rounded-lg border-input focus:border-primary focus:ring-primary`}
      />
      {showClearButton && localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-8 w-8 hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}

interface SearchResultsProps {
  query: string
  totalResults: number
  isSearching: boolean
  onClearSearch: () => void
  disabled?: boolean
}

export function SearchResults({ query, totalResults, isSearching, onClearSearch, disabled = false }: SearchResultsProps) {
  if (!query && !isSearching) return null

  return (
    <div className="flex items-center justify-between py-4 px-1">
      <div className="text-sm text-muted-foreground">
        {isSearching ? (
          "Searching..."
        ) : query ? (
          <>
            {totalResults === 0 ? "No results" : `${totalResults} result${totalResults !== 1 ? 's' : ''}`} 
            {" "}for <span className="font-medium text-foreground">"{query}"</span>
          </>
        ) : null}
      </div>
      {query && !isSearching && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSearch}
          disabled={disabled}
          className="text-xs"
        >
          Clear search
        </Button>
      )}
    </div>
  )
}
