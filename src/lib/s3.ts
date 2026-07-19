import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3-compatible object storage helper.
 *
 * Works with AWS S3, Cloudflare R2, MinIO, and any S3-compatible provider.
 *
 * Env vars:
 *   S3_BUCKET              — bucket name (required for upload)
 *   S3_REGION              — region (use 'auto' for R2; default 'us-east-1' for AWS)
 *   S3_ENDPOINT            — endpoint URL for R2/MinIO; leave empty for AWS S3
 *   S3_ACCESS_KEY          — access key id (server-only, secret)
 *   S3_SECRET_KEY          — secret access key (server-only, secret)
 *   NEXT_PUBLIC_S3_PUBLIC_URL — public base URL for serving images (client-safe)
 *                               e.g. https://cdn.example.com or https://bucket.s3.region.amazonaws.com
 */

let client: S3Client | null = null;

/** Get a singleton S3 client (server-only). */
export function getS3Client(): S3Client {
  if (client) return client;

  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 credentials not configured. Set S3_ACCESS_KEY and S3_SECRET_KEY in .env'
    );
  }

  const region = process.env.S3_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || undefined;

  client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

/** Whether S3 upload is configured (bucket + credentials present). */
export function isS3Configured(): boolean {
  return !!(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY
  );
}

/**
 * Resolve a stored image reference to a full URL.
 *
 * - Full URLs (http/https) and local paths (leading /) pass through unchanged
 *   (backward compatibility with existing /images/sfw/* entries).
 * - Anything else is treated as an S3 key and resolved via the public URL.
 *
 * Works on both server and client (uses NEXT_PUBLIC_ var).
 */
export function resolveImageUrl(key: string): string {
  if (!key) return '';

  // Backward compat: already-resolved URLs and local public paths
  if (
    key.startsWith('http://') ||
    key.startsWith('https://') ||
    key.startsWith('/')
  ) {
    return key;
  }

  // S3 key — prefer the public (client-safe) base URL
  const publicUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, '')}/${key}`;
  }

  // Server-side fallback: construct from bucket + endpoint
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  if (bucket && endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
  }
  if (bucket) {
    const region = process.env.S3_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  // Nothing configured — return as-is (will likely 404 but won't crash)
  return key;
}

/**
 * Generate a presigned PUT URL for client-side direct upload to S3.
 * Server-only (uses secret credentials).
 */
export async function createPresignedUploadUrl(opts: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const { key, contentType, expiresIn = 600 } = opts;
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not configured');

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Build a unique S3 key for an uploaded file.
 * Format: <folder>/<timestamp>-<random>-<sanitized-filename>
 */
export function buildS3Key(folder: string, filename: string): string {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${cleanFolder}/${timestamp}-${random}-${safeName}`;
}
