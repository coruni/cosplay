'use client';

import { useEffect } from 'react';
import { AlertTriangleIcon, RotateCcwIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GalleryError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Gallery page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-center max-w-md">
        {/* Error icon */}
        <div className="relative mb-6">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-20"
            style={{
              background:
                'radial-gradient(circle, rgba(255,45,120,0.4) 0%, transparent 70%)',
            }}
          />
          <div className="relative flex items-center justify-center size-16 rounded-full bg-[#ff2d78]/10 border border-[#ff2d78]/20">
            <AlertTriangleIcon className="size-7 text-[#ff2d78]" aria-hidden="true" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {error.message || 'An unexpected error occurred while loading this gallery.'}
        </p>

        <button
          type="button"
          onClick={reset}
          className={cn(
            'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
            'text-sm font-semibold text-white',
            'bg-[#ff2d78] hover:bg-[#ff2d78]/90',
            'transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d78]/60',
            'active:scale-[0.98]'
          )}
          style={{ minHeight: 44 }}
        >
          <RotateCcwIcon className="size-4" aria-hidden="true" />
          Try Again
        </button>
      </div>
    </div>
  );
}
