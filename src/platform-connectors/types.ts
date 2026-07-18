/** Supported social video platforms. */
export type Platform = "youtube" | "tiktok" | "instagram";

/** A video ready for upload to a platform. */
export interface UploadRequest {
  /** Absolute path to the rendered video file. */
  videoPath: string;
  /** Title/caption for the post. */
  title: string;
  /** Longer description (especially for YouTube). */
  description: string;
  /** Hashtags / search tags. */
  tags: string[];
  /** Target platform. */
  platform: Platform;
  /** Optional scheduled publish time (platform-dependent support). */
  scheduleAt?: Date;
}

/** Result of a successful upload. */
export interface UploadResult {
  platform: Platform;
  /** Platform-assigned ID for the video/post. */
  platformId: string;
  /** Public URL to the published video. */
  url: string;
  /** When the video was published. */
  publishedAt: Date;
}

/** OAuth / API configuration for a platform connector. */
export interface AuthConfig {
  platform: Platform;
  /** OAuth client ID from the platform's developer console. */
  clientId: string;
  /** OAuth client secret. */
  clientSecret: string;
  /** Redirect URI registered with the platform. */
  redirectUri: string;
  /** OAuth scopes required for upload access. */
  scopes: string[];
}

/** OAuth token pair returned after authorization. */
export interface TokenStore {
  accessToken: string;
  refreshToken?: string;
  /** ISO 8601 timestamp when the access token expires. */
  expiresAt: Date;
}

/**
 * Custom error with platform-specific context for error handling.
 */
export class PlatformUploadError extends Error {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly statusCode?: number,
    public readonly platformErrorCode?: string,
  ) {
    super(message);
    this.name = "PlatformUploadError";
  }

  /** The token has expired and must be refreshed. */
  static expiredToken(platform: Platform): PlatformUploadError {
    return new PlatformUploadError(
      "Access token has expired — refresh before retrying",
      platform,
      401,
      "EXPIRED_TOKEN",
    );
  }

  /** The platform returned a rate-limit response. */
  static rateLimited(platform: Platform, retryAfterSec = 60): PlatformUploadError {
    return new PlatformUploadError(
      `Rate limited by ${platform} (retry after ${retryAfterSec}s)`,
      platform,
      429,
      "RATE_LIMITED",
    );
  }

  /** A generic upload failure. */
  static uploadFailed(
    platform: Platform,
    reason: string,
    statusCode?: number,
  ): PlatformUploadError {
    return new PlatformUploadError(
      `Upload to ${platform} failed: ${reason}`,
      platform,
      statusCode,
      "UPLOAD_FAILED",
    );
  }

  /** Network or transport error. */
  static networkError(platform: Platform, cause: string): PlatformUploadError {
    return new PlatformUploadError(
      `Network error reaching ${platform}: ${cause}`,
      platform,
      undefined,
      "NETWORK_ERROR",
    );
  }
}
