import { prisma } from '@/lib/db';
import {
  LayoutDashboardIcon,
  ImageIcon,
  CreditCardIcon,
  DollarSignIcon,
  EyeIcon,
  TrendingUpIcon,
  UsersIcon,
  CrownIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [
    galleryCount,
    orderStats,
    recentOrders,
    topGalleries,
    userCount,
    subscribedCount,
    recentUsers,
  ] = await Promise.all([
    prisma.gallery.count(),
    prisma.paymentOrder.aggregate({
      _count: true,
      _sum: { amount: true },
      where: { status: 'paid' },
    }),
    prisma.paymentOrder.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { gallery: { select: { slug: true, titleZh: true } } },
    }),
    prisma.gallery.findMany({
      take: 5,
      orderBy: { viewCount: 'desc' },
      select: { slug: true, titleZh: true, viewCount: true, downloadCount: true, price: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isSubscribed: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        avatar: true,
        isSubscribed: true,
        createdAt: true,
      },
    }),
  ]);

  const totalRevenue = orderStats._sum.amount || 0;
  const totalOrders = orderStats._count;

  const stats = [
    {
      label: '图包总数',
      value: galleryCount,
      icon: ImageIcon,
      color: '#00d4ff',
      bg: 'rgba(0,212,255,0.1)',
    },
    {
      label: '订单总数',
      value: totalOrders,
      icon: CreditCardIcon,
      color: '#a855f7',
      bg: 'rgba(168,85,247,0.1)',
    },
    {
      label: '总收入',
      value: `¥${totalRevenue.toFixed(2)}`,
      icon: DollarSignIcon,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.1)',
    },
    {
      label: '总浏览',
      value: topGalleries.reduce((s, g) => s + g.viewCount, 0).toLocaleString(),
      icon: EyeIcon,
      color: '#ff2d78',
      bg: 'rgba(255,45,120,0.1)',
    },
    {
      label: '注册用户',
      value: userCount,
      icon: UsersIcon,
      color: '#00d4ff',
      bg: 'rgba(0,212,255,0.1)',
    },
    {
      label: '会员用户',
      value: subscribedCount,
      icon: CrownIcon,
      color: '#a855f7',
      bg: 'rgba(168,85,247,0.1)',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                'rounded-xl p-5',
                'bg-[#262633] border border-white/[0.06]',
                'hover:border-white/[0.12] transition-all duration-200'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="size-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.bg }}
                >
                  <Icon className="size-5" style={{ color: stat.color }} />
                </div>
                <TrendingUpIcon className="size-4 text-muted-foreground/40" />
              </div>
              <p className="text-2xl font-bold text-foreground mb-1 tabular-nums">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Two columns: Recent Orders + Top Galleries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="rounded-xl bg-[#262633] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCardIcon className="size-4 text-[#a855f7]" />
              最近订单
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">订单号</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">图包</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">金额</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">状态</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                      暂无订单
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{order.orderId}</td>
                      <td className="px-5 py-3 text-foreground">{order.gallery?.titleZh || '—'}</td>
                      <td className="px-5 py-3 text-[#22c55e] font-medium">¥{order.amount.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            order.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : order.status === 'failed'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-amber-500/10 text-amber-400'
                          )}
                        >
                          {order.status === 'paid' ? '已支付' : order.status === 'failed' ? '失败' : '待支付'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Galleries */}
        <div className="rounded-xl bg-[#262633] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <EyeIcon className="size-4 text-[#ff2d78]" />
              热门图包
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">图包</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">浏览</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">下载</th>
                </tr>
              </thead>
              <tbody>
                {topGalleries.map((g, i) => (
                  <tr key={g.slug} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center size-6 rounded-full text-xs font-bold',
                          i === 0 ? 'bg-[#ff2d78]/20 text-[#ff2d78]' :
                          i === 1 ? 'bg-[#00d4ff]/20 text-[#00d4ff]' :
                          i === 2 ? 'bg-[#a855f7]/20 text-[#a855f7]' :
                          'bg-white/[0.04] text-muted-foreground'
                        )}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-foreground font-medium">{g.titleZh}</p>
                      <p className="text-xs text-muted-foreground">/{g.slug}</p>
                    </td>
                    <td className="px-5 py-3 text-right text-foreground tabular-nums">{g.viewCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-foreground tabular-nums">{g.downloadCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="rounded-xl bg-[#262633] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UsersIcon className="size-4 text-[#00d4ff]" />
            最近注册用户
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">用户</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">邮箱</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">会员</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    暂无用户
                  </td>
                </tr>
              ) : (
                recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
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
                        <span className="text-foreground font-medium">
                          {u.nickname || u.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                    <td className="px-5 py-3">
                      {u.isSubscribed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
                          <CrownIcon className="size-3" />
                          会员
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
