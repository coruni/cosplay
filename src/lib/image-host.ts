/**
 * Generic Chevereto-compatible image host integration.
 *
 * Any Chevereto-based (or Chevereto-API-compatible) host works — the upload
 * endpoint URL, API key and display name are all read from the environment,
 * so nothing is hard-coded to a specific provider (e.g. MoeBox).
 *
 * Chevereto API v1 protocol:
 *   POST <IMAGE_HOST_API_URL>          (default path: /api/1/upload)
 *     multipart/form-data: source (file), nsfw (0/1), title, tags, format=json
 *     Authorization:  X-API-Key: <IMAGE_HOST_API_KEY>
 *
 * Env:
 *   IMAGE_HOST_API_URL  — full upload URL, e.g. https://pic.moebox.io/api/1/upload
 *                         (a bare origin like https://host.com is also accepted;
 *                          the default /api/1/upload path is then appended)
 *   IMAGE_HOST_API_KEY  — API key from the host's settings / API page
 *   IMAGE_HOST_NAME     — optional display name shown in the admin UI
 */

/** Default Chevereto v1 upload endpoint path. */
const DEFAULT_UPLOAD_PATH = '/api/1/upload';

/** Resolve the upload URL; appends the default path for a bare origin. */
export function getImageHostUploadUrl(): string {
  const raw = process.env.IMAGE_HOST_API_URL?.trim();
  if (!raw) return '';
  // Bare origin (no path) → append the default Chevereto v1 upload endpoint.
  if (/^https?:\/\/[^/]+\/?$/i.test(raw)) {
    return raw.replace(/\/+$/, '') + DEFAULT_UPLOAD_PATH;
  }
  return raw;
}

export interface ImageHostUploadOptions {
  /** The image file (web File/Blob from a form upload, or a Node Buffer) */
  file: File | Blob | Buffer;
  filename: string;
  contentType?: string;
  /** Mark as NSFW on the host (sets the nsfw flag). */
  nsfw?: boolean;
  title?: string;
  tags?: string[];
}

export interface ImageHostUploadResult {
  /** Public hosted URL of the uploaded image. */
  url: string;
  /** URL that can delete the file (keep this safe). */
  deleteUrl?: string;
  /** Short encoded id for viewer links. */
  idEncoded?: string;
  /** Thumbnail URL. */
  thumbUrl?: string;
}

/** Whether the external image host is configured (URL + key present). */
export function isImageHostConfigured(): boolean {
  return !!(getImageHostUploadUrl() && process.env.IMAGE_HOST_API_KEY);
}

/** Display name for the host, used in the admin UI. */
export function getImageHostName(): string {
  return process.env.IMAGE_HOST_NAME?.trim() || '外部图床';
}

/** Shape of the Chevereto JSON response (v3/v4 compatible). */
interface CheveretoRawResponse {
  status_code?: number;
  status_txt?: string;
  message?: string;
  success?: boolean;
  image?: {
    url?: string;
    delete_url?: string;
    id_encoded?: string;
    thumb?: { url?: string };
  } | string;
  url?: string;
}

/** Extract the hosted image URL from a Chevereto-style response. */
function extractUrl(data: CheveretoRawResponse | null): string | null {
  if (!data) return null;
  if (data.image && typeof data.image === 'object' && data.image.url) {
    return data.image.url;
  }
  if (typeof data.image === 'string' && data.image) return data.image;
  if (data.url) return data.url;
  return null;
}

/**
 * Upload a single image to the configured host and return its hosted URL.
 * Throws if the backend is not configured or the API rejects the upload.
 */
export async function uploadToImageHost(
  opts: ImageHostUploadOptions
): Promise<ImageHostUploadResult> {
  const apiUrl = getImageHostUploadUrl();
  const apiKey = process.env.IMAGE_HOST_API_KEY?.trim();
  if (!apiUrl || !apiKey) {
    throw new Error(
      'Image host not configured. Set IMAGE_HOST_API_URL and IMAGE_HOST_API_KEY in .env'
    );
  }

  const form = new FormData();
  if (opts.file instanceof Buffer) {
    form.append(
      'source',
      new Blob([opts.file as BlobPart], {
        type: opts.contentType || 'application/octet-stream',
      }),
      opts.filename
    );
  } else {
    // File or Blob — append directly (preserves the original bytes/type)
    form.append('source', opts.file as Blob, opts.filename);
  }
  form.append('nsfw', opts.nsfw ? '1' : '0');
  form.append('format', 'json');
  if (opts.title) form.append('title', opts.title);
  if (opts.tags && opts.tags.length) {
    form.append('tags', opts.tags.join(','));
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Image host upload failed: HTTP ${res.status} ${text.slice(0, 200)}`
    );
  }

  const data = (await res.json().catch(() => null)) as CheveretoRawResponse | null;
  const url = extractUrl(data);
  if (!url) {
    const reason = data?.status_txt || data?.message || 'unknown error';
    throw new Error(`Image host rejected upload: ${reason}`);
  }

  const img =
    data && data.image && typeof data.image === 'object' ? data.image : {};
  return {
    url,
    deleteUrl: img.delete_url,
    idEncoded: img.id_encoded,
    thumbUrl: img.thumb?.url,
  };
}
