'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useTranslations } from 'next-intl';
import { AlertTriangleIcon } from 'lucide-react';
import { useNsfwStore } from '@/lib/nsfw-store';
import { NSFW_COOKIE } from '@/lib/nsfw-shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NsfwToggleProps {
  /** Additional class names for the toggle wrapper */
  className?: string;
  /** Show label text next to the toggle */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
}

/**
 * NSFW content toggle switch with built-in age confirmation dialog.
 *
 * When the user attempts to enable NSFW content without prior age confirmation,
 * a modal dialog appears requiring explicit consent. Once confirmed, the preference
 * is persisted via zustand with localStorage.
 *
 * The toggle features a violet neon glow when active, smooth spring animations,
 * and respects prefers-reduced-motion.
 */
export function NsfwToggle({
  className,
  showLabel = false,
  size = 'default',
}: NsfwToggleProps) {
  const t = useTranslations('nsfw');
  const { showNsfw, ageConfirmed, setShowNsfw, confirmAge } = useNsfwStore();
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Reconcile once on mount. The `coshub-nsfw` cookie is the authoritative
  // source of truth for server-side NSFW filtering, while the store (localStorage)
  // drives the switch UI. They must agree or the toggle "forgets" its state.
  // IMPORTANT: never blindly mirror the store into the cookie — if the store
  // rehydrates as `false` but a valid cookie exists (e.g. localStorage was
  // cleared), an unconditional write would DELETE the cookie and lose the
  // preference. Only write the cookie when we actually want NSFW on.
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    const cookieOn =
      typeof document !== 'undefined' &&
      document.cookie
        .split(';')
        .some((c) => c.trim().startsWith(`${NSFW_COOKIE}=1`));

    if (showNsfw && !cookieOn) {
      // Store says on but the cookie is missing → rewrite the cookie (server
      // source of truth) and refresh so the gallery lists update.
      setShowNsfw(true);
      router.refresh();
    } else if (cookieOn && !showNsfw) {
      // Cookie says on but the store disagrees → adopt the cookie so the switch
      // reflects what the server actually rendered. Never delete a good cookie.
      setShowNsfw(true);
    }
  }, [showNsfw, router, setShowNsfw]);

  const handleToggleClick = useCallback(() => {
    if (showNsfw) {
      // Turning off — always allowed
      setShowNsfw(false);
    } else if (ageConfirmed) {
      // Already confirmed, just enable
      setShowNsfw(true);
    } else {
      // Need age confirmation first
      setDialogOpen(true);
      return;
    }
    // The cookie drives server-side NSFW filtering, so re-render the server
    // tree (gallery/home/related lists) to reflect the new preference.
    router.refresh();
  }, [showNsfw, ageConfirmed, setShowNsfw, router]);

  const handleConfirm = useCallback(() => {
    confirmAge();
    setDialogOpen(false);
    router.refresh();
  }, [confirmAge, router]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const isSm = size === 'sm';
  const toggleWidth = isSm ? 36 : 44;
  const toggleHeight = isSm ? 20 : 24;
  const knobSize = isSm ? 14 : 18;
  const knobOffset = isSm ? 3 : 3;

  return (
    <>
      <div className={cn('inline-flex items-center gap-2', className)}>
        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={showNsfw}
          aria-label={t(showNsfw ? 'disable' : 'enable')}
          onClick={handleToggleClick}
          className={cn(
            'relative shrink-0 rounded-full transition-colors duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            showNsfw
              ? 'bg-violet-600/80 shadow-[0_0_12px_rgba(168,85,247,0.5)]'
              : 'bg-muted hover:bg-muted/80'
          )}
          style={{
            width: toggleWidth,
            height: toggleHeight,
            minWidth: toggleWidth,
            minHeight: toggleHeight,
          }}
        >
          <motion.span
            className={cn(
              'absolute rounded-full bg-white shadow-md',
              showNsfw && 'shadow-[0_0_6px_rgba(168,85,247,0.6)]'
            )}
            style={{
              width: knobSize,
              height: knobSize,
              top: knobOffset,
            }}
            animate={{
              left: showNsfw
                ? toggleWidth - knobSize - knobOffset
                : knobOffset,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 30 }
            }
          />
        </button>

        {/* Optional label */}
        {showLabel && (
          <span
            className={cn(
              'text-sm font-medium select-none transition-colors duration-300',
              showNsfw ? 'text-violet-400' : 'text-muted-foreground'
            )}
          >
            {t('toggle')}
          </span>
        )}
      </div>

      {/* Age confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md border-violet-500/20 bg-[#14141f]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-600/20 text-violet-400">
                <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              </span>
              {t('warning')}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              {t('warningDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false}>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 sm:flex-none"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
