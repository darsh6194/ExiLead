export type ViewMode = "grid" | "list"

export type FilterState = {
  category: string
  skills: string[]
}

export type SortOption = "jobCount" | "name" | "recent"

export const JOB_CATEGORIES = [
  "Software Development",
  "Management/Leadership", 
  "Quality Assurance",
  "Data Science/Analytics",
  "Cybersecurity",
  "DevOps/Infrastructure",
  "Operations",
  "Consulting",
  "Customer Success/Support",
  "Research",
  "Other",
  "Design/UX",
  "Finance/Accounting",
] as const

export type JobCategory = typeof JOB_CATEGORIES[number]
