import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

interface CategoryName {
  zh?: string;
  en?: string;
  ja?: string;
}

function parseName(raw: unknown): CategoryName | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name: CategoryName = {};
  for (const lang of ['zh', 'en', 'ja'] as const) {
    if (typeof obj[lang] === 'string') name[lang] = obj[lang] as string;
  }
  if (!name.zh && !name.en && !name.ja) return null;
  return name;
}

// GET /admin/api/categories — list all (sorted by sortOrder)
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(categories);
}

// POST /admin/api/categories — create
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const slug = String(body.slug || '').trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'slug 只能包含小写字母、数字和连字符' },
      { status: 400 }
    );
  }
  const name = parseName(body.name);
  if (!name) {
    return NextResponse.json(
      { error: '请至少填写一种语言的分类名称（中/英/日）' },
      { status: 400 }
    );
  }

  try {
    const category = await prisma.category.create({
      data: {
        slug,
        name: name as Prisma.InputJsonValue,
        icon: String(body.icon || '📷'),
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: '该 slug 已存在' }, { status: 409 });
    }
    console.error('[Category Create]', e);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT /admin/api/categories — update
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.slug === 'string') {
    const slug = body.slug.trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'slug 只能包含小写字母、数字和连字符' },
        { status: 400 }
      );
    }
    data.slug = slug;
  }
  if (body.name !== undefined) {
    const name = parseName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: '请至少填写一种语言的分类名称（中/英/日）' },
        { status: 400 }
      );
    }
    data.name = name as Prisma.InputJsonValue;
  }
  if (body.icon !== undefined) data.icon = String(body.icon || '📷');
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

  try {
    const category = await prisma.category.update({ where: { id }, data });
    return NextResponse.json(category);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: '该 slug 已存在' }, { status: 409 });
    }
    console.error('[Category Update]', e);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE /admin/api/categories?id=...
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Category Delete]', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
