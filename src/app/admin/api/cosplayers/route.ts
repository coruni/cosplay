import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

// GET /admin/api/cosplayers — 聚合所有 gallery 中的 cosplayer 字段
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // groupBy 不能直接返回 count by gallery 数，但可以聚合出现次数
  const rows = await prisma.gallery.groupBy({
    by: ['cosplayer'],
    _count: { _all: true },
    orderBy: { _count: { cosplayer: 'desc' } },
  });

  const items = rows
    .filter((r) => r.cosplayer && r.cosplayer.trim())
    .map((r) => ({
      name: r.cosplayer!.trim(),
      galleryCount: r._count._all,
    }));

  return NextResponse.json({ items, total: items.length });
}
