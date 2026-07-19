import { Loader2Icon } from 'lucide-react';

export default function GalleryLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Skeleton hero */}
      <div className="w-full h-[50vh] sm:h-[60vh] bg-[#14141f] animate-pulse" />

      <div className="relative -mt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl p-6 sm:p-8 lg:p-10 bg-[#14141f]/90 border border-white/[0.06]">
            {/* Skeleton badges */}
            <div className="flex gap-2.5 mb-4">
              <div className="h-6 w-16 rounded-lg bg-white/[0.04] animate-pulse" />
              <div className="h-6 w-14 rounded-lg bg-white/[0.04] animate-pulse" />
            </div>
            {/* Skeleton title */}
            <div className="h-8 sm:h-10 w-3/4 rounded-lg bg-white/[0.04] animate-pulse mb-3" />
            {/* Skeleton description */}
            <div className="space-y-2 mb-6">
              <div className="h-4 w-full rounded bg-white/[0.04] animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Loading spinner */}
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2Icon
            className="size-8 text-[#ff2d78] animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    </div>
  );
}
