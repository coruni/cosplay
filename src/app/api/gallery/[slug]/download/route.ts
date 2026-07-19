import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/gallery/[slug]/download
 *
 * Records a download event (increments downloadCount). Non-fatal: callers
 * fire-and-forget this so a failure never blocks the actual download.
 * Used for both bundled on-site downloads and external (网盘) links.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    await prisma.gallery.updateMany({
      where: { slug },
      data: { downloadCount: { increment: 1 } },
    });
  } catch (e) {
    console.error('download count increment failed:', e);
  }
  return NextResponse.json({ ok: true });
}
