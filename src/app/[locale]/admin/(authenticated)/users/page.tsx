'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2Icon,
  UsersIcon,
  CrownIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  UserXIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { resolveImageUrl } from '@/lib/s3';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  isSubscribed: boolean;
  subscriptionEndAt: string | null;
  quotaTotal: number;
  quotaUsed: number;
  createdAt: string;
  _count: { orders: number };
}

interface Stats {
  totalUsers: number;
  totalSubscribed: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const locale = useLocale();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalSubscribed: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        query,
        filter,
      });
      const res = await fetch(`/admin/api/users?${params}`);
      if (res.status === 401) { router.push(`/${locale}/admin/login`); return; }
      const data = await res.json();
      setUsers(data.items);
      setTotalPages(data.totalPages);
      setStats(data.stats);
    } catch (e) {
      console.error('Fetch users failed:', e);
    } finally {
      setLoading(false);
    }
  }, [page, query, filter, router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAction = async (id: string, action: 'resetQuota' | 'cancelSub') => {
    setBusyId(id);
    try {
      const res = await fetch('/admin/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error('Action failed:', e);
    } finally {
      setBusyId(null);
    }
  };

  const quotaPct = (u: AdminUser) =>
    u.quotaTotal > 0 ? Math.min(100, Math.round((u.quotaUsed / u.quotaTotal) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 bg-[#262633] border border-white/[0.06] flex items-center gap-4">
          <div className="size-10 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
            <UsersIcon className="size-5 text-[#00d4ff]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{stats.totalUsers}</p>
            <p className="text-sm text-muted-foreground">注册用户</p>
          </div>
        </div>
        <div className="rounded-xl p-5 bg-[#262633] border border-white/[0.06] flex items-center gap-4">
          <div className="size-10 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
            <CrownIcon className="size-5 text-[#a855f7]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{stats.totalSubscribed}</p>
            <p className="text-sm text-muted-foreground">会员用户</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索邮箱 / 用户名 / 昵称..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="pl-9 bg-white/[0.03] border-white/[0.08]"
            style={{ minHeight: 44 }}
          />
        </div>
        <div className="flex items-center gap-2">
          {[
            { value: '', label: '全部' },
            { value: 'subscribed', label: '会员' },
            { value: 'free', label: '非会员' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f.value
                  ? 'bg-[#ff2d78]/15 text-[#ff2d78] border border-[#ff2d78]/20'
                  : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-white/[0.04]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl bg-[#262633] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">用户</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">会员</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">配额</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">注册时间</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2Icon className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <UsersIcon className="size-8 mx-auto mb-2 opacity-40" />
                    暂无用户
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full overflow-hidden bg-[#1c1c28] border border-white/[0.06] shrink-0">
                          {u.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveImageUrl(u.avatar)}
                              alt={u.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#ff2d78]/30 to-[#00d4ff]/30" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground font-medium truncate max-w-[160px]">
                            {u.nickname || u.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.isSubscribed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
                          <CrownIcon className="size-3" />
                          会员
                          {u.subscriptionEndAt && (
                            <span className="text-[10px] opacity-70">
                              {new Date(u.subscriptionEndAt).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              quotaPct(u) >= 90 ? 'bg-red-500' : 'bg-[#00d4ff]'
                            )}
                            style={{ width: `${quotaPct(u)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {u.quotaUsed}/{u.quotaTotal}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleAction(u.id, 'resetQuota')}
                          disabled={busyId === u.id || u.quotaUsed === 0}
                          className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="重置配额"
                          title="重置配额"
                        >
                          {busyId === u.id ? (
                            <Loader2Icon className="size-4 animate-spin" />
                          ) : (
                            <RotateCcwIcon className="size-4" />
                          )}
                        </button>
                        {u.isSubscribed && (
                          <button
                            onClick={() => handleAction(u.id, 'cancelSub')}
                            disabled={busyId === u.id}
                            className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                            aria-label="取消会员"
                            title="取消会员"
                          >
                            <UserXIcon className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-muted-foreground">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="size-8"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="size-8"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
