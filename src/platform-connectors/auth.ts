import type { AuthConfig, Platform, TokenStore } from "./types.js";

// ── Platform OAuth endpoint constants ──────────────────────────────────────

export const OAUTH_ENDPOINTS: Record<
  Platform,
  {
    authUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
  }
> = {
  youtube: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
  },
  instagram: {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    refreshUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
  },
};

// ── OAuth helpers ─────────────────────────────────────────────────────────

/**
 * Build the OAuth authorization URL for a given platform.
 * The user visits this URL, grants permissions, and is redirected back
 * with an authorization `code`.
 */
export function getAuthUrl(config: AuthConfig): string {
  const endpoints = OAUTH_ENDPOINTS[config.platform];
  const params = new URLSearchParams();

  params.set("client_id", config.clientId);
  params.set("redirect_uri", config.redirectUri);
  params.set("response_type", "code");
  params.set("scope", config.scopes.join(" "));

  // Platform-specific parameters
  switch (config.platform) {
    case "youtube":
      params.set("access_type", "offline");
      params.set("prompt", "consent");
      break;
    case "tiktok":
      params.set("state", crypto.randomUUID());
      break;
    case "instagram":
      // Facebook uses comma-separated scopes in some contexts, but space works too.
      params.set("state", crypto.randomUUID());
      break;
  }

  return `${endpoints.authUrl}?${params.toString()}`;
}

/**
 * Exchange an OAuth authorization code for access + refresh tokens.
 *
 * Makes a POST request to the platform's token endpoint.
 * In production, use a server-side HTTP client (e.g. `fetch` or `axios`).
 * This function uses the global `fetch` API (Node 18+).
 *
 * @throws {PlatformUploadError} on network failure or bad response.
 */
export async function exchangeCodeForToken(
  config: AuthConfig,
  code: string,
): Promise<TokenStore> {
  const endpoints = OAUTH_ENDPOINTS[config.platform];
  const body = buildTokenRequestBody(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(endpoints.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(
      `Token exchange failed for ${config.platform} (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return normalizeTokenResponse(config.platform, data);
}

/**
 * Refresh an expired access token using the refresh token.
 *
 * Not all platforms support refresh. TikTok issues long-lived tokens directly.
 * Instagram (Facebook) supports refresh via grant_type=fb_exchange_token.
 *
 * @throws {PlatformUploadError} on failure.
 */
export async function refreshAccessToken(
  config: AuthConfig,
  token: TokenStore,
): Promise<TokenStore> {
  if (!token.refreshToken) {
    throw new Error(
      `No refresh token available for ${config.platform} — re-authorization required`,
    );
  }

  const endpoints = OAUTH_ENDPOINTS[config.platform];
  const tokenUrl = endpoints.refreshUrl ?? endpoints.tokenUrl;

  const body = buildTokenRequestBody(config, {
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(
      `Token refresh failed for ${config.platform} (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return normalizeTokenResponse(config.platform, data);
}

// ── Internal helpers ───────────────────────────────────────────────────────

interface TokenRequestParams {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
}

function buildTokenRequestBody(
  config: AuthConfig,
  params: TokenRequestParams,
): URLSearchParams {
  const body = new URLSearchParams();
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("grant_type", params.grant_type);

  if (params.code) body.set("code", params.code);
  if (params.redirect_uri) body.set("redirect_uri", params.redirect_uri);
  if (params.refresh_token) body.set("refresh_token", params.refresh_token);

  return body;
}

/**
 * Normalize platform-specific token responses into the common TokenStore shape.
 */
function normalizeTokenResponse(
  platform: Platform,
  data: Record<string, unknown>,
): TokenStore {
  const accessToken = String(data.access_token ?? "");
  if (!accessToken) {
    throw new Error(
      `Token response from ${platform} missing access_token: ${JSON.stringify(data)}`,
    );
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const refreshToken =
    typeof data.refresh_token === "string" && data.refresh_token.length > 0
      ? data.refresh_token
      : undefined;

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Check whether a token needs refreshing (expired or within 60s of expiry).
 */
export function isTokenExpired(token: TokenStore): boolean {
  return Date.now() >= token.expiresAt.getTime() - 60_000;
}
