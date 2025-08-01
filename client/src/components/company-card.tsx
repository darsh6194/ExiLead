import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CompanyLogo } from "@/components/company-logo"
import type { Company } from "@shared/schema"
import { motion } from "framer-motion"

interface CompanyCardProps {
  company: Company
  onClick: () => void
  viewMode: "grid" | "list"
  index: number
}

export function CompanyCard({ company, onClick, viewMode, index }: CompanyCardProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: index * 0.05,
        duration: 0.3 
      }
    }
  }

  if (viewMode === "list") {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card 
          className="hover:shadow-lg hover:border-google-blue/20 transition-all duration-200 cursor-pointer bg-card border border-border shadow-sm"
          onClick={onClick}
        >
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <CompanyLogo 
                companyName={company.name} 
                size="md" 
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-google-dark truncate">{company.name}</h3>
                <p className="text-google-gray text-sm">{company.industry || "Technology"}</p>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-google-blue/10 text-google-blue">
                  {company.jobCount} open position{company.jobCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <Card 
        className="hover:shadow-lg hover:border-google-blue/20 transition-all duration-200 cursor-pointer h-full bg-card border border-border shadow-sm"
        onClick={onClick}
      >
        <CardContent className="p-8">
          <div className="flex items-start space-x-4">
            <CompanyLogo 
              companyName={company.name} 
              size="md" 
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-google-dark truncate">{company.name}</h3>
              <p className="text-google-gray text-sm">{company.industry || "Technology"}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="bg-google-blue/10 text-google-blue">
                  {company.jobCount} open position{company.jobCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
