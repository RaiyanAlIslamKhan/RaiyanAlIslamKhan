import fs from "node:fs";
import type { UploadRequest, UploadResult, AuthConfig, TokenStore } from "./types.js";
import { PlatformUploadError } from "./types.js";
import { isTokenExpired } from "./auth.js";

/**
 * TikTok Content Posting API connector.
 *
 * ## Required TikTok API Scopes
 * - `video.upload` — upload videos to TikTok
 * - `video.publish` — publish uploaded videos
 *
 * ## Setup Requirements
 * 1. Create a TikTok for Developers app (https://developers.tiktok.com)
 * 2. Complete **app review** and **business verification**
 * 3. The Content Posting API requires explicit approval — it is NOT available
 *    by default. You must request this scope during app review.
 * 4. Videos must be ≤10 minutes and meet TikTok's format requirements
 *    (MP4, H.264, ≤1 GB, 9:16 recommended).
 *
 * ## Upload Flow
 * 1. `POST /v2/video/upload/init/` — request an upload URL
 * 2. `PUT <upload_url>` — upload raw bytes
 * 3. `POST /v2/video/publish/` — publish with metadata (status check loop)
 *
 * @see https://developers.tiktok.com/doc/content-posting-api-reference/
 */

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export const TIKTOK_AUTH_CONFIG: Omit<AuthConfig, "clientId" | "clientSecret" | "redirectUri"> = {
  platform: "tiktok",
  scopes: [
    "video.upload",
    "video.publish",
  ],
};

/**
 * Upload and publish a video to TikTok.
 *
 * @param request — video metadata and file path
 * @param token   — valid OAuth access token
 * @returns UploadResult with the TikTok video ID and URL
 *
 * @throws PlatformUploadError for expired tokens, rate limits, upload failures
 */
export async function uploadToTikTok(
  request: UploadRequest,
  token: TokenStore,
): Promise<UploadResult> {
  if (isTokenExpired(token)) {
    throw PlatformUploadError.expiredToken("tiktok");
  }

  if (!fs.existsSync(request.videoPath)) {
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      `Video file not found: ${request.videoPath}`,
    );
  }

  const stats = fs.statSync(request.videoPath);
  const fileSize = stats.size;

  const authHeader = { Authorization: `Bearer ${token.accessToken}` };

  // ── Step 1: Initiate upload ─────────────────────────────────────────
  const initBody = {
    source: "FILE_UPLOAD",
    video_size: fileSize,
    file_name: request.videoPath.split("/").pop() ?? "video.mp4",
  };

  let initResponse: Response;
  try {
    initResponse = await fetch(`${TIKTOK_API_BASE}/video/upload/init/`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initBody),
    });
  } catch (err) {
    throw PlatformUploadError.networkError(
      "tiktok",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (initResponse.status === 401) {
    throw PlatformUploadError.expiredToken("tiktok");
  }

  if (initResponse.status === 429) {
    throw PlatformUploadError.rateLimited("tiktok");
  }

  if (!initResponse.ok) {
    const errorBody = await initResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      `Upload init failed (${initResponse.status}): ${errorBody.slice(0, 200)}`,
      initResponse.status,
    );
  }

  const initData = (await initResponse.json()) as {
    data?: {
      upload_url?: string;
      publish_id?: string;
    };
    error?: { code: string; message: string };
  };

  if (initData.error) {
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      `API error: ${initData.error.code} — ${initData.error.message}`,
    );
  }

  const uploadUrl = initData.data?.upload_url;
  const publishId = initData.data?.publish_id;

  if (!uploadUrl) {
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      "No upload_url in init response",
    );
  }

  // ── Step 2: Upload bytes ────────────────────────────────────────────
  const videoBuffer = fs.readFileSync(request.videoPath);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileSize),
      },
      body: videoBuffer,
    });
  } catch (err) {
    throw PlatformUploadError.networkError(
      "tiktok",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      `Byte upload failed (${uploadResponse.status}): ${errorBody.slice(0, 200)}`,
      uploadResponse.status,
    );
  }

  // ── Step 3: Publish ─────────────────────────────────────────────────
  const publishBody: Record<string, unknown> = {
    publish_id: publishId,
    title: request.title.slice(0, 150),
    privacy_level: "PUBLIC",
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
  };

  if (request.scheduleAt) {
    publishBody.scheduled_at = Math.floor(request.scheduleAt.getTime() / 1000);
  }

  let publishResponse: Response;
  try {
    publishResponse = await fetch(`${TIKTOK_API_BASE}/video/publish/`, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publishBody),
    });
  } catch (err) {
    throw PlatformUploadError.networkError(
      "tiktok",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (publishResponse.status === 401) {
    throw PlatformUploadError.expiredToken("tiktok");
  }

  if (publishResponse.status === 429) {
    throw PlatformUploadError.rateLimited("tiktok");
  }

  if (!publishResponse.ok) {
    const errorBody = await publishResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      `Publish failed (${publishResponse.status}): ${errorBody.slice(0, 200)}`,
      publishResponse.status,
    );
  }

  const publishData = (await publishResponse.json()) as {
    data?: {
      publish_id?: string;
      status?: string;
      video_id?: string;
    };
    error?: { code: string; message: string };
  };

  if (publishData.error) {
    throw PlatformUploadError.uploadFailed(
      "tiktok",
      `Publish error: ${publishData.error.code} — ${publishData.error.message}`,
    );
  }

  const videoId = publishData.data?.video_id ?? publishId ?? "unknown";
  const creatorId = "me"; // TikTok returns the creator in the OAuth flow

  return {
    platform: "tiktok",
    platformId: videoId,
    url: `https://www.tiktok.com/@${creatorId}/video/${videoId}`,
    publishedAt: request.scheduleAt ?? new Date(),
  };
}
