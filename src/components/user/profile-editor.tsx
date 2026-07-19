'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SafeUser } from '@/types';

interface ProfileEditorProps {
  user: SafeUser;
}

export function ProfileEditor({ user }: ProfileEditorProps) {
  const t = useTranslations('user');
  const [nickname, setNickname] = useState(user.nickname || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, avatar }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('profileUpdated'));
    } catch {
      toast.error('Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nickname" className="text-sm text-muted-foreground">
          {t('nickname')}
        </Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={user.username}
          className="h-11 bg-white/[0.03] border-white/[0.08]"
          style={{ minHeight: 44 }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar" className="text-sm text-muted-foreground">
          {t('avatar')} (URL)
        </Label>
        <Input
          id="avatar"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="https://..."
          className="h-11 bg-white/[0.03] border-white/[0.08]"
          style={{ minHeight: 44 }}
        />
      </div>

      <Button
        type="submit"
        disabled={saving}
        className={cn(
          'h-11 font-semibold',
          'bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white',
          'disabled:opacity-50'
        )}
      >
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
