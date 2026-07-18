import type { UploadRequest, UploadResult, AuthConfig, Platform, TokenStore } from "./types.js";
import { uploadToYouTube, YOUTUBE_AUTH_CONFIG } from "./youtube.js";
import { uploadToTikTok, TIKTOK_AUTH_CONFIG } from "./tiktok.js";
import {
  uploadToInstagram,
  INSTAGRAM_AUTH_CONFIG,
  getInstagramUserId,
} from "./instagram.js";

/**
 * Common interface implemented by every platform connector.
 */
export interface PlatformConnector {
  /** Upload a video to the platform. */
  upload(req: UploadRequest, token: TokenStore): Promise<UploadResult>;

  /** Get the OAuth config (scopes, platform info) for this connector. */
  getAuthConfig(): Omit<AuthConfig, "clientId" | "clientSecret" | "redirectUri">;
}

// ── Connector implementations ──────────────────────────────────────────────

const youtubeConnector: PlatformConnector = {
  upload: uploadToYouTube,
  getAuthConfig: () => YOUTUBE_AUTH_CONFIG,
};

const tiktokConnector: PlatformConnector = {
  upload: uploadToTikTok,
  getAuthConfig: () => TIKTOK_AUTH_CONFIG,
};

const instagramConnector: PlatformConnector = {
  upload: uploadToInstagram,
  getAuthConfig: () => INSTAGRAM_AUTH_CONFIG,
};

const connectors: Record<Platform, PlatformConnector> = {
  youtube: youtubeConnector,
  tiktok: tiktokConnector,
  instagram: instagramConnector,
};

/**
 * Get the platform connector for the given platform.
 *
 * @param platform — "youtube", "tiktok", or "instagram"
 * @returns A PlatformConnector with `upload()` and `getAuthConfig()` methods.
 *
 * @example
 * ```ts
 * const connector = getConnector("youtube");
 * const result = await connector.upload(request, tokenStore);
 * ```
 */
export function getConnector(platform: Platform): PlatformConnector {
  return connectors[platform];
}

/**
 * Get all available platform connectors.
 */
export function getAllConnectors(): Record<Platform, PlatformConnector> {
  return { ...connectors };
}
