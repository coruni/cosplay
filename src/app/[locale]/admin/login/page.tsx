'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { LockIcon, ShieldIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function AdminLoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        document.cookie = `admin_token=${token}; path=/; max-age=86400; SameSite=Lax`;
        router.push(`/${locale}/admin`);
      } else {
        setError('无效的管理员令牌，请重试');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(255,45,120,0.08) 0%, transparent 60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
      >
        <div
          className={cn(
            'rounded-2xl p-8',
            'bg-[#14141f]/90 backdrop-blur-xl',
            'border border-white/[0.08]',
            'shadow-2xl shadow-black/50'
          )}
          style={{
            boxShadow: '0 0 40px rgba(255,45,120,0.08), 0 0 80px rgba(255,45,120,0.03)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="mx-auto size-14 rounded-2xl bg-[#ff2d78]/10 border border-[#ff2d78]/20 flex items-center justify-center mb-4"
              style={{ boxShadow: '0 0 20px rgba(255,45,120,0.15)' }}
            >
              <ShieldIcon className="size-7 text-[#ff2d78]" />
            </div>
            <h1
              className="text-2xl font-bold tracking-wider"
              style={{ fontFamily: 'Orbitron, sans-serif', color: '#ff2d78' }}
            >
              CosHub
            </h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-[0.2em] uppercase">
              Admin Panel
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-sm text-muted-foreground">
                管理员令牌
              </Label>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="请输入管理员令牌"
                  className={cn(
                    'pl-10 h-11 bg-white/[0.03] border-white/[0.08]',
                    'focus:border-[#ff2d78]/40 focus:ring-2 focus:ring-[#ff2d78]/10',
                    'text-foreground placeholder:text-muted-foreground/50'
                  )}
                  autoFocus
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
              >
                <AlertCircleIcon className="size-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || !token.trim()}
              className={cn(
                'w-full h-11 text-base font-semibold',
                'bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{
                boxShadow: '0 0 24px rgba(255,45,120,0.3)',
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  验证中...
                </span>
              ) : (
                '登录管理后台'
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
