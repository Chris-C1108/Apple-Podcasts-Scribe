# Development Log

## 2026-01-21: Robust Podcast Metadata Lookup

### Podcast Service Resilience
- **Issue**: Some podcasts (e.g., "All Ears English") were failing to load metadata with "Network error". This was occurring because the direct fetch to `itunes.apple.com/lookup` was being blocked in certain network environments or for specific requests, despite iTunes generally supporting CORS.
- **Resolution**:
  - Implemented a **Proxy Fallback Mechanism** in `services/podcastService.ts` for the `fetchPodcastData` function.
  - The service now attempts a direct fetch first. If that fails (catches an error), it logs a warning and automatically retries the request using the `podscribe-proxy` (`https://podscribe-proxy.uni-kui.shop`).
- **Outcome**: This ensures that metadata lookup is resilient to sporadic network blocks or strict browser environments, significantly improving the success rate for loading different podcasts.

## 2026-01-21: Streamed Transcription & Versioning

### Streamed Audio Transcription
- **Objective**: Improve user experience by displaying transcription progress in real-time and handle long audio files more reliably.
- **Implementation**:
  - Implemented client-side audio chunking using `Blob.slice()` (no FFmpeg required).
  - Created `transcribeAudioStream` in `services/geminiService.ts`.
    - Splits audio into 60s chunks with 15s overlap.
    - Uses a robust deduplication algorithm (`mergeLyrics`) to seamlessly stitch chunks.
    - Supports realtime `onProgress` callbacks.
  - Updated `App.tsx` to consume the stream and display a new "Karaoke-style" lyric view.
  - Added support for `LyricItem` structure (start, end, speaker, isMusic).

### Versioning
- **Action**: Bumped version to `0.1.0`.
- **UI**: Added version display in the top-right corner of the app and in the initialization logs.

## 2026-01-21: Gemini Proxy Implementation & iTunes Search Fix

### Gemini Proxy Infrastructure
- **Objective**: Route Gemini API requests through a proxy to bypass client-side network restrictions (China accessibility).
- **Implementation**:
  - Created a new Cloudflare Worker script: `cloudflare-worker/gemini-worker.js`.
    - Handles CORS preflight requests (`OPTIONS`).
    - Proxies requests to `generativelanguage.googleapis.com`.
    - Preserves all headers and body content.
  - Created Wrangler configuration: `cloudflare-worker/wrangler-gemini.toml`.
    - Configured worker name as `gemini-proxy`.
    - Bound to custom domain: `gemni.uni-kui.shop`.
  - **Status**: Deployed and verified via `test_proxy.py`.
- **Frontend Integration**:
  - Updated `services/geminiService.ts` to initialize `GoogleGenAI` with `httpOptions.baseUrl` pointing to the new proxy.

### Podcast Search Service Fix
- **Issue**: The `podscribe-proxy` worker was returning `403 Forbidden` errors when accessing the iTunes Search API. This is likely due to Apple blocking Cloudflare Worker IPs.
- **Investigation**:
  - Confirmed via `test_podcast_proxy.py` that the proxy was forwarding the 403 error from upstream.
  - Verified that the iTunes Search API (`itunes.apple.com/search` and `/lookup`) supports CORS natively using `curl`.
- **Resolution**:
  - Modified `services/podcastService.ts` to bypass the proxy for Search and Lookup operations.
  - The application now fetches directly from `itunes.apple.com` (client-side), which avoids the Cloudflare IP block.
  - **Note**: The proxy is still used as a fallback for RSS feed fetching, as most RSS hosts do not support CORS.

### Files Created/Modified
- `cloudflare-worker/gemini-worker.js` (New)
- `cloudflare-worker/wrangler-gemini.toml` (New)
- `services/geminiService.ts` (Modified)
- `services/podcastService.ts` (Modified)
- `cloudflare-worker/worker.js` (Modified - attempted headers fix, mostly relevant for RSS proxying now)
- `test_proxy.py` (New - testing utility)
- `test_podcast_proxy.py` (New - testing utility)
