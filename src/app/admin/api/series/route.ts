import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

// GET /admin/api/series — 聚合所有 gallery 中的 series 与角色（角色一般与系列绑定）
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1) 每个 series 出现次数（去空）
  const seriesRows = await prisma.gallery.groupBy({
    by: ['series'],
    _count: { _all: true },
    orderBy: { _count: { series: 'desc' } },
  });

  // 2) (series, character) 组合，用于建立「系列 → 角色」绑定关系
  const scRows = await prisma.gallery.groupBy({
    by: ['series', 'character'],
    _count: { _all: true },
  });

  // 建立 series -> { character: count }
  const seriesChars = new Map<string, Map<string, number>>();
  const charCount = new Map<string, number>();
  for (const r of scRows) {
    const s = (r.series || '').trim();
    const c = (r.character || '').trim();
    if (!c) continue;
    charCount.set(c, (charCount.get(c) || 0) + r._count._all);
    if (!s) continue; // 角色存在但系列为空：仅计入全站角色，不绑定到具体系列
    if (!seriesChars.has(s)) seriesChars.set(s, new Map());
    const m = seriesChars.get(s)!;
    m.set(c, (m.get(c) || 0) + r._count._all);
  }

  const items = seriesRows
    .filter((r) => r.series && r.series.trim())
    .map((r) => {
      const s = r.series!.trim();
      const charsMap = seriesChars.get(s);
      const characters = charsMap
        ? [...charsMap.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([name]) => name)
        : [];
      return {
        series: s,
        galleryCount: r._count._all,
        characters,
      };
    });

  const allCharacters = [...charCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, galleryCount]) => ({ name, galleryCount }));

  return NextResponse.json({ items, allCharacters, total: items.length });
}
