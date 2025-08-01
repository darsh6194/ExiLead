import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Calendar, ExternalLink } from "lucide-react"
import type { Job } from "@shared/schema"
import { motion } from "framer-motion"

interface JobCardProps {
  job: Job
  companyName?: string
  onJobClick: () => void
  onApplyClick: (applyLink: string) => void
  index: number
}

export function JobCard({ job, companyName, onJobClick, onApplyClick, index }: JobCardProps) {
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

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (job.applyLink) {
      onApplyClick(job.applyLink)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A"
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) return "1 day ago"
      if (diffDays < 7) return `${diffDays} days ago`
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} week${Math.ceil(diffDays / 7) > 1 ? 's' : ''} ago`
      return `${Math.ceil(diffDays / 30)} month${Math.ceil(diffDays / 30) > 1 ? 's' : ''} ago`
    } catch {
      return dateStr
    }
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <Card 
        className="hover:shadow-lg hover:border-google-blue/20 transition-all duration-200 cursor-pointer bg-card border border-border shadow-sm"
        onClick={onJobClick}
      >
        <CardContent className="p-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-google-dark hover:text-google-blue transition-colors">
                {job.title || "N/A"}
              </h3>
              {companyName && (
                <p className="text-google-gray text-sm mb-2">{companyName}</p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-sm text-google-gray flex-wrap">
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {job.location || "N/A"}
                </span>
                {job.employmentType && (
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {job.employmentType}
                  </span>
                )}
                {job.experienceLevel && (
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {job.experienceLevel}
                  </span>
                )}
                {job.workMode && job.workMode !== "On-site" && (
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {job.workMode}
                  </span>
                )}
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(job.postedDate || "")}
                </span>
              </div>
              {job.category && (
                <div className="mt-3">
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {job.category}
                  </Badge>
                </div>
              )}
              {job.skills && job.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.skills.slice(0, 4).map((skill, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {skill}
                    </Badge>
                  ))}
                  {job.skills.length > 4 && (
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                      +{job.skills.length - 4} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Button 
              onClick={handleApplyClick}
              className="ml-4 bg-google-blue hover:bg-google-blue-light"
              size="sm"
            >
              View Details
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
