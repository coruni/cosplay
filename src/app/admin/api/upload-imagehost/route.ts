import { NextRequest, NextResponse } from 'next/server';
import { validateToken, getTokenFromCookies } from '@/lib/auth';
import {
  uploadToImageHost,
  isImageHostConfigured,
  getImageHostName,
} from '@/lib/image-host';

function checkAuth(request: NextRequest): boolean {
  const token = getTokenFromCookies(request.headers.get('cookie'));
  return !!token && validateToken(token);
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * POST /admin/api/upload-imagehost
 *
 * Receives a multipart file from the admin uploader, proxies it to the
 * configured external image host (server-side, so the secret API key never
 * reaches the browser), and returns the public hosted URL:
 *   { url: string; deleteUrl?: string; idEncoded?: string }
 *
 * Optional form fields: nsfw (0/1), title, tags (comma separated).
 */
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isImageHostConfigured()) {
    return NextResponse.json(
      {
        error:
          'Image host is not configured. Set IMAGE_HOST_API_URL and IMAGE_HOST_API_KEY in .env',
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large (max 25MB)' },
      { status: 413 }
    );
  }

  const nsfwRaw = form.get('nsfw');
  const nsfw = nsfwRaw === '1' || nsfwRaw === 'true';
  const title = (form.get('title') as string) || undefined;
  const tagsRaw = form.get('tags') as string | null;
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  try {
    const result = await uploadToImageHost({
      file,
      filename: file.name,
      contentType: file.type,
      nsfw,
      title,
      tags,
    });
    return NextResponse.json({
      url: result.url,
      deleteUrl: result.deleteUrl,
      idEncoded: result.idEncoded,
    });
  } catch (e) {
    console.error(`[${getImageHostName()} upload] Error:`, e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Image host upload failed',
      },
      { status: 502 }
    );
  }
}
