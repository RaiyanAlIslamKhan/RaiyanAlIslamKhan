import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import nock from "nock";

import { getAuthUrl, exchangeCodeForToken, refreshAccessToken, isTokenExpired, OAUTH_ENDPOINTS } from "../auth.js";
import { uploadToYouTube } from "../youtube.js";
import { uploadToTikTok } from "../tiktok.js";
import { uploadToInstagram, setInstagramUserId, getInstagramUserId } from "../instagram.js";
import { getConnector, getAllConnectors } from "../connector-factory.js";
import { PlatformUploadError } from "../types.js";
import type { AuthConfig, TokenStore, UploadRequest, Platform } from "../types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const outputDir = path.resolve(process.cwd(), "output");

function createDummyVideo(fileName: string): string {
  const p = path.join(outputDir, fileName);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  // Write a minimal MP4-like buffer
  fs.writeFileSync(p, Buffer.alloc(1024, 0x00));
  return p;
}

function cleanupDummyVideo(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

const baseAuthConfig: AuthConfig = {
  platform: "youtube",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  redirectUri: "https://clipflow.app/oauth/youtube/callback",
  scopes: ["https://www.googleapis.com/auth/youtube.upload"],
};

const validToken: TokenStore = {
  accessToken: "ya29.test-access-token",
  refreshToken: "1//test-refresh-token",
  expiresAt: new Date(Date.now() + 3600_000), // 1 hour from now
};

const baseUploadRequest: UploadRequest = {
  videoPath: "",
  title: "Test Video",
  description: "A test video description",
  tags: ["test", "clipflow"],
  platform: "youtube",
};

// ── Tests: OAuth URL Construction ──────────────────────────────────────────

describe("getAuthUrl", () => {
  it("builds a valid YouTube OAuth URL", () => {
    const url = getAuthUrl({ ...baseAuthConfig, platform: "youtube" });
    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload");
    expect(url).toContain("response_type=code");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fclipflow.app%2Foauth%2Fyoutube%2Fcallback");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
  });

  it("builds a valid TikTok OAuth URL", () => {
    const url = getAuthUrl({
      ...baseAuthConfig,
      platform: "tiktok",
      scopes: ["video.upload", "video.publish"],
    });
    expect(url).toContain("https://www.tiktok.com/v2/auth/authorize/");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("scope=video.upload+video.publish");
    expect(url).toContain("state=");
  });

  it("builds a valid Instagram/Facebook OAuth URL", () => {
    const url = getAuthUrl({
      ...baseAuthConfig,
      platform: "instagram",
      scopes: ["instagram_basic", "instagram_content_publish"],
    });
    expect(url).toContain("https://www.facebook.com/v18.0/dialog/oauth");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("scope=instagram_basic+instagram_content_publish");
    expect(url).toContain("state=");
  });

  it("includes multiple scopes in the URL", () => {
    const config: AuthConfig = {
      ...baseAuthConfig,
      platform: "youtube",
      scopes: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube",
      ],
    };
    const url = getAuthUrl(config);
    expect(url).toContain("scope=");
    // scopes are space-joined then URL-encoded
    expect(url).toContain("youtube.upload");
    expect(url).toContain("youtube");
  });
});

// ── Tests: Token Exchange ──────────────────────────────────────────────────

describe("exchangeCodeForToken", () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it("calls the correct token endpoint for YouTube", async () => {
    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(200, {
        access_token: "ya29.new-token",
        expires_in: 3600,
        refresh_token: "1//new-refresh",
        scope: "https://www.googleapis.com/auth/youtube.upload",
        token_type: "Bearer",
      });

    const result = await exchangeCodeForToken(
      { ...baseAuthConfig, platform: "youtube" },
      "test-auth-code",
    );

    expect(result.accessToken).toBe("ya29.new-token");
    expect(result.refreshToken).toBe("1//new-refresh");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("calls the correct token endpoint for TikTok", async () => {
    nock("https://open.tiktokapis.com")
      .post("/v2/oauth/token/")
      .reply(200, {
        access_token: "tiktok.at.test",
        expires_in: 86400,
        refresh_token: "tiktok.rt.test",
      });

    const result = await exchangeCodeForToken(
      {
        ...baseAuthConfig,
        platform: "tiktok",
        clientId: "tt-client",
        clientSecret: "tt-secret",
        scopes: ["video.upload"],
      },
      "tt-auth-code",
    );

    expect(result.accessToken).toBe("tiktok.at.test");
  });

  it("calls the correct token endpoint for Instagram", async () => {
    nock("https://graph.facebook.com")
      .post("/v18.0/oauth/access_token")
      .reply(200, {
        access_token: "ig.at.test",
        expires_in: 5184000,
      });

    const result = await exchangeCodeForToken(
      {
        ...baseAuthConfig,
        platform: "instagram",
        clientId: "fb-client",
        clientSecret: "fb-secret",
        scopes: ["instagram_basic"],
      },
      "fb-auth-code",
    );

    expect(result.accessToken).toBe("ig.at.test");
  });

  it("throws on non-OK response", async () => {
    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(400, { error: "invalid_grant" });

    await expect(
      exchangeCodeForToken({ ...baseAuthConfig, platform: "youtube" }, "bad-code"),
    ).rejects.toThrow(/Token exchange failed for youtube/);
  });

  it("throws when response is missing access_token", async () => {
    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(200, { expires_in: 3600 }); // no access_token

    await expect(
      exchangeCodeForToken({ ...baseAuthConfig, platform: "youtube" }, "code"),
    ).rejects.toThrow(/missing access_token/);
  });
});

// ── Tests: Token Refresh ───────────────────────────────────────────────────

describe("refreshAccessToken", () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it("refreshes a YouTube token", async () => {
    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(200, {
        access_token: "ya29.fresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      });

    const result = await refreshAccessToken(
      { ...baseAuthConfig, platform: "youtube" },
      { ...validToken, expiresAt: new Date(Date.now() - 1000) },
    );

    expect(result.accessToken).toBe("ya29.fresh-token");
  });

  it("refreshes an Instagram token via Facebook Graph", async () => {
    nock("https://graph.facebook.com")
      .post("/v18.0/oauth/access_token")
      .reply(200, {
        access_token: "ig.fresh-token",
        expires_in: 5184000,
      });

    const result = await refreshAccessToken(
      {
        ...baseAuthConfig,
        platform: "instagram",
        clientId: "fb-client",
        clientSecret: "fb-secret",
        scopes: ["instagram_basic"],
      },
      { accessToken: "old", refreshToken: "old-rt", expiresAt: new Date(0) },
    );

    expect(result.accessToken).toBe("ig.fresh-token");
  });

  it("throws if no refresh token is available", async () => {
    const noRefresh: TokenStore = {
      accessToken: "at",
      expiresAt: new Date(Date.now() - 1000),
    };

    await expect(
      refreshAccessToken({ ...baseAuthConfig, platform: "youtube" }, noRefresh),
    ).rejects.toThrow(/No refresh token available/);
  });

  it("throws on non-OK refresh response", async () => {
    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(400, { error: "invalid_grant" });

    await expect(
      refreshAccessToken(
        { ...baseAuthConfig, platform: "youtube" },
        { ...validToken, expiresAt: new Date(0) },
      ),
    ).rejects.toThrow(/Token refresh failed/);
  });
});

// ── Tests: isTokenExpired ──────────────────────────────────────────────────

describe("isTokenExpired", () => {
  it("returns true for expired token", () => {
    expect(
      isTokenExpired({ accessToken: "x", expiresAt: new Date(Date.now() - 1000) }),
    ).toBe(true);
  });

  it("returns true for token expiring within 60s", () => {
    expect(
      isTokenExpired({ accessToken: "x", expiresAt: new Date(Date.now() + 30_000) }),
    ).toBe(true);
  });

  it("returns false for valid token", () => {
    expect(
      isTokenExpired({ accessToken: "x", expiresAt: new Date(Date.now() + 120_000) }),
    ).toBe(false);
  });
});

// ── Tests: YouTube Connector ───────────────────────────────────────────────

describe("uploadToYouTube", () => {
  let videoPath: string;
  let req: UploadRequest;

  beforeEach(() => {
    nock.disableNetConnect();
    videoPath = createDummyVideo("test-youtube.mp4");
    req = { ...baseUploadRequest, videoPath, platform: "youtube" };
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    cleanupDummyVideo(videoPath);
  });

  it("builds correct initiate request and handles upload", async () => {
    nock("https://www.googleapis.com")
      // Initiate resumable upload
      .post("/upload/youtube/v3/videos")
      .query({ uploadType: "resumable", part: "snippet,status" })
      .reply(200, "", {
        Location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test123",
      });

    nock("https://www.googleapis.com")
      // Upload bytes
      .put("/upload/youtube/v3/videos")
      .query({ upload_id: "test123" })
      .reply(200, { id: "yt-video-abc123", kind: "youtube#video" });

    const result = await uploadToYouTube(req, validToken);

    expect(result).toMatchObject({
      platform: "youtube",
      platformId: "yt-video-abc123",
      url: "https://www.youtube.com/shorts/yt-video-abc123",
    });
  });

  it("throws PlatformUploadError for expired token", async () => {
    const expired: TokenStore = { accessToken: "x", expiresAt: new Date(0) };

    await expect(uploadToYouTube(req, expired)).rejects.toThrow(PlatformUploadError);
    await expect(uploadToYouTube(req, expired)).rejects.toThrow(/expired/i);
  });

  it("throws when video file is missing", async () => {
    await expect(
      uploadToYouTube({ ...req, videoPath: "/nonexistent/video.mp4" }, validToken),
    ).rejects.toThrow(/Video file not found/);
  });

  it("throws on 401 from initiate", async () => {
    nock("https://www.googleapis.com")
      .post("/upload/youtube/v3/videos")
      .query(true)
      .times(2)
      .reply(401, { error: { code: 401, message: "Invalid Credentials" } });

    await expect(uploadToYouTube(req, validToken)).rejects.toThrow(PlatformUploadError);
    await expect(uploadToYouTube(req, validToken)).rejects.toThrow(/expired/i);
  });

  it("throws on quota exceeded", async () => {
    nock("https://www.googleapis.com")
      .post("/upload/youtube/v3/videos")
      .query(true)
      .reply(403, {
        error: {
          code: 403,
          message: "The request cannot be completed because you have exceeded your <a href=\"/youtube/v3/getting-started#quota\">quota</a>.",
          errors: [{ domain: "youtube.quota", reason: "quotaExceeded" }],
        },
      });

    await expect(uploadToYouTube(req, validToken)).rejects.toThrow(/Rate limited/);
  });

  it("throws if no upload location returned", async () => {
    nock("https://www.googleapis.com")
      .post("/upload/youtube/v3/videos")
      .query(true)
      .reply(200, ""); // No Location header

    await expect(uploadToYouTube(req, validToken)).rejects.toThrow(/No upload location/);
  });
});

// ── Tests: TikTok Connector ────────────────────────────────────────────────

describe("uploadToTikTok", () => {
  let videoPath: string;
  let req: UploadRequest;

  beforeEach(() => {
    nock.disableNetConnect();
    videoPath = createDummyVideo("test-tiktok.mp4");
    req = { ...baseUploadRequest, videoPath, platform: "tiktok" };
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    cleanupDummyVideo(videoPath);
  });

  it("builds correct upload init, byte upload, and publish requests", async () => {
    nock("https://open.tiktokapis.com")
      .post("/v2/video/upload/init/")
      .reply(200, {
        data: {
          upload_url: "https://upload.tiktokapis.com/v2/video/upload/bytes/session-123",
          publish_id: "pub_abc456",
        },
      });

    nock("https://upload.tiktokapis.com")
      .put("/v2/video/upload/bytes/session-123")
      .reply(200, {});

    nock("https://open.tiktokapis.com")
      .post("/v2/video/publish/")
      .reply(200, {
        data: {
          publish_id: "pub_abc456",
          status: "PUBLISHED",
          video_id: "tt-vid-789",
        },
      });

    const result = await uploadToTikTok(req, validToken);

    expect(result).toMatchObject({
      platform: "tiktok",
      platformId: "tt-vid-789",
      url: "https://www.tiktok.com/@me/video/tt-vid-789",
    });
  });

  it("throws PlatformUploadError for expired token", async () => {
    const expired: TokenStore = { accessToken: "x", expiresAt: new Date(0) };
    await expect(uploadToTikTok(req, expired)).rejects.toThrow(/expired/i);
  });

  it("throws when video file is missing", async () => {
    await expect(
      uploadToTikTok({ ...req, videoPath: "/nonexistent/video.mp4" }, validToken),
    ).rejects.toThrow(/Video file not found/);
  });

  it("throws on API error in init response", async () => {
    nock("https://open.tiktokapis.com")
      .post("/v2/video/upload/init/")
      .reply(200, {
        error: { code: "access_token_invalid", message: "The access token is invalid" },
      });

    await expect(uploadToTikTok(req, validToken)).rejects.toThrow(/API error/);
  });

  it("throws on 429 rate limit from init", async () => {
    nock("https://open.tiktokapis.com")
      .post("/v2/video/upload/init/")
      .reply(429, { error: { code: "rate_limit_exceeded" } });

    await expect(uploadToTikTok(req, validToken)).rejects.toThrow(/Rate limited/);
  });

  it("throws if no upload_url in init response", async () => {
    nock("https://open.tiktokapis.com")
      .post("/v2/video/upload/init/")
      .reply(200, { data: { publish_id: "pub_abc" } }); // missing upload_url

    await expect(uploadToTikTok(req, validToken)).rejects.toThrow(/No upload_url/);
  });
});

// ── Tests: Instagram Connector ─────────────────────────────────────────────

describe("uploadToInstagram", () => {
  let videoPath: string;
  let req: UploadRequest;

  beforeEach(() => {
    nock.disableNetConnect();
    videoPath = createDummyVideo("test-ig.mp4");
    req = { ...baseUploadRequest, videoPath, platform: "instagram" };
    setInstagramUserId("ig-user-12345");
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    cleanupDummyVideo(videoPath);
  });

  it("builds correct container creation and publish requests", async () => {
    nock("https://graph.facebook.com")
      .post("/v18.0/ig-user-12345/media")
      .reply(200, { id: "container-abc" });

    nock("https://graph.facebook.com")
      .post("/v18.0/ig-user-12345/media_publish")
      .reply(200, { id: "ig-media-456" });

    const result = await uploadToInstagram(req, validToken);

    expect(result).toMatchObject({
      platform: "instagram",
      platformId: "ig-media-456",
      url: "https://www.instagram.com/reel/ig-media-456/",
    });
  });

  it("throws if no Instagram user ID is configured", async () => {
    // Clear the default
    setInstagramUserId("" as unknown as string);
    // Override getInstagramUserId behavior by testing with explicit undefined
    await expect(
      uploadToInstagram(req, validToken, undefined),
    ).rejects.toThrow(/No Instagram user ID configured/);

    // Reset for other tests
    setInstagramUserId("ig-user-12345");
  });

  it("throws PlatformUploadError for expired token", async () => {
    const expired: TokenStore = { accessToken: "x", expiresAt: new Date(0) };
    await expect(uploadToInstagram(req, expired)).rejects.toThrow(/expired/i);
  });

  it("throws when video file is missing", async () => {
    await expect(
      uploadToInstagram({ ...req, videoPath: "/nonexistent/video.mp4" }, validToken),
    ).rejects.toThrow(/Video file not found/);
  });

  it("throws on container creation failure", async () => {
    nock("https://graph.facebook.com")
      .post("/v18.0/ig-user-12345/media")
      .reply(400, {
        error: { message: "Invalid video URL", code: 100, type: "OAuthException" },
      });

    await expect(uploadToInstagram(req, validToken)).rejects.toThrow(/Container creation failed/);
  });

  it("throws on 429 rate limit", async () => {
    nock("https://graph.facebook.com")
      .post("/v18.0/ig-user-12345/media")
      .reply(429, { error: { message: "Rate limit exceeded" } });

    await expect(uploadToInstagram(req, validToken)).rejects.toThrow(/Rate limited/);
  });

  it("throws if no container ID in response", async () => {
    nock("https://graph.facebook.com")
      .post("/v18.0/ig-user-12345/media")
      .reply(200, {}); // missing id

    await expect(uploadToInstagram(req, validToken)).rejects.toThrow(/No container ID/);
  });
});

// ── Tests: Connector Factory ───────────────────────────────────────────────

describe("getConnector", () => {
  it("returns the YouTube connector for 'youtube'", () => {
    const c = getConnector("youtube");
    expect(c).toBeDefined();
    expect(c.getAuthConfig().platform).toBe("youtube");
    expect(c.getAuthConfig().scopes).toContain("https://www.googleapis.com/auth/youtube.upload");
  });

  it("returns the TikTok connector for 'tiktok'", () => {
    const c = getConnector("tiktok");
    expect(c).toBeDefined();
    expect(c.getAuthConfig().platform).toBe("tiktok");
    expect(c.getAuthConfig().scopes).toContain("video.upload");
  });

  it("returns the Instagram connector for 'instagram'", () => {
    const c = getConnector("instagram");
    expect(c).toBeDefined();
    expect(c.getAuthConfig().platform).toBe("instagram");
    expect(c.getAuthConfig().scopes).toContain("instagram_content_publish");
  });
});

describe("getAllConnectors", () => {
  it("returns all three connectors", () => {
    const all = getAllConnectors();
    expect(Object.keys(all)).toHaveLength(3);
    expect(all.youtube).toBeDefined();
    expect(all.tiktok).toBeDefined();
    expect(all.instagram).toBeDefined();
  });
});

// ── Tests: PlatformUploadError ─────────────────────────────────────────────

describe("PlatformUploadError", () => {
  it("creates an expired token error", () => {
    const err = PlatformUploadError.expiredToken("youtube");
    expect(err).toBeInstanceOf(PlatformUploadError);
    expect(err.platform).toBe("youtube");
    expect(err.statusCode).toBe(401);
    expect(err.platformErrorCode).toBe("EXPIRED_TOKEN");
    expect(err.message).toContain("expired");
  });

  it("creates a rate-limited error", () => {
    const err = PlatformUploadError.rateLimited("tiktok", 120);
    expect(err.platform).toBe("tiktok");
    expect(err.statusCode).toBe(429);
    expect(err.platformErrorCode).toBe("RATE_LIMITED");
    expect(err.message).toContain("120s");
  });

  it("creates an upload-failed error", () => {
    const err = PlatformUploadError.uploadFailed("instagram", "Bad request", 400);
    expect(err.platform).toBe("instagram");
    expect(err.statusCode).toBe(400);
    expect(err.platformErrorCode).toBe("UPLOAD_FAILED");
  });

  it("creates a network error", () => {
    const err = PlatformUploadError.networkError("youtube", "ECONNREFUSED");
    expect(err.platform).toBe("youtube");
    expect(err.platformErrorCode).toBe("NETWORK_ERROR");
    expect(err.message).toContain("ECONNREFUSED");
  });

  it("has the correct Error name", () => {
    const err = PlatformUploadError.expiredToken("youtube");
    expect(err.name).toBe("PlatformUploadError");
  });
});

// ── Tests: OAUTH_ENDPOINTS constants ───────────────────────────────────────

describe("OAUTH_ENDPOINTS", () => {
  it("has YouTube endpoints", () => {
    expect(OAUTH_ENDPOINTS.youtube.authUrl).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(OAUTH_ENDPOINTS.youtube.tokenUrl).toBe("https://oauth2.googleapis.com/token");
  });

  it("has TikTok endpoints", () => {
    expect(OAUTH_ENDPOINTS.tiktok.authUrl).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(OAUTH_ENDPOINTS.tiktok.tokenUrl).toBe("https://open.tiktokapis.com/v2/oauth/token/");
  });

  it("has Instagram endpoints", () => {
    expect(OAUTH_ENDPOINTS.instagram.authUrl).toBe("https://www.facebook.com/v18.0/dialog/oauth");
    expect(OAUTH_ENDPOINTS.instagram.tokenUrl).toBe("https://graph.facebook.com/v18.0/oauth/access_token");
  });
});
