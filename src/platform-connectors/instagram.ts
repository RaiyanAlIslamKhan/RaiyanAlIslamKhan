import fs from "node:fs";
import type { UploadRequest, UploadResult, AuthConfig, TokenStore } from "./types.js";
import { PlatformUploadError } from "./types.js";
import { isTokenExpired } from "./auth.js";

/**
 * Instagram Graph API connector (via Facebook).
 *
 * ## Required Facebook API Scopes
 * - `instagram_basic` — access Instagram profile
 * - `instagram_content_publish` — publish videos to Instagram
 * - `pages_show_list` — list Facebook Pages
 * - `pages_read_engagement` — read Page engagement (needed for content publish)
 *
 * ## Setup Requirements
 * 1. Create a Facebook App (https://developers.facebook.com)
 * 2. Add the **Instagram Graph API** product
 * 3. Configure OAuth with the scopes above
 * 4. The authenticated user must have:
 *    - An **Instagram Professional** (Business or Creator) account
 *    - That Instagram account must be **connected to a Facebook Page**
 *    - The user must have a **role** on that Facebook Page
 * 5. Instagram Reels: 9:16 vertical video, ≤90 seconds
 *
 * ## Media Publish Flow
 * 1. `POST /{ig-user-id}/media` — create a media container
 * 2. Poll `GET /{ig-user-id}/media?fields=status_code` until status is FINISHED
 * 3. `POST /{ig-user-id}/media_publish` — publish the container
 *
 * @see https://developers.facebook.com/docs/instagram-api/guides/content-publishing/
 */

const IG_API_BASE = "https://graph.facebook.com/v18.0";

/** The Instagram user ID must be provided externally (retrieved after auth). */
let defaultInstagramUserId: string | undefined;

export const INSTAGRAM_AUTH_CONFIG: Omit<AuthConfig, "clientId" | "clientSecret" | "redirectUri"> = {
  platform: "instagram",
  scopes: [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
  ],
};

/**
 * Set the Instagram Business/Professional user ID for uploads.
 * This is obtained from the Instagram Graph API after authentication
 * via `GET /me/accounts?fields=instagram_business_account`.
 */
export function setInstagramUserId(userId: string): void {
  defaultInstagramUserId = userId;
}

/**
 * Get the stored Instagram user ID.
 */
export function getInstagramUserId(): string | undefined {
  return defaultInstagramUserId;
}

/**
 * Upload and publish a video to Instagram Reels.
 *
 * Uses the two-step media publish flow:
 * 1. Create a media container with video URL or upload bytes
 * 2. Publish the container once processed
 *
 * @param request — video metadata and file path
 * @param token   — valid OAuth access token
 * @param igUserId — (optional) Instagram user ID; uses default if not provided
 * @returns UploadResult with the Instagram media ID and URL
 *
 * @throws PlatformUploadError for expired tokens, rate limits, upload failures
 */
export async function uploadToInstagram(
  request: UploadRequest,
  token: TokenStore,
  igUserId?: string,
): Promise<UploadResult> {
  const userId = igUserId ?? defaultInstagramUserId;

  if (!userId) {
    throw PlatformUploadError.uploadFailed(
      "instagram",
      "No Instagram user ID configured — call setInstagramUserId() first",
    );
  }

  if (isTokenExpired(token)) {
    throw PlatformUploadError.expiredToken("instagram");
  }

  if (!fs.existsSync(request.videoPath)) {
    throw PlatformUploadError.uploadFailed(
      "instagram",
      `Video file not found: ${request.videoPath}`,
    );
  }

  const authHeader = { Authorization: `Bearer ${token.accessToken}` };

  // ── Step 1: Create media container ──────────────────────────────────
  // Instagram requires a publicly accessible video URL. Since this is
  // a connector for the ClipFlow backend, we assume the video is hosted
  // at a URL. For the MVP, we use a direct upload approach.
  //
  // NOTE: Instagram's content publish API requires the video to be hosted
  // at a publicly accessible URL. The video_url parameter is used here.
  // In production, ClipFlow would upload the video to cloud storage first
  // and pass the URL. The connector currently passes a placeholder.

  const caption = `${request.title}\n\n${request.description}`.slice(0, 2200);
  const hashtags = request.tags
    .map((t) => `#${t.replace(/^#/, "")}`)
    .join(" ")
    .slice(0, 30);

  const captionWithTags = `${caption}\n\n${hashtags}`.trim();

  // For the media container, Instagram needs the video as a URL or
  // a local file upload. We represent this with a "video_url" parameter
  // pointing to the file path (in production this would be a CDN URL).
  const containerBody = new URLSearchParams({
    media_type: "REELS",
    video_url: `file://${request.videoPath}`, // placeholder — real URL in production
    caption: captionWithTags,
    ...(request.scheduleAt && {
      // Instagram doesn't support scheduling via Graph API directly;
      // this would need a third-party scheduler.
    }),
  });

  let containerResponse: Response;
  try {
    containerResponse = await fetch(
      `${IG_API_BASE}/${userId}/media`,
      {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: containerBody,
      },
    );
  } catch (err) {
    throw PlatformUploadError.networkError(
      "instagram",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (containerResponse.status === 401) {
    throw PlatformUploadError.expiredToken("instagram");
  }

  if (containerResponse.status === 429) {
    throw PlatformUploadError.rateLimited("instagram");
  }

  if (!containerResponse.ok) {
    const errorBody = await containerResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "instagram",
      `Container creation failed (${containerResponse.status}): ${errorBody.slice(0, 200)}`,
      containerResponse.status,
    );
  }

  const containerData = (await containerResponse.json()) as { id: string };
  const containerId = containerData.id;

  if (!containerId) {
    throw PlatformUploadError.uploadFailed(
      "instagram",
      "No container ID returned from media creation",
    );
  }

  // ── Step 2: Publish the container ───────────────────────────────────
  const publishBody = new URLSearchParams({
    creation_id: containerId,
  });

  let publishResponse: Response;
  try {
    publishResponse = await fetch(
      `${IG_API_BASE}/${userId}/media_publish`,
      {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: publishBody,
      },
    );
  } catch (err) {
    throw PlatformUploadError.networkError(
      "instagram",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (publishResponse.status === 401) {
    throw PlatformUploadError.expiredToken("instagram");
  }

  if (publishResponse.status === 429) {
    throw PlatformUploadError.rateLimited("instagram");
  }

  if (!publishResponse.ok) {
    const errorBody = await publishResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "instagram",
      `Publish failed (${publishResponse.status}): ${errorBody.slice(0, 200)}`,
      publishResponse.status,
    );
  }

  const publishData = (await publishResponse.json()) as { id: string };
  const mediaId = publishData.id;

  return {
    platform: "instagram",
    platformId: mediaId,
    url: `https://www.instagram.com/reel/${mediaId}/`,
    publishedAt: request.scheduleAt ?? new Date(),
  };
}
