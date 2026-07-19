'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  MailIcon,
  LockIcon,
  UserIcon,
  AlertCircleIcon,
  ShieldIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('user');

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirect, setRedirect] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirect(params.get('redirect') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint =
        mode === 'login' ? '/api/user/login' : '/api/user/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { email, username, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
        return;
      }

      // Cookie is set by server (HttpOnly) — just redirect
      const target = redirect || `/${locale}/account`;
      router.push(target);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4 py-12">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(255,45,120,0.08) 0%, transparent 60%)',
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
            boxShadow:
              '0 0 40px rgba(255,45,120,0.08), 0 0 80px rgba(255,45,120,0.03)',
          }}
        >
          <div className="text-center mb-6">
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
            <p className="text-xs text-muted-foreground mt-1 tracking-[0.15em] uppercase">
              {mode === 'login' ? t('loginTitle') : t('registerTitle')}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'bg-[#ff2d78] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('login')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'register'
                  ? 'bg-[#ff2d78] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('register')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                {t('email')}
              </Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 h-11 bg-white/[0.03] border-white/[0.08]"
                  required
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-sm text-muted-foreground"
                >
                  {t('username')}
                </Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="cosplayer_fan"
                    className="pl-10 h-11 bg-white/[0.03] border-white/[0.08]"
                    required
                    minLength={2}
                    style={{ minHeight: 44 }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm text-muted-foreground"
              >
                {t('password')}
              </Label>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 bg-white/[0.03] border-white/[0.08]"
                  required
                  minLength={6}
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
              disabled={loading}
              className={cn(
                'w-full h-11 text-base font-semibold',
                'bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{ boxShadow: '0 0 24px rgba(255,45,120,0.3)' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ...
                </span>
              ) : mode === 'login' ? (
                t('login')
              ) : (
                t('register')
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
