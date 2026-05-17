export default function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-surface-100 animate-pulse">
      {/* Thumbnail area */}
      <div className="aspect-video bg-surface-200" />
      {/* Info area */}
      <div className="p-3 space-y-2">
        <div className="h-4 bg-surface-200 rounded w-4/5" />
        <div className="h-3 bg-surface-200 rounded w-2/5" />
        <div className="flex gap-2 mt-1">
          <div className="h-3 bg-surface-200 rounded w-1/4" />
          <div className="h-3 bg-surface-200 rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}