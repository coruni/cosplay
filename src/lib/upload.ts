'use client';

/**
 * Client-side image upload helpers.
 *
 * Two backends are supported:
 *
 *  - "s3"     (default): POST /admin/api/upload → { key, uploadUrl }, then PUT
 *             the file directly to the presigned URL (bypasses our server).
 *             Returns the S3 key to store in the DB.
 *
 *  - "imagehost": POST multipart/form-data to /admin/api/upload-imagehost.
 *             The server proxies the file to the configured Chevereto-compatible
 *             host (the secret API key never leaves the server) and returns the
 *             hosted URL, which is stored directly. resolveImageUrl() passes
 *             full URLs through. The endpoint/key are read from IMAGE_HOST_*
 *             env vars, so any compatible host works.
 *
 * Uses XMLHttpRequest for upload progress reporting.
 */

export type UploadProvider = 's3' | 'imagehost';

interface UploadOptions {
  /** Which backend to use. Defaults to "s3". */
  provider?: UploadProvider;
  /** Mark the image as NSFW when uploading to the external image host. */
  nsfw?: boolean;
  /** Optional title passed to the image host. */
  title?: string;
  /** Optional tags passed to the image host. */
  tags?: string[];
}

interface PresignResponse {
  key: string;
  uploadUrl: string;
}

async function getPresignedUrl(opts: {
  filename: string;
  contentType: string;
  folder: string;
}): Promise<PresignResponse> {
  const res = await fetch('/admin/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Failed to get upload URL (${res.status})`);
  }
  return res.json();
}

/**
 * Upload a single image file.
 *
 * @param file       The File to upload
 * @param folder     S3 folder prefix, e.g. "galleries/nier-2b" (unused by image host)
 * @param onProgress Optional progress callback (0–100)
 * @param options    Backend selection + metadata
 * @returns The stored reference: an S3 key ("s3") or a full URL ("imagehost")
 */
export async function uploadImage(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void,
  options?: UploadOptions
): Promise<string> {
  const provider = options?.provider ?? 's3';
  if (provider === 'imagehost') {
    return uploadToImageHost(file, onProgress, options);
  }
  return uploadToS3(file, folder, onProgress);
}

/** S3 path: presigned URL → direct PUT. Returns the S3 key. */
async function uploadToS3(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const { key, uploadUrl } = await getPresignedUrl({
    filename: file.name,
    contentType: file.type,
    folder,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    });
    xhr.addEventListener('error', () =>
      reject(new Error('Upload failed: network error'))
    );
    xhr.addEventListener('abort', () =>
      reject(new Error('Upload aborted'))
    );

    xhr.send(file);
  });

  return key;
}

/** Image-host path: multipart POST to our server proxy. Returns the hosted URL. */
function uploadToImageHost(
  file: File,
  onProgress?: (percent: number) => void,
  options?: UploadOptions
): Promise<string> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('nsfw', options?.nsfw ? '1' : '0');
  if (options?.title) form.append('title', options.title);
  if (options?.tags && options.tags.length) {
    form.append('tags', options.tags.join(','));
  }

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/admin/api/upload-imagehost');

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url?: string; error?: string };
          if (data.url) resolve(data.url);
          else reject(new Error(data.error || 'Image host returned no URL'));
        } catch {
          reject(new Error('Invalid response from upload server'));
        }
      } else if (xhr.status === 401) {
        reject(new Error('Unauthorized'));
      } else {
        let msg = `Upload failed: HTTP ${xhr.status}`;
        try {
          const d = JSON.parse(xhr.responseText) as { error?: string };
          if (d.error) msg = d.error;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () =>
      reject(new Error('Upload failed: network error'))
    );
    xhr.addEventListener('abort', () =>
      reject(new Error('Upload aborted'))
    );

    xhr.send(form);
  });
}
