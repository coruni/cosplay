'use client';

import { useState, type KeyboardEvent } from 'react';
import { XIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
}

export function TagInput({ value, onChange, placeholder, label }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, t]);
    setDraft('');
  };

  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex flex-wrap gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] p-2 min-h-[40px] items-center focus-within:border-[#ff2d78]/40 transition-colors">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-[#ff2d78]/15 text-[#ff8ab4] text-xs px-2 py-1"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="hover:text-white transition-colors"
              aria-label={`移除 ${t}`}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
