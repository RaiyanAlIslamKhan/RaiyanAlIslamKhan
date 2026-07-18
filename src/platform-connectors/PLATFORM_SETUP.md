# Platform Setup Guide — ClipFlow

This document outlines what each supported platform requires for API access, OAuth setup,
required scopes, known limitations, and rate limits.

---

## YouTube (YouTube Data API v3)

### Overview
YouTube Shorts are published via the YouTube Data API v3. Videos are uploaded using the
resumable upload protocol and are automatically treated as Shorts when they are vertical
(9:16) and ≤60 seconds.

### Setup Steps
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **YouTube Data API v3** from the API Library
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
6. Select **Web application** as the application type
7. Add your redirect URI (e.g., `https://clipflow.app/oauth/youtube/callback`)
8. Configure the **OAuth consent screen**:
   - Choose **External** user type
   - Add the YouTube Data API scope
   - Add test users (including your own Google account)
9. Copy the **Client ID** and **Client Secret** — never commit these to version control

### Required Scopes
```
https://www.googleapis.com/auth/youtube.upload
```
This scope covers uploading videos. You may also use the broader scope:
```
https://www.googleapis.com/auth/youtube
```
which covers full YouTube account management.

### Prerequisites
- The authenticated Google account must have a **YouTube channel** linked to it
- If no channel exists, create one at [youtube.com/create_channel](https://www.youtube.com/create_channel)

### Rate Limits & Quotas
- Default quota: **10,000 units/day**
- One video upload costs **~1,600 quota units**
- A write operation costs **50 units**
- You can request a quota increase from the Google Cloud Console

### Known Limitations
- OAuth consent screen for External apps in "Testing" mode limits to 100 users
- To go public, the app must pass Google verification (can take several weeks)
- YouTube Shorts have a **60-second maximum** duration
- `publishAt` scheduling requires the video to be private until the scheduled time

---

## TikTok (Content Posting API)

### Overview
TikTok's Content Posting API allows direct video uploads to TikTok. The flow has three steps:
upload init → byte upload → publish.

### Setup Steps
1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Create a new app
3. Configure the app:
   - Add **redirect domain** (e.g., `clipflow.app`)
   - Under **Products**, add **Content Posting**
4. Complete **business verification** (required for Content Posting)
5. Request **Content Posting scope approval** during app review
6. Configure OAuth:
   - Get **Client Key** (client_id) and **Client Secret**

### Required Scopes
```
video.upload
video.publish
```

### Prerequisites
- Business verification is mandatory
- App review by TikTok is mandatory before Content Posting scopes are granted
- The TikTok account must be in a supported region

### Rate Limits
- **2,000 video uploads/day** (at time of writing)
- TikTok may adjust limits — check the developer dashboard

### Known Limitations
- **App review is a major bottleneck.** TikTok manually reviews every app requesting
  Content Posting scopes. Approval can take **days to weeks** and is not guaranteed.
- Videos are limited to **≤10 minutes** and **≤1 GB**
- Privacy settings: `MUTUAL_FOLLOW_FRIENDS` or `PUBLIC`
- The API does **not** support scheduling posts — `scheduled_at` may not work on all accounts
- TikTok may reject videos that don't meet their content guidelines

---

## Instagram (Instagram Graph API via Facebook)

### Overview
Instagram publishing uses the Facebook Graph API's Instagram endpoints. Videos are published
via a two-step container-create → publish flow.

### Setup Steps
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a **Facebook App** (type: Business, or "None")
3. Add the **Instagram Graph API** product
4. Configure **Facebook Login for Business**:
   - Add redirect URI (e.g., `https://clipflow.app/oauth/instagram/callback`)
5. Go to **App Review → Permissions and Features**, request:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
6. Copy **App ID** and **App Secret**

### Required Scopes
```
instagram_basic
instagram_content_publish
pages_show_list
pages_read_engagement
```

### Prerequisites (for the authenticated user)
- The user must have an **Instagram Professional account** (Business or Creator)
- That Instagram account must be **connected to a Facebook Page**
- The user must have a **role** (admin, editor, etc.) on that Facebook Page
- The Facebook Page must be connected to the Facebook App

### Finding the Instagram User ID
After OAuth, call:
```
GET /me/accounts?fields=instagram_business_account{id,username}
```
This returns the connected Instagram Business Account ID. Store this for uploads.

### Rate Limits
- Instagram Graph API uses **Facebook's rate limiting system**
- **200 calls/hour** per user per app (typical)
- Higher limits are available for verified apps
- Use the `X-App-Usage` header to track usage

### Known Limitations
- Instagram **does not support direct file upload** via the Graph API — the video must be
  hosted at a public URL. ClipFlow must upload the rendered video to cloud storage (S3, GCS)
  before passing the URL to the Instagram API
- Reels maximum: **90 seconds**
- Caption limit: **2,200 characters**, **30 hashtags**
- Scheduling is **not supported natively** via the Graph API for Reels
- Instagram's content review may delay or reject videos
- The account must have **no prior violations** for content publishing to work

---

## General OAuth Flow (all platforms)

1. **ClipFlow** constructs the platform's OAuth URL with required scopes
2. The **user** is redirected to the platform's consent screen
3. The **user** grants permissions
4. The **platform** redirects back to ClipFlow with an authorization `code`
5. ClipFlow **exchanges the code** for an access token + refresh token
6. ClipFlow **stores the token** securely (encrypted at rest)
7. On upload, ClipFlow checks token expiry and **refreshes if needed**
8. ClipFlow calls the **platform's upload API** with the valid token

---

## Security Notes
- **Never commit API keys, secrets, or tokens** to version control
- Store credentials in environment variables or a secrets manager
- Encrypt refresh tokens at rest (e.g., AES-256-GCM)
- Rotate client secrets periodically
- Use PKCE for OAuth where supported (TikTok, Instagram/Facebook)
- For YouTube, use `access_type=offline` to get a refresh token
