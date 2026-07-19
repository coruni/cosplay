import { NextRequest, NextResponse } from 'next/server';
import { validateToken, getTokenFromCookies } from '@/lib/auth';
import {
  createPresignedUploadUrl,
  buildS3Key,
  isS3Configured,
} from '@/lib/s3';

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

const MAX_KEY_LENGTH = 500;

/**
 * POST /admin/api/upload
 *
 * Request body: { filename: string; contentType: string; folder?: string }
 * Response:     { key: string; uploadUrl: string }
 *
 * Returns a presigned PUT URL the client uses to upload directly to S3.
 */
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      {
        error:
          'S3 storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY in .env',
      },
      { status: 503 }
    );
  }

  let body: { filename?: string; contentType?: string; folder?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { filename, contentType, folder } = body;

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: 'Missing filename or contentType' },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${contentType}` },
      { status: 415 }
    );
  }

  const safeFolder = (folder || 'uploads').replace(/^\/+|\/+$/g, '');
  const key = buildS3Key(safeFolder, filename);
  if (key.length > MAX_KEY_LENGTH) {
    return NextResponse.json(
      { error: 'Generated key too long' },
      { status: 400 }
    );
  }

  try {
    const uploadUrl = await createPresignedUploadUrl({ key, contentType });
    return NextResponse.json({ key, uploadUrl });
  } catch (e) {
    console.error('Presign failed:', e);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
