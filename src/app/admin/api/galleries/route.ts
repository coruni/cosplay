import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { invalidateGalleryCaches, ensureUniqueSlug } from '@/lib/data';
import { validateToken, getTokenFromCookies } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

const SLUG_RE = /^[a-z0-9-]+$/;
const RATING_VALUES = ['sfw', 'nsfw'] as const;
type RatingValue = (typeof RATING_VALUES)[number];

/** Body shape we are willing to accept from the admin client. */
interface GalleryInput {
  slug?: string;
  titleZh?: string;
  titleEn?: string;
  titleJa?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  descriptionJa?: string;
  cosplayer?: string;
  character?: string;
  series?: string;
  cover?: string;
  images?: string[];
  categories?: string[];
  tags?: string[];
  rating?: string;
  price?: number;
  isPremium?: boolean;
  downloadUrl?: string | null;
}

/**
 * Whitelist + coerce the raw request body into a Prisma-shaped payload.
 * Strips anything we don't recognize (id / createdAt / viewCount / etc).
 * Throws on hard validation errors (bad slug, bad rating, wrong types).
 */
function pickGalleryFields(
  body: Record<string, unknown>
): Prisma.GalleryCreateInput {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : undefined;
  const strArr = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    return v.filter((x): x is string => typeof x === 'string');
  };
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const bool = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : undefined;

  const slug = str(body.slug)?.trim();
  if (!slug) throw new Error('请填写 Slug');
  if (!SLUG_RE.test(slug)) {
    throw new Error('Slug 只能包含小写字母、数字和连字符');
  }

  const titleZh = str(body.titleZh)?.trim();
  if (!titleZh) throw new Error('请填写中文标题');

  const cover = str(body.cover);
  if (!cover) throw new Error('请上传封面图');

  const images = strArr(body.images) ?? [];
  if (images.length === 0) throw new Error('请至少上传一张图包图片');

  const ratingRaw = str(body.rating) ?? 'sfw';
  if (!RATING_VALUES.includes(ratingRaw as RatingValue)) {
    throw new Error(`rating 必须是 ${RATING_VALUES.join(' / ')}`);
  }
  const rating = ratingRaw as RatingValue;

  const price = num(body.price) ?? 0;
  const isPremium = bool(body.isPremium) ?? false;
  const downloadUrlRaw = body.downloadUrl;
  const downloadUrl =
    downloadUrlRaw === null || downloadUrlRaw === ''
      ? null
      : typeof downloadUrlRaw === 'string'
        ? downloadUrlRaw.trim() || null
        : null;

  return {
    slug,
    titleZh,
    titleEn: str(body.titleEn) ?? '',
    titleJa: str(body.titleJa) ?? '',
    descriptionZh: str(body.descriptionZh) ?? '',
    descriptionEn: str(body.descriptionEn) ?? '',
    descriptionJa: str(body.descriptionJa) ?? '',
    cosplayer: str(body.cosplayer) ?? '',
    character: str(body.character) ?? '',
    series: str(body.series) ?? '',
    cover,
    images,
    categories: strArr(body.categories) ?? [],
    tags: strArr(body.tags) ?? [],
    rating,
    price,
    isPremium,
    downloadUrl,
  };
}

/**
 * Whitelist for PUT (partial update). Only fields actually present in the
 * body are validated + returned; absent fields are left untouched by Prisma.
 */
function pickGalleryPatch(
  body: Record<string, unknown>
): Prisma.GalleryUpdateInput {
  const patch: Prisma.GalleryUpdateInput = {};

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : undefined;
  const strArr = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    return v.filter((x): x is string => typeof x === 'string');
  };
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const bool = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : undefined;

  if (body.slug !== undefined) {
    const slug = str(body.slug)?.trim();
    if (!slug) throw new Error('Slug 不能为空');
    if (!SLUG_RE.test(slug)) {
      throw new Error('Slug 只能包含小写字母、数字和连字符');
    }
    patch.slug = slug;
  }
  if (body.titleZh !== undefined) {
    const v = str(body.titleZh)?.trim();
    if (!v) throw new Error('中文标题不能为空');
    patch.titleZh = v;
  }
  if (body.titleEn !== undefined) patch.titleEn = str(body.titleEn) ?? '';
  if (body.titleJa !== undefined) patch.titleJa = str(body.titleJa) ?? '';
  if (body.descriptionZh !== undefined)
    patch.descriptionZh = str(body.descriptionZh) ?? '';
  if (body.descriptionEn !== undefined)
    patch.descriptionEn = str(body.descriptionEn) ?? '';
  if (body.descriptionJa !== undefined)
    patch.descriptionJa = str(body.descriptionJa) ?? '';
  if (body.cosplayer !== undefined) patch.cosplayer = str(body.cosplayer) ?? '';
  if (body.character !== undefined) patch.character = str(body.character) ?? '';
  if (body.series !== undefined) patch.series = str(body.series) ?? '';
  if (body.cover !== undefined) {
    const v = str(body.cover);
    if (!v) throw new Error('封面图不能为空');
    patch.cover = v;
  }
  if (body.images !== undefined) {
    const arr = strArr(body.images) ?? [];
    if (arr.length === 0) throw new Error('请至少上传一张图包图片');
    patch.images = arr;
  }
  if (body.categories !== undefined)
    patch.categories = strArr(body.categories) ?? [];
  if (body.tags !== undefined) patch.tags = strArr(body.tags) ?? [];
  if (body.rating !== undefined) {
    const v = str(body.rating);
    if (!v || !RATING_VALUES.includes(v as RatingValue)) {
      throw new Error(`rating 必须是 ${RATING_VALUES.join(' / ')}`);
    }
    patch.rating = v as RatingValue;
  }
  if (body.price !== undefined) patch.price = num(body.price) ?? 0;
  if (body.isPremium !== undefined) patch.isPremium = bool(body.isPremium) ?? false;
  if (body.downloadUrl !== undefined) {
    const v = body.downloadUrl;
    patch.downloadUrl =
      v === null || v === '' || (typeof v === 'string' && !v.trim())
        ? null
        : typeof v === 'string'
          ? v.trim()
          : null;
  }

  return patch;
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

  const where: Prisma.GalleryWhereInput = {};
  if (query) {
    // Search across the same fields the public site searches (titles, meta,
    // tags) so admins can find a gallery by JP title, character name, etc.
    where.OR = [
      { titleZh: { contains: query, mode: 'insensitive' } },
      { titleEn: { contains: query, mode: 'insensitive' } },
      { titleJa: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
      { cosplayer: { contains: query, mode: 'insensitive' } },
      { character: { contains: query, mode: 'insensitive' } },
      { series: { contains: query, mode: 'insensitive' } },
      { tags: { hasSome: [query] } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.gallery.count({ where }),
    prisma.gallery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST /admin/api/galleries — create
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let data: Prisma.GalleryCreateInput;
  try {
    data = pickGalleryFields(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '参数错误' },
      { status: 400 }
    );
  }

  try {
    // Pre-check + auto-deduplicate slug to avoid P2002 collisions.
    data.slug = await ensureUniqueSlug(data.slug);
    const gallery = await prisma.gallery.create({ data });
    await invalidateGalleryCaches();
    return NextResponse.json(gallery, { status: 201 });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      // Race condition: slug was taken between ensureUniqueSlug and create.
      return NextResponse.json(
        { error: '该 slug 已存在，请重试或修改 slug' },
        { status: 409 }
      );
    }
    console.error('[Gallery Create]', e);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT /admin/api/galleries — update
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : undefined;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  let data: Prisma.GalleryUpdateInput;
  try {
    data = pickGalleryPatch(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '参数错误' },
      { status: 400 }
    );
  }

  try {
    const gallery = await prisma.gallery.update({ where: { id }, data });
    await invalidateGalleryCaches();
    return NextResponse.json(gallery);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: '该 slug 已存在' },
        { status: 409 }
      );
    }
    console.error('[Gallery Update]', e);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
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

  try {
    await prisma.gallery.delete({ where: { id } });
    await invalidateGalleryCaches();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Gallery Delete]', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
