import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

// GET /admin/api/users — list + stats
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = 20;
  const query = searchParams.get('query') || '';
  const filter = searchParams.get('filter') || ''; // '' | all | subscribed | free

  const where: Record<string, unknown> = {};
  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { username: { contains: query, mode: 'insensitive' } },
      { nickname: { contains: query, mode: 'insensitive' } },
    ];
  }
  if (filter === 'subscribed') where.isSubscribed = true;
  if (filter === 'free') where.isSubscribed = false;

  const [total, items, totalUsers, totalSubscribed] = await Promise.all([
    prisma.user.count({ where: where as any }),
    prisma.user.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        username: true,
        nickname: true,
        avatar: true,
        isSubscribed: true,
        subscriptionEndAt: true,
        quotaTotal: true,
        quotaUsed: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isSubscribed: true } }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats: {
      totalUsers,
      totalSubscribed,
    },
  });
}

// PUT /admin/api/users — admin actions
// body: { id, action }  action: 'resetQuota' | 'cancelSub'
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, action } = await request.json();
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }

    let data: Record<string, unknown> = {};
    if (action === 'resetQuota') {
      data = { quotaUsed: 0 };
    } else if (action === 'cancelSub') {
      data = { isSubscribed: false, subscriptionEndAt: null };
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { id }, data });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
