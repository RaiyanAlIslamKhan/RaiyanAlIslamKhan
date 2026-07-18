import fs from "node:fs";
import type { UploadRequest, UploadResult, AuthConfig, TokenStore } from "./types.js";
import { PlatformUploadError } from "./types.js";
import { isTokenExpired } from "./auth.js";

/**
 * YouTube Data API v3 connector.
 *
 * ## Required Google API Scopes
 * - `https://www.googleapis.com/auth/youtube.upload` — upload videos to YouTube
 * - `https://www.googleapis.com/auth/youtube` — manage YouTube account (broader scope)
 *
 * ## Setup Requirements
 * 1. Create a Google Cloud Project
 * 2. Enable the **YouTube Data API v3**
 * 3. Create OAuth 2.0 credentials (Web application type)
 * 4. Configure the OAuth consent screen (external, with test users)
 * 5. The authenticated user must have a **YouTube channel** linked to their Google account
 * 6. API quota: 10,000 units/day by default (one upload ≈ 1,600 units)
 *
 * @see https://developers.google.com/youtube/v3/docs/videos/insert
 */

const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

const YOUTUBE_PUBLISH_URL =
  "https://www.googleapis.com/youtube/v3/videos?part=snippet";

export const YOUTUBE_AUTH_CONFIG: Omit<AuthConfig, "clientId" | "clientSecret" | "redirectUri"> = {
  platform: "youtube",
  scopes: [
    "https://www.googleapis.com/auth/youtube.upload",
  ],
};

/**
 * Upload a video to YouTube Shorts.
 *
 * Uses the YouTube Data API v3 resumable upload flow:
 * 1. POST metadata (snippet + status) to initiate the resumable upload
 * 2. Upload the video bytes to the returned location
 *
 * @param request — video metadata and file path
 * @param token   — valid OAuth access token
 * @returns UploadResult with the YouTube video ID and URL
 *
 * @throws PlatformUploadError for expired tokens, rate limits, or upload failures
 */
export async function uploadToYouTube(
  request: UploadRequest,
  token: TokenStore,
): Promise<UploadResult> {
  if (isTokenExpired(token)) {
    throw PlatformUploadError.expiredToken("youtube");
  }

  // Validate video file exists
  if (!fs.existsSync(request.videoPath)) {
    throw PlatformUploadError.uploadFailed(
      "youtube",
      `Video file not found: ${request.videoPath}`,
    );
  }

  const stats = fs.statSync(request.videoPath);
  const fileSize = stats.size;

  // Step 1: Initiate resumable upload with metadata
  const metadata = {
    snippet: {
      title: request.title.slice(0, 100), // YouTube title limit
      description: request.description.slice(0, 5000),
      tags: request.tags.slice(0, 30), // max 30 tags
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "public",
      ...(request.scheduleAt && {
        publishAt: request.scheduleAt.toISOString(),
        privacyStatus: "private",
      }),
      // Mark as Shorts (vertical video, ≤60s)
      selfDeclaredMadeForKids: false,
    },
  };

  let initiateResponse: Response;
  try {
    initiateResponse = await fetch(YOUTUBE_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(fileSize),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    });
  } catch (err) {
    throw PlatformUploadError.networkError(
      "youtube",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (initiateResponse.status === 401) {
    throw PlatformUploadError.expiredToken("youtube");
  }

  if (initiateResponse.status === 403) {
    // Check for quota exceeded
    const body = await initiateResponse.text().catch(() => "");
    if (body.includes("quotaExceeded")) {
      throw PlatformUploadError.rateLimited("youtube");
    }
    throw PlatformUploadError.uploadFailed("youtube", "Access forbidden (check scopes & quota)", 403);
  }

  if (!initiateResponse.ok) {
    const errorBody = await initiateResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "youtube",
      `Initiate failed (${initiateResponse.status}): ${errorBody.slice(0, 200)}`,
      initiateResponse.status,
    );
  }

  const uploadUrl = initiateResponse.headers.get("location");
  if (!uploadUrl) {
    throw PlatformUploadError.uploadFailed(
      "youtube",
      "No upload location returned from initiate request",
    );
  }

  // Step 2: Upload the video bytes
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
      "youtube",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text().catch(() => "");
    throw PlatformUploadError.uploadFailed(
      "youtube",
      `Upload failed (${uploadResponse.status}): ${errorBody.slice(0, 200)}`,
      uploadResponse.status,
    );
  }

  const result = (await uploadResponse.json()) as { id: string };

  if (!result.id) {
    throw PlatformUploadError.uploadFailed(
      "youtube",
      "Upload response missing video ID",
    );
  }

  return {
    platform: "youtube",
    platformId: result.id,
    url: `https://www.youtube.com/shorts/${result.id}`,
    publishedAt: request.scheduleAt ?? new Date(),
  };
}

/**
 * Helper: fetch YouTube channel ID from the authenticated user.
 * Not used in upload flow, but useful for verifying channel setup.
 */
export async function getYouTubeChannelId(
  token: TokenStore,
): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    },
  );

  if (!response.ok) {
    throw PlatformUploadError.uploadFailed(
      "youtube",
      `Failed to fetch channel: ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    items?: Array<{ id: string }>;
  };

  if (!data.items?.length) {
    throw PlatformUploadError.uploadFailed(
      "youtube",
      "No YouTube channel found — create a channel first",
    );
  }

  return data.items[0].id;
}
