import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateGalleryCaches } from '@/lib/data';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

// GET /admin/api/galleries — list all
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = 20;
  const query = searchParams.get('query') || '';

  const where: Record<string, unknown> = {};
  if (query) {
    where.OR = [
      { titleZh: { contains: query, mode: 'insensitive' } },
      { titleEn: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.gallery.count({ where: where as any }),
    prisma.gallery.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// POST /admin/api/galleries — create
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const gallery = await prisma.gallery.create({ data: body });
  await invalidateGalleryCaches();

  return NextResponse.json(gallery, { status: 201 });
}

// PUT /admin/api/galleries — update
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const gallery = await prisma.gallery.update({ where: { id }, data });
  await invalidateGalleryCaches();

  return NextResponse.json(gallery);
}

// DELETE /admin/api/galleries — delete
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  await prisma.gallery.delete({ where: { id } });
  await invalidateGalleryCaches();

  return NextResponse.json({ success: true });
}
