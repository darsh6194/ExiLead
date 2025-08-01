import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  Calendar,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Play
} from "lucide-react"
import type { ViewMode } from "@/lib/types"

export default function ScraperStatus() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [selectedTab, setSelectedTab] = useState("overview")

  // Fetch scraper status
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery({
    queryKey: ["scraper", "status"],
    queryFn: async () => {
      const response = await fetch("/api/scraper/status")
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch scraper status: ${response.status} - ${errorText}`)
      }
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3,
  })

  // Fetch scraper runs
  const { data: runs, isLoading: runsLoading, error: runsError } = useQuery({
    queryKey: ["scraper", "runs"],
    queryFn: async () => {
      const response = await fetch("/api/scraper/runs?page=1&limit=20")
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch scraper runs: ${response.status} - ${errorText}`)
      }
      return response.json()
    },
    retry: 3,
  })

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A"
    try {
      const date = new Date(dateStr)
      return date.toLocaleString()
    } catch {
      return dateStr
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return "N/A"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "text-green-600 bg-green-50"
      case "error": return "text-red-600 bg-red-50"
      case "running": return "text-blue-600 bg-blue-50"
      default: return "text-gray-600 bg-gray-50"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="w-4 h-4" />
      case "error": return <XCircle className="w-4 h-4" />
      case "running": return <RefreshCw className="w-4 h-4 animate-spin" />
      default: return <Clock className="w-4 h-4" />
    }
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
        {/* Page Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-medium text-google-dark">Scraper Status</h1>
            <p className="text-google-gray mt-1">
              Monitor your automated job scraping pipeline
            </p>
          </div>
          <Button 
            onClick={() => refetchStatus()} 
            variant="outline" 
            className="border-google-blue text-google-blue hover:bg-google-blue hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="runs">Run History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Error Display */}
            {(statusError || runsError) && (
              <Card className="bg-red-50 border border-red-200">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">API Connection Issues</h3>
                      <div className="mt-2 space-y-1 text-sm text-red-700">
                        {statusError && <p>Status: {statusError.message}</p>}
                        {runsError && <p>Runs: {runsError.message}</p>}
                      </div>
                      <p className="mt-2 text-xs text-red-600">
                        Check if the scheduler database is running and accessible.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card border border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${status?.currentlyRunning ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      {status?.currentlyRunning ? 
                        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" /> :
                        <Activity className="w-5 h-5 text-gray-600" />
                      }
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Status</p>
                      <p className="text-lg font-medium text-google-dark">
                        {status?.currentlyRunning ? "Running" : "Idle"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-lg bg-green-50">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Success Rate</p>
                      <p className="text-lg font-medium text-google-dark">
                        {status?.stats ? 
                          Math.round((status.stats.successful_runs / Math.max(status.stats.total_runs, 1)) * 100) : 0
                        }%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Database className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Total Jobs Saved</p>
                      <p className="text-lg font-medium text-google-dark">
                        {status?.stats?.total_jobs_saved?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Avg Duration</p>
                      <p className="text-lg font-medium text-google-dark">
                        {formatDuration(Math.round(status?.stats?.avg_duration || 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Last Run Details */}
            {status?.lastRun && (
              <Card className="bg-card border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-google-dark flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Last Run Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-google-gray">Started</p>
                      <p className="font-medium text-google-dark">
                        {formatDate(status.lastRun.started_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Status</p>
                      <Badge className={getStatusColor(status.lastRun.status)}>
                        {getStatusIcon(status.lastRun.status)}
                        <span className="ml-1">{status.lastRun.status}</span>
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Jobs Saved</p>
                      <p className="font-medium text-google-dark">
                        {status.lastRun.jobs_saved || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Duration</p>
                      <p className="font-medium text-google-dark">
                        {formatDuration(status.lastRun.duration_seconds)}
                      </p>
                    </div>
                  </div>

                  {status.lastRun.error_message && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Error Message</p>
                          <p className="text-sm text-red-700 mt-1">
                            {status.lastRun.error_message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Schedule Information */}
            {status?.schedule && (
              <Card className="bg-card border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-google-dark flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Schedule Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-google-gray">Cron Pattern</p>
                      <p className="font-medium text-google-dark font-mono">
                        {status.schedule.cron_pattern || "Not configured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Next Run</p>
                      <p className="font-medium text-google-dark">
                        {status.schedule.next_run ? formatDate(status.schedule.next_run) : "Not scheduled"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-google-gray">Status</p>
                      <Badge variant={status.schedule.enabled ? "default" : "secondary"}>
                        {status.schedule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Run History Tab */}
          <TabsContent value="runs" className="space-y-6">
            <Card className="bg-card border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-medium text-google-dark">Recent Runs</CardTitle>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-google-gray mb-2" />
                    <p className="text-google-gray">Loading run history...</p>
                  </div>
                ) : runs?.runs?.length ? (
                  <div className="space-y-4">
                    {runs.runs.map((run: any) => (
                      <div key={run.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${getStatusColor(run.status).split(' ')[1]}`}>
                            {getStatusIcon(run.status)}
                          </div>
                          <div>
                            <p className="font-medium text-google-dark">
                              Run #{run.id}
                            </p>
                            <p className="text-sm text-google-gray">
                              {formatDate(run.started_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <p className="text-google-gray">Jobs</p>
                            <p className="font-medium text-google-dark">{run.jobs_saved || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-google-gray">Duration</p>
                            <p className="font-medium text-google-dark">{formatDuration(run.duration_seconds)}</p>
                          </div>
                          <Badge className={getStatusColor(run.status)}>
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 mx-auto text-google-gray mb-2" />
                    <p className="text-google-gray">No runs found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
