import { cn } from "@/lib/utils"

interface CompanyLogoProps {
  companyName: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm", 
  lg: "w-16 h-16 text-base",
  xl: "w-20 h-20 text-lg"
}

const gradients = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500", 
  "from-green-500 to-emerald-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-blue-500",
  "from-teal-500 to-green-500",
  "from-pink-500 to-rose-500",
  "from-yellow-500 to-orange-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-teal-500"
]

export function CompanyLogo({ companyName, size = "md", className }: CompanyLogoProps) {
  // Get initials (up to 2 characters)
  const initials = companyName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
  
  return (
    <div className={cn(
      "rounded-xl flex items-center justify-center font-semibold text-muted-foreground bg-muted border border-border",
      sizeClasses[size],
      className
    )}>
      {initials}
    </div>
  )
}