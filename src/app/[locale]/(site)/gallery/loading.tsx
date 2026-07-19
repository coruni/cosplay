import { Loader2Icon } from 'lucide-react';

export default function GalleryListLoading() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="pt-24 sm:pt-32 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-9 sm:h-10 w-48 rounded-lg bg-white/[0.04] animate-pulse mb-3" />
          <div className="h-5 w-96 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>

      {/* Filter skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 h-11 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-11 w-24 rounded-xl bg-white/[0.04] animate-pulse" />
          </div>
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 rounded-full bg-white/[0.04] animate-pulse shrink-0"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden bg-[#14141f] border border-white/[0.06]"
              >
                <div className="aspect-[3/4] bg-white/[0.03] animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 rounded bg-white/[0.04] animate-pulse" />
                  <div className="h-4 w-1/2 rounded bg-white/[0.04] animate-pulse" />
                  <div className="h-4 w-1/3 rounded bg-white/[0.04] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center py-12">
        <Loader2Icon
          className="size-6 text-[#ff2d78] animate-spin"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
