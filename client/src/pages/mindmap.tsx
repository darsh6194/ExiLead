import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Building2, Users, Briefcase, ExternalLink, Loader2, RefreshCw, AlertCircle, ArrowLeft, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Company, Job } from '@shared/schema'
import Home from './home'
interface MindMapNode {
  id: string
  type: 'root' | 'company' | 'employment' | 'category' | 'job'
  title: string
  subtitle?: string
  x: number
  y: number
  level: number
  children?: string[]
  expanded?: boolean
  parentId?: string
  data?: any
}

interface JobStats {
  total_companies: number
  total_jobs: number
}

export function MindMapPage() {
  console.log('MindMapPage rendered') // Debug log
  
  const [nodes, setNodes] = useState<MindMapNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isAutoFitting, setIsAutoFitting] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null) // Track selected company for mindmap
  const [jobPagination, setJobPagination] = useState<Record<string, number>>({}) // Track current page for each category
  const [pendingCategoryRefresh, setPendingCategoryRefresh] = useState<{
    categoryKey: string
    companyName: string
    employmentType: string
    categoryName: string
  } | null>(null) // Track pending category refresh after pagination
  const containerRef = useRef<HTMLDivElement>(null)

  // Get company from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const companyParam = urlParams.get('company')
    console.log('Company parameter from URL:', companyParam) // Debug log
    if (companyParam) {
      setSelectedCompany(decodeURIComponent(companyParam))
    }
  }, [])

  // Fetch companies data
  const { data: companiesData, isLoading: companiesLoading, error: companiesError } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const response = await fetch('/api/companies')
      if (!response.ok) throw new Error('Failed to fetch companies')
      return response.json()
    }
  })

  // Fetch all jobs with multi-page support to avoid 400 error
  const fetchAllJobs = async () => {
    let allJobs: Job[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await fetch(`/api/jobs?page=${page}&limit=100`)
      if (!response.ok) throw new Error('Failed to fetch jobs')
      
      const data = await response.json()
      allJobs = [...allJobs, ...data.jobs]
      
      hasMore = data.hasMore
      page++
    }

    return { jobs: allJobs }
  }

  const { data: allJobsData, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: fetchAllJobs
  })

  const companies: Company[] = companiesData || []
  const jobs: Job[] = allJobsData?.jobs || []

  // Initialize with root node and load stats - Only for company-specific mindmaps
  useEffect(() => {
    if (companies.length > 0 && jobs.length > 0) {
      if (selectedCompany) {
        // Initialize with specific company as root
        const company = companies.find(c => c.name === selectedCompany)
        if (company) {
          const companyJobs = jobs.filter(job => job.companyId === company.id)
          const rootNode: MindMapNode = {
            id: `company-${company.name}`,
            type: 'company',
            title: company.name,
            subtitle: `${companyJobs.length} jobs`,
            x: 300,
            y: 300,
            level: 0,
            children: [],
            expanded: true,
            data: { companyName: company.name }
          }
          
          // Get employment types for auto-expansion
          const employmentTypes = getEmploymentTypesForCompany(company.name)
          const empTypeSpacing = Math.max(120, Math.min(150, 800 / employmentTypes.length))
          
          // Create employment type nodes
          const employmentNodes: MindMapNode[] = employmentTypes.map((empType, empIndex) => ({
            id: `employment-${company.name}-${empType.name}`,
            type: 'employment' as const,
            title: empType.name,
            subtitle: `${empType.jobCount} jobs`,
            x: 680, // rootNode.x + 380
            y: 300 + (empIndex - employmentTypes.length/2) * empTypeSpacing,
            level: 1,
            parentId: rootNode.id,
            expanded: true,
            children: [], // Initialize empty, will be populated below
            data: { 
              companyName: company.name,
              employmentType: empType.name 
            }
          }))
          
          // Create category nodes only for Full-time employment type (auto-expanded)
          let allCategoryNodes: MindMapNode[] = []
          employmentNodes.forEach((empNode) => {
            // Only auto-expand Full-time employment type
            if (empNode.data.employmentType === 'Full-time') {
              const categories = getCategoriesForEmploymentType(company.name, empNode.data.employmentType)
              const categorySpacing = Math.max(100, Math.min(120, 600 / Math.max(categories.length, 1)))
              
              const categoryNodes = categories.map((category, catIndex) => ({
                id: `category-${company.name}-${empNode.data.employmentType}-${category.name}`,
                type: 'category' as const,
                title: category.name,
                subtitle: `${category.jobCount} jobs`,
                x: 1060, // empNode.x + 380
                y: empNode.y + (catIndex - categories.length/2) * categorySpacing,
                level: 2,
                parentId: empNode.id,
                data: { 
                  companyName: company.name,
                  employmentType: empNode.data.employmentType,
                  categoryName: category.name 
                }
              }))
              
              // Update employment node children only for Full-time
              empNode.children = categoryNodes.map(node => node.id)
              allCategoryNodes = [...allCategoryNodes, ...categoryNodes]
            }
          })
          
          // Update root node children
          rootNode.children = employmentNodes.map(node => node.id)
          
          // Set all nodes (root + employment types + categories)
          setNodes([rootNode, ...employmentNodes, ...allCategoryNodes])
          
          // Calculate stats for this company only
          setStats({
            total_companies: 1,
            total_jobs: companyJobs.length
          })
        }
      }
      // Remove the general mindmap - only company-specific mindmaps are allowed
    }
  }, [companies.length, jobs.length, selectedCompany]) // Add selectedCompany to dependencies

  // Auto-fit function to scale and center the tree or specific nodes
  const autoFitTree = useCallback((targetNodes?: MindMapNode[]) => {
    if (isAutoFitting) return // Prevent conflicting auto-fits
    
    const nodesToFit = targetNodes || nodes
    if (nodesToFit.length === 0) return

    setIsAutoFitting(true)
    
    const padding = 100
    const minX = Math.min(...nodesToFit.map(n => n.x)) - padding
    const maxX = Math.max(...nodesToFit.map(n => n.x)) + padding + 320 // Account for node width
    const minY = Math.min(...nodesToFit.map(n => n.y)) - padding
    const maxY = Math.max(...nodesToFit.map(n => n.y)) + padding

    const treeWidth = maxX - minX
    const treeHeight = maxY - minY

    const containerWidth = containerRef.current?.clientWidth || 1200
    const containerHeight = (containerRef.current?.clientHeight || 800) - 100 // Account for header

    const scaleX = containerWidth / treeWidth
    const scaleY = containerHeight / treeHeight
    const newZoom = Math.min(scaleX, scaleY, 1.5) // Allow slight zoom in for better focus

    const centerX = (containerWidth / 2) - (treeWidth * newZoom / 2) - (minX * newZoom)
    const centerY = ((containerHeight + 100) / 2) - (treeHeight * newZoom / 2) - (minY * newZoom)

    setZoom(newZoom)
    setPan({ x: centerX, y: centerY })
    
    // Reset auto-fitting flag after animation completes
    setTimeout(() => setIsAutoFitting(false), 300)
  }, [nodes, isAutoFitting])

  // Button handler for fitting all nodes
  const handleFitAll = () => autoFitTree()

  // Auto-fit when nodes change significantly (only for initial load)
  useEffect(() => {
    if (nodes.length > 1 && selectedCompany && !isAutoFitting) { 
      // Auto-fit on initial company mindmap load (when employment types are shown)
      const timer = setTimeout(autoFitTree, 100)
      return () => clearTimeout(timer)
    }
  }, [nodes.length]) // Remove isAutoFitting from dependencies to prevent loops

  // Handle category refresh when pagination changes
  useEffect(() => {
    if (pendingCategoryRefresh) {
      const { companyName, employmentType, categoryName } = pendingCategoryRefresh
      const categoryNodeId = `category-${companyName}-${employmentType}-${categoryName}`
      
      console.log('Refreshing category after pagination change:', categoryNodeId)
      
      setTimeout(() => {
        handleNodeClick(categoryNodeId, 'category', {
          companyName,
          employmentType,
          categoryName
        })
        setPendingCategoryRefresh(null) // Clear the pending refresh
      }, 50)
    }
  }, [jobPagination, pendingCategoryRefresh])

  // Mouse wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(3, zoom * delta))
    
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      // Zoom towards mouse position with smooth calculation
      const zoomFactor = newZoom / zoom
      const newPan = {
        x: mouseX - (mouseX - pan.x) * zoomFactor,
        y: mouseY - (mouseY - pan.y) * zoomFactor
      }
      setPan(newPan)
    }
    
    setZoom(newZoom)
  }

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      const newPan = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }
      setPan(newPan)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  // Zoom controls
  const zoomIn = () => {
    const newZoom = Math.min(3, zoom * 1.2)
    setZoom(newZoom)
  }
  
  const zoomOut = () => {
    const newZoom = Math.max(0.1, zoom * 0.8)
    setZoom(newZoom)
  }
  
  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Function to create company-specific mindmap
  const createCompanyMindmap = (companyName: string) => {
    setSelectedCompany(companyName)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedPath([])
  }

  // Function to go back to all companies view
  const backToAllCompanies = () => {
    setSelectedCompany(null)
    setJobPagination({}) // Reset pagination when switching companies
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedPath([])
    // Clear URL parameter
    const url = new URL(window.location.href)
    url.searchParams.delete('company')
    window.history.replaceState({}, '', url.toString())
  }

  const getCompaniesFromData = () => {
    // Group jobs by company
    const companyCounts = jobs.reduce((acc, job) => {
      const company = companies.find(c => c.id === job.companyId)
      if (company) {
        acc[company.name] = (acc[company.name] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    return companies.map(company => ({
      name: company.name,
      jobCount: companyCounts[company.name] || 0
    }))
  }

  // Helper function to normalize employment types
  const normalizeEmploymentType = (type: string | null | undefined): string => {
    if (!type) return 'Full-time'
    
    const normalized = type.toLowerCase().trim()
    
    // Normalize variations of full-time
    if (normalized.includes('full') && normalized.includes('time')) {
      return 'Full-time'
    }
    
    // Normalize variations of part-time
    if (normalized.includes('part') && normalized.includes('time')) {
      return 'Part-time'
    }
    
    // Normalize variations of contract
    if (normalized.includes('contract') || normalized.includes('contractor')) {
      return 'Contract'
    }
    
    // Normalize variations of internship
    if (normalized.includes('intern')) {
      return 'Internship'
    }
    
    // Normalize variations of temporary
    if (normalized.includes('temp') || normalized.includes('temporary')) {
      return 'Temporary'
    }
    
    // Normalize variations of permanent
    if (normalized.includes('permanent')) {
      return 'Full-time, Permanent'
    }
    
    // Default to the original if no match found, but capitalize properly
    return type.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const getEmploymentTypesForCompany = (companyName: string) => {
    const company = companies.find(c => c.name === companyName)
    if (!company) return []

    const companyJobs = jobs.filter(job => job.companyId === company.id)
    
    // Debug: Log raw employment types before normalization
    const rawTypes = companyJobs.map(job => job.employmentType)
    console.log('Raw employment types for', companyName, ':', Array.from(new Set(rawTypes)))
    
    // Group by employment type first with normalization
    const employmentTypes = companyJobs.reduce((acc, job) => {
      const type = normalizeEmploymentType(job.employmentType)
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(job)
      return acc
    }, {} as Record<string, Job[]>)

    const result = Object.entries(employmentTypes).map(([name, jobs]) => ({
      name,
      jobCount: jobs.length
    }))
    
    console.log('Normalized employment types for', companyName, ':', result)
    return result
  }

  const getAllCategoriesForCompany = (companyName: string) => {
    const company = companies.find(c => c.name === companyName)
    if (!company) return []

    const companyJobs = jobs.filter(job => job.companyId === company.id)
    
    // Group by job categories/departments across all employment types
    const categories = companyJobs.reduce((acc, job) => {
      // Extract category from job title or use a simple categorization
      let category = 'General'
      
      const title = job.title.toLowerCase()
      if (title.includes('engineer') || title.includes('developer') || title.includes('software')) {
        category = 'Engineering'
      } else if (title.includes('manager') || title.includes('lead') || title.includes('director')) {
        category = 'Management'
      } else if (title.includes('design') || title.includes('ui') || title.includes('ux')) {
        category = 'Design'
      } else if (title.includes('sales') || title.includes('account')) {
        category = 'Sales'
      } else if (title.includes('marketing') || title.includes('growth')) {
        category = 'Marketing'
      } else if (title.includes('hr') || title.includes('people') || title.includes('talent')) {
        category = 'Human Resources'
      } else if (title.includes('finance') || title.includes('accounting')) {
        category = 'Finance'
      } else if (title.includes('data') || title.includes('analyst') || title.includes('scientist')) {
        category = 'Data & Analytics'
      } else if (title.includes('product')) {
        category = 'Product'
      } else if (title.includes('support') || title.includes('customer')) {
        category = 'Customer Support'
      }
      
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(job)
      return acc
    }, {} as Record<string, Job[]>)

    return Object.entries(categories).map(([name, jobs]) => ({
      name,
      jobCount: jobs.length
    }))
  }

  const getCategoriesForEmploymentType = (companyName: string, employmentType: string) => {
    const company = companies.find(c => c.name === companyName)
    if (!company) return []

    const companyJobs = jobs.filter(job => 
      job.companyId === company.id && 
      normalizeEmploymentType(job.employmentType) === employmentType
    )
    
    // Group by job categories/departments
    const categories = companyJobs.reduce((acc, job) => {
      // Extract category from job title or use a simple categorization
      let category = 'General'
      
      const title = job.title.toLowerCase()
      if (title.includes('engineer') || title.includes('developer') || title.includes('software')) {
        category = 'Engineering'
      } else if (title.includes('manager') || title.includes('lead') || title.includes('director')) {
        category = 'Management'
      } else if (title.includes('design') || title.includes('ui') || title.includes('ux')) {
        category = 'Design'
      } else if (title.includes('sales') || title.includes('account')) {
        category = 'Sales'
      } else if (title.includes('marketing') || title.includes('growth')) {
        category = 'Marketing'
      } else if (title.includes('hr') || title.includes('people') || title.includes('talent')) {
        category = 'Human Resources'
      } else if (title.includes('finance') || title.includes('accounting')) {
        category = 'Finance'
      } else if (title.includes('data') || title.includes('analyst') || title.includes('scientist')) {
        category = 'Data & Analytics'
      } else if (title.includes('product')) {
        category = 'Product'
      } else if (title.includes('support') || title.includes('customer')) {
        category = 'Customer Support'
      }
      
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(job)
      return acc
    }, {} as Record<string, Job[]>)

    return Object.entries(categories).map(([name, jobs]) => ({
      name,
      jobCount: jobs.length
    }))
  }

  const getJobsForCategory = (companyName: string, employmentType: string, categoryName: string) => {
    const company = companies.find(c => c.name === companyName)
    if (!company) return []

    // If employmentType is 'all', get jobs from all employment types
    const jobsToFilter = jobs.filter(job => {
      if (job.companyId !== company.id) return false
      if (employmentType !== 'all' && normalizeEmploymentType(job.employmentType) !== employmentType) return false
      return true
    })

    return jobsToFilter.filter(job => {
      // Apply same categorization logic
      const title = job.title.toLowerCase()
      let jobCategory = 'General'
      
      if (title.includes('engineer') || title.includes('developer') || title.includes('software')) {
        jobCategory = 'Engineering'
      } else if (title.includes('manager') || title.includes('lead') || title.includes('director')) {
        jobCategory = 'Management'
      } else if (title.includes('design') || title.includes('ui') || title.includes('ux')) {
        jobCategory = 'Design'
      } else if (title.includes('sales') || title.includes('account')) {
        jobCategory = 'Sales'
      } else if (title.includes('marketing') || title.includes('growth')) {
        jobCategory = 'Marketing'
      } else if (title.includes('hr') || title.includes('people') || title.includes('talent')) {
        jobCategory = 'Human Resources'
      } else if (title.includes('finance') || title.includes('accounting')) {
        jobCategory = 'Finance'
      } else if (title.includes('data') || title.includes('analyst') || title.includes('scientist')) {
        jobCategory = 'Data & Analytics'
      } else if (title.includes('product')) {
        jobCategory = 'Product'
      } else if (title.includes('support') || title.includes('customer')) {
        jobCategory = 'Customer Support'
      }
      
      return jobCategory === categoryName
    })
  }

  const handleNodeClick = async (nodeId: string, nodeType: string, nodeData?: any) => {
    let newNodes = [...nodes]
    const clickedNode = newNodes.find(n => n.id === nodeId)
    
    if (!clickedNode) return
    
    // Remove any children of this node and all subsequent levels
    const clickedLevel = clickedNode.level
    newNodes = newNodes.filter(n => n.level <= clickedLevel)
    
    // Reset pagination for this specific category when clicking on it fresh
    if (nodeType === 'category') {
      const categoryKey = `${nodeData.companyName}-${nodeData.employmentType}-${nodeData.categoryName}`
      if (!jobPagination[categoryKey]) {
        setJobPagination(prev => ({
          ...prev,
          [categoryKey]: 0
        }))
      }
    }
    
    let childNodes: MindMapNode[] = []
    const baseY = clickedNode.y
    const nextX = clickedNode.x + 380 // Slightly more spacing
    
    // Only handle company-specific mindmap nodes - removed 'root' case
    if (nodeType === 'company') {
      // Show employment types for this company
      const employmentTypes = getEmploymentTypesForCompany(nodeData.companyName)
      const cardHeight = 80
      const minSpacing = cardHeight + 20
      const spacing = Math.max(minSpacing, Math.min(110, 700 / employmentTypes.length))
      
      childNodes = employmentTypes.map((empType, index) => ({
        id: `employment-${nodeData.companyName}-${empType.name}`,
        type: 'employment' as const,
        title: empType.name,
        subtitle: `${empType.jobCount} jobs`,
        x: nextX,
        y: baseY + (index - employmentTypes.length/2) * spacing,
        level: clickedLevel + 1,
        parentId: nodeId, // Make sure this is the clicked node's ID
        data: { 
          companyName: nodeData.companyName,
          employmentType: empType.name 
        }
      }))
      
    } else if (nodeType === 'employment') {
      // Show categories for this employment type
      const categories = getCategoriesForEmploymentType(nodeData.companyName, nodeData.employmentType)
      const cardHeight = 80
      const minSpacing = cardHeight + 20
      const spacing = Math.max(minSpacing, Math.min(105, 650 / categories.length))
      
      childNodes = categories.map((category, index) => ({
        id: `category-${nodeData.companyName}-${nodeData.employmentType}-${category.name}`,
        type: 'category' as const,
        title: category.name,
        subtitle: `${category.jobCount} jobs`,
        x: nextX,
        y: baseY + (index - categories.length/2) * spacing,
        level: clickedLevel + 1,
        parentId: nodeId, // Make sure this is the clicked node's ID
        data: { 
          companyName: nodeData.companyName,
          employmentType: nodeData.employmentType,
          categoryName: category.name 
        }
      }))
      
    } else if (nodeType === 'category') {
      // Show job titles for this category with pagination support
      const categoryJobs = getJobsForCategory(nodeData.companyName, nodeData.employmentType, nodeData.categoryName)
      const categoryKey = `${nodeData.companyName}-${nodeData.employmentType}-${nodeData.categoryName}`
      const currentPage = jobPagination[categoryKey] || 0
      const jobsPerPage = 12 // Jobs per page
      
      console.log('Category expansion:', { categoryKey, currentPage, totalJobs: categoryJobs.length, jobPagination }) // Debug log
      
      const startIndex = currentPage * jobsPerPage
      const endIndex = startIndex + jobsPerPage
      const jobsToShow = categoryJobs.slice(startIndex, endIndex)
      
      console.log('Jobs to show:', { startIndex, endIndex, jobsToShowCount: jobsToShow.length }) // Debug log
      
      // Calculate proper spacing based on card height (80px) + margin
      const cardHeight = 80
      const minSpacing = cardHeight + 20 // Card height + margin
      const spacing = Math.max(minSpacing, Math.min(120, 800 / jobsToShow.length))
      
      childNodes = jobsToShow.map((job, index) => ({
        id: `job-${nodeData.companyName}-${nodeData.employmentType}-${nodeData.categoryName}-${currentPage}-${index}`,
        type: 'job' as const,
        title: job.title,
        subtitle: job.location || 'Remote',
        x: nextX,
        y: baseY + (index - jobsToShow.length/2) * spacing,
        level: clickedLevel + 1,
        parentId: nodeId,
        data: { 
          companyName: nodeData.companyName,
          employmentType: nodeData.employmentType,
          categoryName: nodeData.categoryName,
          job: job
        }
      }))
      
      // Add pagination controls if there are more jobs
      const hasNextPage = endIndex < categoryJobs.length
      const hasPrevPage = currentPage > 0
      
      if (hasNextPage || hasPrevPage) {
        const paginationY = baseY + (jobsToShow.length/2) * spacing + spacing * 1.5
        
        // Previous page button
        if (hasPrevPage) {
          childNodes.push({
            id: `prev-jobs-${categoryKey}-${currentPage}`,
            type: 'job' as const,
            title: `← Previous ${jobsPerPage} jobs`,
            subtitle: `Page ${currentPage}`,
            x: nextX,
            y: paginationY - spacing * 0.7,
            level: clickedLevel + 1,
            parentId: nodeId,
            data: { 
              companyName: nodeData.companyName,
              employmentType: nodeData.employmentType,
              categoryName: nodeData.categoryName,
              isPaginationControl: true,
              action: 'prev',
              categoryKey
            }
          })
        }
        
        // Next page button
        if (hasNextPage) {
          const remainingJobs = categoryJobs.length - endIndex
          childNodes.push({
            id: `next-jobs-${categoryKey}-${currentPage}`,
            type: 'job' as const,
            title: `Next ${Math.min(jobsPerPage, remainingJobs)} jobs →`,
            subtitle: `Page ${currentPage + 2} of ${Math.ceil(categoryJobs.length / jobsPerPage)}`,
            x: nextX,
            y: paginationY + (hasPrevPage ? spacing * 0.7 : 0),
            level: clickedLevel + 1,
            parentId: nodeId,
            data: { 
              companyName: nodeData.companyName,
              employmentType: nodeData.employmentType,
              categoryName: nodeData.categoryName,
              isPaginationControl: true,
              action: 'next',
              categoryKey
            }
          })
        }
        
        // Page info
        childNodes.push({
          id: `page-info-${categoryKey}-${currentPage}`,
          type: 'job' as const,
          title: `Page ${currentPage + 1} of ${Math.ceil(categoryJobs.length / jobsPerPage)}`,
          subtitle: `Showing ${startIndex + 1}-${Math.min(endIndex, categoryJobs.length)} of ${categoryJobs.length} jobs`,
          x: nextX,
          y: paginationY + spacing * 1.4,
          level: clickedLevel + 1,
          parentId: nodeId,
          data: { 
            companyName: nodeData.companyName,
            employmentType: nodeData.employmentType,
            categoryName: nodeData.categoryName,
            isPageInfo: true
          }
        })
      }
    }
    
    // Update the clicked node to mark it as expanded
    const updatedClickedNode = newNodes.find(n => n.id === nodeId)
    if (updatedClickedNode) {
      updatedClickedNode.expanded = true
      updatedClickedNode.children = childNodes.map(child => child.id)
    }
    
    // Add new child nodes to the existing nodes array
    const updatedNodes = [...newNodes, ...childNodes]
    setNodes(updatedNodes)
    
    // Update selected path
    const pathToNode: string[] = []
    let currentNode: MindMapNode | undefined = updatedClickedNode
    while (currentNode) {
      pathToNode.unshift(currentNode.id)
      currentNode = updatedNodes.find(n => n.id === currentNode?.parentId)
    }
    setSelectedPath(pathToNode)
    
    // Log the nodes for debugging
    console.log('Updated nodes after click:', updatedNodes.map(n => ({ 
      id: n.id, 
      parentId: n.parentId, 
      level: n.level,
      x: n.x,
      y: n.y 
    })))
    
    // Auto-fit to the clicked node and its new children for better focus
    if (childNodes.length > 0) {
      setTimeout(() => {
        const nodesToFit = [updatedClickedNode!, ...childNodes]
        autoFitTree(nodesToFit)
      }, 100) // Slightly longer delay to ensure DOM is fully updated
    }
  }

  const handleJobClick = (job: Job | null, nodeData?: any) => {
    console.log('handleJobClick called with:', { job: job?.title || 'null', nodeData }) // Debug log
    
    if (nodeData?.isPaginationControl) {
      console.log('Handling pagination control:', nodeData.action, 'for category:', nodeData.categoryKey) // Debug log
      
      // Handle pagination navigation
      const { categoryKey, action } = nodeData
      const currentPage = jobPagination[categoryKey] || 0
      
      let newPage = currentPage
      if (action === 'next') {
        newPage = currentPage + 1
      } else if (action === 'prev') {
        newPage = Math.max(0, currentPage - 1)
      }
      
      console.log('Pagination update:', { categoryKey, currentPage, newPage }) // Debug log
      
      // Update pagination state
      setJobPagination(prev => {
        const newPagination = {
          ...prev,
          [categoryKey]: newPage
        }
        console.log('New pagination state:', newPagination) // Debug log
        return newPagination
      })
      
      // Schedule category refresh after state update
      setPendingCategoryRefresh({
        categoryKey,
        companyName: nodeData.companyName,
        employmentType: nodeData.employmentType,
        categoryName: nodeData.categoryName
      })
      
      return
    }
    
    if (nodeData?.isPageInfo) {
      // Page info is not clickable
      return
    }
    
    if (nodeData?.isMoreIndicator) {
      // Legacy "show more" functionality - should not be used anymore
      return
    }
    
    if (job && job.applyLink && job.applyLink !== '#') {
      window.open(job.applyLink, '_blank')
    }
  }

  const getNodeIcon = (type: string, nodeData?: any) => {
    if (nodeData?.isPaginationControl) {
      return nodeData.action === 'next' ? 
        <ChevronRight className="w-4 h-4" /> : 
        <ChevronRight className="w-4 h-4 rotate-180" />
    }
    if (nodeData?.isPageInfo) {
      return <Users className="w-4 h-4" />
    }
    
    switch (type) {
      case 'root': return <Briefcase className="w-5 h-5" />
      case 'company': return <Building2 className="w-5 h-5" />
      case 'employment': return <Users className="w-5 h-5" />
      case 'category': return <Users className="w-5 h-5" />
      case 'job': return <ExternalLink className="w-4 h-4" />
      default: return null
    }
  }

  const getNodeColor = (type: string, nodeData?: any) => {
    if (nodeData?.isPaginationControl) {
      return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:from-orange-700 hover:to-orange-600'
    }
    if (nodeData?.isPageInfo) {
      return 'bg-gradient-to-r from-slate-600 to-slate-500 text-white'
    }
    
    const colors = {
      root: 'bg-gradient-to-r from-slate-900 to-slate-700 text-white',
      company: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white',
      employment: 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white',
      category: 'bg-gradient-to-r from-green-600 to-green-500 text-white',
      job: 'bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-200'
  }

  const renderConnections = () => {
    const connectionsToRender = nodes.filter(node => node.parentId && node.parentId !== '')
    console.log('Rendering connections for nodes:', connectionsToRender.map(n => ({ id: n.id, parentId: n.parentId, x: n.x, y: n.y })))
    
    return connectionsToRender.map(childNode => {
        const parentNode = nodes.find(n => n.id === childNode.parentId)
        if (!parentNode) {
          console.warn(`Parent node not found for child: ${childNode.id}, parentId: ${childNode.parentId}`)
          return null
        }
        
        // Calculate connection points from center-right of parent to center-left of child
        // The nodes are positioned with their center at the y coordinate due to CSS transform
        // Node cards are 300px wide (min-w-[280px] max-w-[320px] average ~300px)
        const nodeWidth = 300
        const startX = parentNode.x + nodeWidth -20     // Right edge of parent node
        const startY = parentNode.y + 30             // Slightly below center of parent node
        const endX = childNode.x                     // Left edge of child node
        const endY = childNode.y +20                    // Child node's vertical center
        
        console.log(`Connection ${parentNode.id} -> ${childNode.id}:`, { startX, startY, endX, endY })
        
        // Create curved path with smooth Bézier curve from center to center
        const deltaX = endX - startX
        const deltaY = endY - startY
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
        
        // Adjust control points based on distance and direction for natural curves
        const controlOffset = Math.max(distance * 0.3, 80) // More responsive to distance
        const controlX1 = startX + controlOffset
        const controlX2 = endX - controlOffset
        
        const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`
        
        return (
          <path
            key={`connection-${childNode.id}`}
            d={pathData}
            stroke="#6b7280"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
            className="pointer-events-none"
            style={{ filter: 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))' }}
          />
        )
      }).filter(Boolean) // Remove null values
  }

  // Handle loading state
  if (companiesLoading || jobsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">Loading interactive mind map...</span>
      </div>
    )
  }

  // Handle error state
  if (companiesError || jobsError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">
            {companiesError?.message || jobsError?.message || 'Failed to load mind map data'}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Show message when no company is selected
  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Company Mindmap</h2>
          <p className="text-gray-600 mb-4 max-w-md">
            Please select a company from the Companies page to view its job mindmap.
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Go to Companies
          </Button>
        </div>
      </div>
    )
  }

  // Check if the selected company exists
  if (selectedCompany && companies.length > 0) {
    const companyExists = companies.find(c => c.name === selectedCompany)
    if (!companyExists) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Company Not Found</h2>
            <p className="text-gray-600 mb-4 max-w-md">
              The company "{selectedCompany}" was not found in our database.
            </p>
            <Button 
              onClick={() => window.location.href = '/'}
              variant="outline"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Go to Companies
            </Button>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Add custom animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }
      `}</style>
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-slate-200 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedCompany && (
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  title="Back to Home Page"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {selectedCompany ? `${selectedCompany} - Jobs Mindmap` : 'Jobs Mindmap'}
                </h1>
                <p className="text-slate-600">
                  {selectedCompany 
                    ? `Explore ${selectedCompany} job opportunities by category`
                    : 'Explore job opportunities by company and category'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {stats && (
                <div className="text-right">
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-blue-600">{stats.total_companies}</span> companies
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-green-600">{stats.total_jobs?.toLocaleString()}</span> jobs
                  </div>
                </div>
              )}
              
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-sm">
                <Button
                  onClick={zoomOut}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 font-semibold text-white border-slate-600 bg-slate-700 hover:bg-slate-600"
                  title="Zoom Out"
                >
                  -
                </Button>
                <span className="text-xs text-white font-medium min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  onClick={zoomIn}
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 font-semibold text-white border-slate-600 bg-slate-700 hover:bg-slate-600"
                  title="Zoom In"
                >
                  +
                </Button>
                <Button
                  onClick={handleFitAll}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs font-medium text-white border-slate-600 bg-slate-700 hover:bg-slate-600"
                  title="Fit to Screen"
                >
                  Fit
                </Button>
                <Button
                  onClick={resetView}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs font-medium text-white border-slate-600 bg-slate-700 hover:bg-slate-600"
                  title="Reset View"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-slate-700">Loading data...</span>
          </div>
        </div>
      )}

      {/* Mindmap Container */}
      <div 
        ref={containerRef}
        className={`w-full h-full pt-20 overflow-hidden select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ touchAction: 'none' }}
      >
        <div 
          className="relative origin-top-left transition-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: '100%',
            height: '100%',
            willChange: isDragging ? 'transform' : 'auto'
          }}
        >
          <svg 
            width="8000" 
            height="4000" 
            className="absolute inset-0 pointer-events-none z-0"
            style={{ 
              minWidth: '8000px', 
              minHeight: '4000px',
              overflow: 'visible'
            }}
          >
            {renderConnections()}
          </svg>
          
          <div 
            className="relative pointer-events-none z-10"
            style={{ minWidth: '8000px', minHeight: '4000px' }}
          >
            {nodes.map((node, index) => (
              <div
                key={node.id}
                className="absolute transform -translate-y-1/2 pointer-events-auto animate-fade-in-up"
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  animationDelay: `${index * 50}ms`
                }}
              >
                <Card 
                  className={`
                    p-4 transition-all duration-300 shadow-lg hover:shadow-xl
                    min-w-[280px] max-w-[320px] border-0 ${getNodeColor(node.type, node.data)}
                    ${selectedPath.includes(node.id) ? 'ring-2 ring-yellow-400' : ''}
                    ${node.type === 'job' || node.data?.isPaginationControl ? 'hover:scale-105' : 'hover:scale-102'}
                    ${node.data?.isPageInfo ? 'opacity-80' : ''}
                  `}
                >
                  <div 
                    className={`flex items-center space-x-3 ${
                      node.data?.isPageInfo ? 'cursor-default' : 'cursor-pointer'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('Node clicked:', { 
                        nodeId: node.id, 
                        nodeType: node.type, 
                        nodeData: node.data,
                        isPaginationControl: node.data?.isPaginationControl,
                        isPageInfo: node.data?.isPageInfo
                      }) // Enhanced debug log
                      
                      if (node.data?.isPageInfo) return // Page info is not clickable
                      
                      // Handle pagination controls first, regardless of node type
                      if (node.data?.isPaginationControl) {
                        console.log('Detected pagination control, calling handleJobClick with null job')
                        handleJobClick(null, node.data) // Pass null as job since it's a pagination control
                      } else if (node.type === 'job') {
                        console.log('Regular job click')
                        handleJobClick(node.data.job, node.data)
                      } else {
                        console.log('Node expansion click')
                        handleNodeClick(node.id, node.type, node.data)
                      }
                    }}
                  >
                    {getNodeIcon(node.type, node.data)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight mb-1 truncate">
                        {node.title}
                      </h3>
                      {node.subtitle && (
                        <p className="text-xs opacity-90 truncate">
                          {node.subtitle}
                        </p>
                      )}
                    </div>
                    {!node.data?.isPaginationControl && !node.data?.isPageInfo && node.type !== 'job' && (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
