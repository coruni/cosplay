'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { CheckIcon, ChevronDownIcon, XIcon, TagIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryOption {
  id: string;
  slug: string;
  icon: string;
  name: { zh?: string; en?: string; ja?: string };
}

interface CategorySelectProps {
  value: string[];
  onChange: (slugs: string[]) => void;
}

/**
 * Multi-select for gallery categories backed by the `Category` table.
 * Fetches options from GET /admin/api/categories and emits an array of slugs.
 * Unlike a free-text TagInput, this prevents typos and keeps categories
 * consistent with the database directory.
 */
export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const locale = useLocale();
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/admin/api/categories')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active) setOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const nameOf = (c: CategoryOption) =>
    c.name?.[locale as 'zh' | 'en' | 'ja'] ||
    c.name?.en ||
    c.name?.zh ||
    c.slug;

  const filtered = options.filter(
    (c) =>
      nameOf(c).toLowerCase().includes(query.toLowerCase()) ||
      c.slug.includes(query.toLowerCase())
  );

  const toggle = (slug: string) => {
    if (value.includes(slug)) onChange(value.filter((s) => s !== slug));
    else onChange([...value, slug]);
  };

  const remove = (slug: string) => onChange(value.filter((s) => s !== slug));

  return (
    <div className="space-y-1.5" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 h-10 rounded-lg',
            'bg-white/[0.03] border border-white/[0.08] text-sm text-foreground',
            'hover:border-white/[0.15] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/40'
          )}
          style={{ minHeight: 40 }}
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <TagIcon className="size-4" />
            {value.length ? `已选 ${value.length} 个分类` : '点击选择分类'}
          </span>
          <ChevronDownIcon
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>

        {open && (
          <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#262633] shadow-lg shadow-black/40 overflow-hidden">
            <div className="p-2 border-b border-white/[0.06]">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索分类..."
                className="w-full h-9 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#00d4ff]/40"
              />
            </div>
            <div className="max-h-60 overflow-y-auto scrollbar-hide py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  无匹配分类
                </p>
              ) : (
                filtered.map((c) => {
                  const checked = value.includes(c.slug);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.slug)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                        'hover:bg-white/[0.04] transition-colors',
                        checked ? 'text-[#ff2d78]' : 'text-foreground'
                      )}
                    >
                      <span className="text-lg leading-none w-6 text-center">
                        {c.icon}
                      </span>
                      <span className="flex-1 truncate">{nameOf(c)}</span>
                      <span className="text-xs text-muted-foreground/60">
                        {c.slug}
                      </span>
                      {checked && <CheckIcon className="size-4 text-[#ff2d78]" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-3 py-2 border-t border-white/[0.06] text-xs text-muted-foreground">
              共 {options.length} 个分类 · 选择后保存即生效（分类在「分类管理」中维护）
            </div>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((slug) => {
            const c = options.find((o) => o.slug === slug);
            const label = c ? nameOf(c) : slug;
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-[#ff2d78]/10 border border-[#ff2d78]/20 text-xs text-[#ff2d78]"
              >
                <span>{c?.icon}</span>
                {label}
                <button
                  type="button"
                  onClick={() => remove(slug)}
                  className="size-4 flex items-center justify-center rounded-full hover:bg-[#ff2d78]/20 transition-colors"
                  aria-label={`移除 ${label}`}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
