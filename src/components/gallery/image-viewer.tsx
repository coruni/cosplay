'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { XIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function ImageViewer({
  images,
  initialIndex = 0,
  open,
  onClose,
  title,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoaded, setImageLoaded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Reset index when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setImageLoaded(false);
    }
  }, [open, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          navigate(-1);
          break;
        case 'ArrowRight':
          navigate(1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, currentIndex]);

  const navigate = useCallback(
    (direction: number) => {
      setImageLoaded(false);
      setCurrentIndex((prev) => {
        const next = prev + direction;
        if (next < 0) return images.length - 1;
        if (next >= images.length) return 0;
        return next;
      });
    },
    [images.length]
  );

  if (!open) return null;

  const currentImage = images[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]/95 backdrop-blur-xl"
        onClick={onClose}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 size-11 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white"
          onClick={onClose}
          aria-label="Close viewer"
        >
          <XIcon className="size-5" />
        </Button>

        {/* Title */}
        {title && (
          <div className="absolute top-4 left-4 z-10">
            <p className="text-sm text-white/70 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5">
              {title} — {currentIndex + 1} / {images.length}
            </p>
          </div>
        )}

        {/* Previous */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 z-10 size-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white"
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
            aria-label="Previous image"
          >
            <ChevronLeftIcon className="size-6" />
          </Button>
        )}

        {/* Image */}
        <div
          className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-10 border-2 border-[#ff2d78]/30 border-t-[#ff2d78] rounded-full animate-spin" />
            </div>
          )}
          <motion.img
            key={currentImage}
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: imageLoaded ? 1 : 0, scale: imageLoaded ? 1 : 0.95 }}
            transition={{ duration: 0.3 }}
            src={currentImage}
            alt={title ? `${title} — Image ${currentIndex + 1}` : `Image ${currentIndex + 1}`}
            className={cn(
              'max-w-full max-h-[85vh] object-contain rounded-lg select-none',
              'shadow-2xl shadow-black/50'
            )}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
        </div>

        {/* Next */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 z-10 size-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
            aria-label="Next image"
          >
            <ChevronRightIcon className="size-6" />
          </Button>
        )}

        {/* Bottom: Thumbnail dots */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                  setImageLoaded(false);
                }}
                className={cn(
                  'size-2 rounded-full transition-all duration-200',
                  idx === currentIndex
                    ? 'bg-[#ff2d78] w-6 shadow-[0_0_8px_rgba(255,45,120,0.6)]'
                    : 'bg-white/30 hover:bg-white/50'
                )}
                aria-label={`Go to image ${idx + 1}`}
                style={{ minHeight: 8, minWidth: 8 }}
              />
            ))}
          </div>
        )}

        {/* Counter (mobile) */}
        {images.length > 1 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 sm:hidden z-10">
            <span className="text-xs text-white/50 bg-black/40 rounded-full px-3 py-1">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
