import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MapPin, Clock, Calendar, CheckCircle, Star, ExternalLink, Building2, Award } from "lucide-react"
import type { Job, Company } from "@shared/schema"

interface JobDetailModalProps {
  job: Job | null
  company?: Company
  isOpen: boolean
  onClose: () => void
  onApply: (applyLink: string) => void
}

export function JobDetailModal({ job, company, isOpen, onClose, onApply }: JobDetailModalProps) {
  if (!job) return null

  const handleApply = () => {
    if (job.applyLink) {
      onApply(job.applyLink)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A"
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    } catch {
      return dateStr
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium text-google-dark">
            {job.title || "N/A"}
          </DialogTitle>
          {company && (
            <p className="text-google-gray flex items-center">
              <Building2 className="w-4 h-4 mr-1" />
              {company.name}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Category */}
          {job.category && (
            <div>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                {job.category}
              </Badge>
            </div>
          )}

          {/* Job Info Grid */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-google-gray">Location:</span>
              <span className="ml-2 text-google-dark font-medium">{job.location || "N/A"}</span>
            </div>
            <div>
              <span className="text-google-gray">Type:</span>
              <span className="ml-2 text-google-dark font-medium">{job.employmentType || "N/A"}</span>
            </div>
            <div>
              <span className="text-google-gray">Work Mode:</span>
              <span className="ml-2 text-google-dark font-medium">{job.workMode || "N/A"}</span>
            </div>
            {job.experienceLevel && (
              <div>
                <span className="text-google-gray">Experience:</span>
                <span className="ml-2 text-google-dark font-medium">{job.experienceLevel}</span>
              </div>
            )}
            <div>
              <span className="text-google-gray">Posted:</span>
              <span className="ml-2 text-google-dark font-medium">{formatDate(job.postedDate || "")}</span>
            </div>
            {job.deadline && (
              <div>
                <span className="text-google-gray">Deadline:</span>
                <span className="ml-2 text-google-dark font-medium">{formatDate(job.deadline)}</span>
              </div>
            )}
            {job.salary && (
              <div>
                <span className="text-google-gray">Salary:</span>
                <span className="ml-2 text-google-dark font-medium">{job.salary}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Two-column layout for main content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Description */}
              {job.description && (
                <div>
                  <h3 className="text-lg font-medium text-google-dark mb-3">Job Description</h3>
                  <div className="text-google-gray whitespace-pre-wrap text-sm leading-relaxed">
                    {job.description}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {job.requirements && job.requirements.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-google-dark mb-3">Requirements</h3>
                  <ul className="text-google-gray space-y-2">
                    {job.requirements.map((requirement, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-google-green mt-1 mr-2 flex-shrink-0" />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Skills */}
              {job.skills && job.skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-google-dark mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-sm bg-green-50 text-green-700 border-green-200">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Preferred Qualifications */}
              {job.preferredQualifications && job.preferredQualifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-google-dark mb-3">Preferred Qualifications</h3>
                  <ul className="text-google-gray space-y-2">
                    {job.preferredQualifications.map((qualification, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <Award className="w-4 h-4 text-google-blue mt-1 mr-2 flex-shrink-0" />
                        {qualification}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Responsibilities */}
              {job.responsibilities && job.responsibilities.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-google-dark mb-3">Key Responsibilities</h3>
                  <ul className="text-google-gray space-y-2">
                    {job.responsibilities.map((responsibility, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-orange-500 mt-1 mr-2 flex-shrink-0" />
                        {responsibility}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Benefits */}
              {job.benefits && job.benefits.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-google-dark mb-3">Benefits</h3>
                  <ul className="text-google-gray space-y-2">
                    {job.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <Star className="w-4 h-4 text-google-blue mt-1 mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Apply Section */}
          <div className="flex items-center justify-between">
            <div>
              {job.sourceUrl && (
                <>
                  <p className="text-sm text-google-gray">Source:</p>
                  <a 
                    href={job.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-google-blue hover:text-google-blue-light text-sm flex items-center"
                  >
                    View Original Posting
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </>
              )}
            </div>
            <Button 
              onClick={handleApply}
              className="bg-google-blue hover:bg-google-blue-light"
              disabled={!job.applyLink}
            >
              View More
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
