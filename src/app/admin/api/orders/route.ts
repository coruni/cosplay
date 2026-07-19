import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = 20;
  const status = searchParams.get('status') || '';

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') {
    where.status = status;
  }

  const [total, items, stats] = await Promise.all([
    prisma.paymentOrder.count({ where: where as any }),
    prisma.paymentOrder.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { gallery: { select: { slug: true, titleZh: true } } },
    }),
    prisma.paymentOrder.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: 'paid' },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats: {
      totalRevenue: stats._sum.amount || 0,
      totalPaid: stats._count,
    },
  });
}
