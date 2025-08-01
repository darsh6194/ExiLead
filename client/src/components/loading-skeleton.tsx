import { Card, CardContent } from "@/components/ui/card"

interface LoadingSkeletonProps {
  count?: number
  viewMode?: "grid" | "list"
}

export function LoadingSkeleton({ count = 8, viewMode = "grid" }: LoadingSkeletonProps) {
  const skeletonItems = Array.from({ length: count }, (_, i) => i)

  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        {skeletonItems.map((item) => (
          <Card key={item} className="animate-pulse bg-card border border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-muted rounded-lg animate-skeleton"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-skeleton"></div>
                  <div className="h-3 bg-muted rounded w-3/4 animate-skeleton"></div>
                </div>
                <div className="h-6 bg-muted rounded w-24 animate-skeleton"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {skeletonItems.map((item) => (
        <Card key={item} className="animate-pulse bg-card border border-border shadow-sm">
          <CardContent className="p-8">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-muted rounded-lg animate-skeleton"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded animate-skeleton"></div>
                <div className="h-3 bg-muted rounded w-3/4 animate-skeleton"></div>
                <div className="h-6 bg-muted rounded w-1/2 animate-skeleton mt-3"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
