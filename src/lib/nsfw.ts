import 'server-only';
import { cookies } from 'next/headers';
import { NSFW_COOKIE } from '@/lib/nsfw-shared';

/**
 * Server-side read of the NSFW visibility preference from the request cookie.
 *
 * This is the single source of truth for NSFW filtering. Server components read
 * this and push a `rating` filter down to the database layer, so NSFW rows are
 * NEVER fetched/serialized to the client unless the user has opted in.
 *
 * @returns true if the user opted in to see NSFW content, false otherwise.
 */
export async function getShowNsfwServer(): Promise<boolean> {
  const store = await cookies();
  return store.get(NSFW_COOKIE)?.value === '1';
}
