'use client';

import { useState, useCallback, useRef } from 'react';
import { UploadCloudIcon, XIcon, Loader2Icon, AlertCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadImage, type UploadProvider } from '@/lib/upload';
import { resolveImageUrl } from '@/lib/s3';

interface ImageUploaderProps {
  /** S3 folder prefix, e.g. "galleries/nier-2b" */
  folder: string;
  /** Single key (string) or array of keys */
  value: string | string[];
  /** Called with the new value (string for single, string[] for multiple) */
  onChange: (value: string | string[]) => void;
  /** Allow multiple files */
  multiple?: boolean;
  /** Label above the dropzone */
  label?: string;
  className?: string;
  /** Current cover key (multiple mode) — highlights it and offers "设为封面" */
  cover?: string;
  /** Called when the user picks an image as the cover (multiple mode) */
  onSetCover?: (key: string) => void;
  /** Storage backend to upload to. Defaults to "s3". */
  provider?: UploadProvider;
  /** Mark uploaded images as NSFW on the external image host (only used when provider="imagehost"). */
  nsfw?: boolean;
}

interface ProgressEntry {
  name: string;
  percent: number;
}

/**
 * ImageUploader — drag-and-drop image upload to S3 via presigned URLs.
 *
 * Features:
 * - Single or multiple file mode
 * - Per-file upload progress bar
 * - Thumbnail preview grid with remove buttons
 * - Touch-friendly dropzone (≥44px)
 * - Error display without clearing selection
 */
export function ImageUploader({
  folder,
  value,
  onChange,
  multiple = false,
  label,
  className,
  cover,
  onSetCover,
  provider = 's3',
  nsfw = false,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      setIsUploading(true);
      setProgress(fileArr.map((f) => ({ name: f.name, percent: 0 })));

      try {
        if (multiple) {
          const keys: string[] = [];
          for (let i = 0; i < fileArr.length; i++) {
            const file = fileArr[i];
            const key = await uploadImage(
              file,
              folder,
              (p) => {
                setProgress((prev) =>
                  prev.map((entry, idx) =>
                    idx === i ? { ...entry, percent: p } : entry
                  )
                );
              },
              { provider, nsfw }
            );
            keys.push(key);
          }
          const current = Array.isArray(value) ? value : [];
          onChange([...current, ...keys]);
        } else {
          const file = fileArr[0];
          const key = await uploadImage(
            file,
            folder,
            (p) => {
              setProgress((prev) =>
                prev.map((entry, idx) =>
                  idx === 0 ? { ...entry, percent: p } : entry
                )
              );
            },
            { provider, nsfw }
          );
          onChange(key);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setError(msg);
        // If unauthorized, surface so the caller can redirect
        if (msg === 'Unauthorized') {
          window.location.href = '/admin/login';
        }
      } finally {
        setIsUploading(false);
        setProgress([]);
      }
    },
      [folder, value, onChange, multiple, provider, nsfw]
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (multiple && Array.isArray(value)) {
        onChange(value.filter((_, i) => i !== index));
      } else {
        onChange('');
      }
    },
    [value, onChange, multiple]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!isUploading) handleFiles(e.dataTransfer.files);
    },
    [handleFiles, isUploading]
  );

  const items =
    multiple
      ? Array.isArray(value)
        ? value
        : []
      : typeof value === 'string' && value
        ? [value]
        : [];

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}

      {/* Dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        disabled={isUploading}
        className={cn(
          'w-full rounded-lg border border-dashed transition-colors',
          'flex flex-col items-center justify-center gap-1.5 p-4 text-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d78]/60',
          isDragOver
            ? 'border-[#ff2d78]/60 bg-[#ff2d78]/[0.05]'
            : 'border-white/[0.12] bg-white/[0.02] hover:border-[#ff2d78]/40 hover:bg-[#ff2d78]/[0.03]',
          isUploading && 'opacity-60 cursor-wait',
          !isUploading && 'cursor-pointer'
        )}
        style={{ minHeight: 88 }}
      >
        {isUploading ? (
          <Loader2Icon className="size-5 text-[#00d4ff] animate-spin" />
        ) : (
          <UploadCloudIcon className="size-5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">
          {isUploading
            ? '上传中...'
            : multiple
              ? '点击或拖拽上传多张图片'
              : '点击或拖拽上传封面图'}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          支持 JPG / PNG / WebP / GIF / AVIF
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </button>

      {/* Progress bars */}
      {progress.length > 0 && (
        <div className="space-y-1.5">
          {progress.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate flex-1 max-w-[140px]">
                {entry.name}
              </span>
              <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-[#ff2d78] transition-all duration-200"
                  style={{ width: `${entry.percent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                {entry.percent}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertCircleIcon className="size-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Preview grid */}
      {items.length > 0 && (
        <div
          className={cn(
            'grid gap-2',
            multiple ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1 max-w-[160px]'
          )}
        >
          {items.map((key, index) => {
            const isCover = multiple && cover === key;
            return (
              <div
                key={key + index}
                className={cn(
                  'relative aspect-square rounded-lg overflow-hidden border group bg-[#1c1c28]',
                  isCover ? 'border-[#ff2d78]/60' : 'border-white/[0.06]'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImageUrl(key)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 size-6 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  aria-label="删除此图片"
                >
                  <XIcon className="size-3" />
                </button>
                {multiple && onSetCover && (
                  <button
                    type="button"
                    onClick={() => onSetCover(key)}
                    className={cn(
                      'absolute bottom-1 right-1 text-[10px] rounded px-1.5 py-0.5 transition-colors',
                      isCover
                        ? 'bg-[#ff2d78] text-white'
                        : 'bg-black/60 text-white/90 hover:bg-[#ff2d78]/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                    )}
                    aria-label="设为封面"
                  >
                    {isCover ? '封面' : '设为封面'}
                  </button>
                )}
                {multiple && !onSetCover && (
                  <span className="absolute bottom-1 left-1 text-[10px] text-white/90 bg-black/60 rounded px-1.5 py-0.5 tabular-nums">
                    {index + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
