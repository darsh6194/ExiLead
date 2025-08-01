import React, { useState } from "react"
import { Link, useLocation } from "wouter"
import { Search, Grid3X3, List, Moon, Sun, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchBar } from "@/components/search-bar"
import { useTheme } from "@/hooks/use-theme"
import type { ViewMode } from "@/lib/types"

interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onSearch?: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function Header({ searchQuery, onSearchChange, onSearch, viewMode, onViewModeChange }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [location] = useLocation()

  const handleSearch = () => {
    onSearch?.()
  }

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  // Dynamic placeholder based on current page
  const getPlaceholder = () => {
    if (location === "/jobs") {
      return "Search Jobs..."
    }
    return "Search Companies..."
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-6 h-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                    fill="currentColor"
                    fillOpacity="0.9"
                  />
                  <path
                    d="M12 8V16M8 10V14M16 10V14"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ExiLead
              </h1>
            </Link>
            
            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"} 
                  size="sm"
                  className="text-sm font-normal"
                >
                  Companies
                </Button>
              </Link>
              <Link href="/jobs">
                <Button 
                  variant={location === "/jobs" ? "default" : "ghost"} 
                  size="sm"
                  className="text-sm font-normal"
                >
                  All Jobs
                </Button>
              </Link>
              <Link href="/scraper-status">
                <Button 
                  variant={location === "/scraper-status" ? "default" : "ghost"} 
                  size="sm"
                  className="text-sm font-normal"
                >
                  Status
                </Button>
              </Link>
              
            </nav>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-8 hidden md:block">
            <SearchBar
              placeholder={getPlaceholder()}
              value={searchQuery}
              onChange={onSearchChange}
              onSearch={handleSearch}
              manualSearch={true}
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="hidden md:flex bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("grid")}
                className="px-3"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("list")}
                className="px-3"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-3">
          <SearchBar
            placeholder={getPlaceholder()}
            value={searchQuery}
            onChange={onSearchChange}
            onSearch={handleSearch}
            manualSearch={true}
            className="w-full"
          />
        </div>
      </div>
    </header>
  )
}
